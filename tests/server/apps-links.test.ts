import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { linkModerationList } from "@/features/apps/links/admin/search";
import { LINKS_QUOTAS } from "@/features/apps/links/types";
import type { Actor } from "@/features/rbac/types";
import { isAppError } from "@/lib/errors";
import { clickFacts, countryCode, deviceClass, referrerHost } from "@/server/apps/links/clicks";
import { shortLinkResponse } from "@/server/apps/links/redirect";
import * as repo from "@/server/apps/links/repository";
import * as links from "@/server/apps/links/service";
import type { AppServices } from "@/server/apps/ownership";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Links (decision 0191) on PGlite: every call sees and changes only its caller's links,
 * slugs are unique across everyone, quotas and the create limit hold, the redirect
 * answers only links that may redirect now (never a guest's) and records what a click
 * is allowed to keep, statistics fill every day, and moderation is audited.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values([
			{ id: "alice", name: "Alice", email: "alice@example.com" },
			{ id: "bob", name: "Bob", email: "bob@example.com" },
			{ id: "guest-1", name: "Guest", email: "g1@anonymous.placeholder.invalid", isAnonymous: true },
		]),
	);
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string, isGuest = false): AppServices => ({ db: env.db, user: { id, isGuest } });
const alice = () => as("alice");
const bob = () => as("bob");
const guest = () => as("guest-1", true);
const ADMIN: Actor = { id: "admin-1", isAdmin: true, permissions: [] };

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return isAppError(error) ? error.code : "thrown";
	}
};

const newLink = (slug = "", target = "https://example.com/a/long/path", expiresAt: string | null = null) => ({
	target,
	slug,
	title: "",
	expiresAt,
});

const visit = (slug: string, headers: Record<string, string> = {}, method = "GET") =>
	shortLinkResponse(env.db, slug, new Request(`http://localhost/l/${slug}`, { method, headers }));

/** The background click insert runs outside a Vercel request: give it a moment. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("Links ownership", () => {
	it("never shows one user's links to another", async () => {
		const link = await links.createLink(alice(), newLink("alice-trek"));
		expect((await links.listLinks(bob())).links).toEqual([]);
		expect(await code(links.getLinkStats(bob(), link.id))).toBe("NOT_FOUND");
		expect(await code(links.updateLink(bob(), { id: link.id, active: false }))).toBe("NOT_FOUND");
		expect(await code(links.deleteLink(bob(), link.id))).toBe("NOT_FOUND");
		expect((await links.listLinks(alice())).links.map((each) => each.state)).toEqual(["live"]);
	});
});

describe("Links slugs and rules", () => {
	it("picks a random slug when none is given", async () => {
		const link = await links.createLink(alice(), newLink());
		expect(link.slug).toMatch(/^[a-z2-9]{7}$/);
	});

	it("refuses a slug someone else has, on the slug field", async () => {
		await links.createLink(alice(), newLink("taken"));
		const error = await links.createLink(bob(), newLink("taken")).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("CONFLICT");
		expect(isAppError(error) && error.fieldErrors?.slug).toBeTruthy();
	});

	it("refuses an expiry in the past", async () => {
		expect(await code(links.createLink(alice(), newLink("", undefined, "2020-01-01T00:00:00.000Z")))).toBe(
			"BAD_REQUEST",
		);
	});

	it(`allows ${LINKS_QUOTAS.createsPerHour} creates an hour`, async () => {
		for (let index = 0; index < LINKS_QUOTAS.createsPerHour; index++) await links.createLink(alice(), newLink());
		expect(await code(links.createLink(alice(), newLink()))).toBe("RATE_LIMITED");
		expect(await code(links.createLink(bob(), newLink()))).toBe("ok");
	});

	it(`allows ${LINKS_QUOTAS.links} links`, async () => {
		await env.db.transaction((tx) =>
			repo.insertLinks(
				tx,
				"alice",
				Array.from({ length: LINKS_QUOTAS.links }, (_, index) => ({
					slug: `bulk-${index}`,
					target: "https://a.example",
				})),
			),
		);
		expect(await code(links.createLink(alice(), newLink()))).toBe("CONFLICT");
	});
});

describe("Links redirect", () => {
	it("redirects a live link and records the click without an IP", async () => {
		await links.createLink(alice(), newLink("go-there", "https://example.com/x"));
		const response = await visit("go-there", {
			referer: "https://www.news.example/item?id=1",
			"x-vercel-ip-country": "np",
			"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
			"x-forwarded-for": "203.0.113.9",
		});
		expect(response?.status).toBe(302);
		expect(response?.headers.get("location")).toBe("https://example.com/x");
		expect(response?.headers.get("cache-control")).toBe("private, no-store");
		await settle();
		const clicks = await env.db.select().from(schema.linkClick);
		expect(clicks).toHaveLength(1);
		expect(clicks[0]).toMatchObject({
			referrerHost: "news.example",
			country: "NP",
			device: "mobile",
			ownerId: "alice",
		});
		expect(JSON.stringify(clicks)).not.toContain("203.0.113.9");
	});

	it("doesn't count a HEAD request", async () => {
		await links.createLink(alice(), newLink("checked"));
		expect((await visit("checked", {}, "HEAD"))?.status).toBe(302);
		await settle();
		expect(await env.db.select().from(schema.linkClick)).toEqual([]);
	});

	it("answers nothing for unknown, paused, expired, blocked and guest links", async () => {
		const paused = await links.createLink(alice(), newLink("paused-one"));
		await links.updateLink(alice(), { id: paused.id, active: false });
		const expired = await links.createLink(alice(), newLink("expired-one"));
		await env.db
			.update(schema.link)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(schema.link.id, expired.id));
		const blocked = await links.createLink(alice(), newLink("blocked-one"));
		await links.setLinksBlocked({ db: env.db, actor: ADMIN }, { ids: [blocked.id], blocked: true });
		await links.createLink(guest(), newLink("guest-one"));
		for (const slug of ["nobody-has-it", "paused-one", "expired-one", "blocked-one", "guest-one", "BAD SLUG"]) {
			expect(await visit(slug), slug).toBeNull();
		}
		const states = Object.fromEntries((await links.listLinks(alice())).links.map((link) => [link.slug, link.state]));
		expect(states).toEqual({ "paused-one": "paused", "expired-one": "expired", "blocked-one": "blocked" });
		expect((await links.listLinks(guest())).links[0]?.state).toBe("guest");
	});

	it("a blocked link stays blocked when its owner turns it on", async () => {
		const link = await links.createLink(alice(), newLink("stays-off"));
		await links.setLinksBlocked({ db: env.db, actor: ADMIN }, { ids: [link.id], blocked: true });
		await links.updateLink(alice(), { id: link.id, active: true });
		expect(await visit("stays-off")).toBeNull();
	});
});

describe("Links statistics", () => {
	it("fills 30 days in Nepal time and ranks sources", async () => {
		const link = await links.createLink(alice(), newLink("stats"));
		const now = new Date("2026-10-30T12:00:00Z");
		// 2026-10-29T18:30Z is already the 30th in Kathmandu (UTC+5:45).
		const at = (iso: string) => new Date(iso);
		await env.db.transaction((tx) =>
			repo.insertClicks(tx, "alice", [
				{ linkId: link.id, at: at("2026-10-29T18:30:00Z"), referrerHost: "a.example", country: "NP", device: "mobile" },
				{
					linkId: link.id,
					at: at("2026-10-30T06:00:00Z"),
					referrerHost: "a.example",
					country: null,
					device: "desktop",
				},
				{ linkId: link.id, at: at("2026-10-01T06:00:00Z"), referrerHost: null, country: "IN", device: "mobile" },
				// Outside the window: in the totals, not in the days.
				{ linkId: link.id, at: at("2026-09-01T06:00:00Z"), referrerHost: null, country: "IN", device: "bot" },
			]),
		);
		const stats = await links.getLinkStats(alice(), link.id, now);
		expect(stats.days).toHaveLength(30);
		expect(stats.days[0]?.key).toBe("2026-10-01");
		expect(stats.days.at(-1)).toEqual({ key: "2026-10-30", clicks: 2 });
		expect(stats.days[0]?.clicks).toBe(1);
		expect(stats.total).toBe(4);
		expect(stats.referrers).toEqual([
			{ key: "", clicks: 2 },
			{ key: "a.example", clicks: 2 },
		]);
		expect(stats.devices[0]).toEqual({ key: "mobile", clicks: 2 });
		expect(stats.countries.map((tally) => tally.key)).toEqual(["IN", "", "NP"]);
	});
});

describe("Links moderation", () => {
	it("lists everyone's links with their owners, filtered by state", async () => {
		await links.createLink(alice(), newLink("from-alice"));
		await links.createLink(guest(), newLink("from-guest"));
		const all = await links.listForModeration({ db: env.db }, linkModerationList.input.parse({ pageSize: 20 }));
		expect(all.items.map((item) => item.slug).sort()).toEqual(["from-alice", "from-guest"]);
		const guests = await links.listForModeration(
			{ db: env.db },
			linkModerationList.input.parse({ state: "guest", pageSize: 20 }),
		);
		expect(guests.items.map((item) => item.owner.guest)).toEqual([true]);
		const found = await links.listForModeration(
			{ db: env.db },
			linkModerationList.input.parse({ q: "alice@", pageSize: 20 }),
		);
		expect(found.items.map((item) => item.slug)).toEqual(["from-alice"]);
	});

	it("blocks, unblocks and deletes, each audited", async () => {
		const link = await links.createLink(alice(), newLink("moderated"));
		const services = { db: env.db, actor: ADMIN };
		await links.setLinksBlocked(services, { ids: [link.id], blocked: true });
		await links.setLinksBlocked(services, { ids: [link.id], blocked: false });
		await links.deleteLinks(services, [link.id]);
		const events = await env.db.select().from(schema.auditEvent);
		expect(events.map((event) => event.action).sort()).toEqual(["link.block", "link.delete", "link.unblock"]);
		expect(events.every((event) => event.targetLabel === "moderated")).toBe(true);
		expect((await links.listLinks(alice())).links).toEqual([]);
	});
});

describe("Links for guests", () => {
	it("seeds sample links with clicks in the guest's language", async () => {
		await env.db.transaction((tx) => links.seedLinks(tx, "guest-1", "ne"));
		const list = (await links.listLinks(guest())).links;
		expect(list.map((link) => link.title).sort()).toEqual(["TanStack Start को कागजात", "काठमाडौँको नक्सा"].sort());
		expect(list.every((link) => link.state === "guest")).toBe(true);
		expect(list.reduce((sum, link) => sum + link.clicks, 0)).toBe(40);
	});

	it("moves links and clicks to an account on claim, and they go live", async () => {
		await env.db.transaction((tx) => links.seedLinks(tx, "guest-1", "en"));
		const [seeded] = (await links.listLinks(guest())).links;
		await env.db.transaction((tx) => links.claimLinks(tx, "guest-1", "bob"));
		expect((await links.listLinks(guest())).links).toEqual([]);
		const mine = (await links.listLinks(bob())).links;
		expect(mine.every((link) => link.state === "live")).toBe(true);
		expect((await visit(seeded?.slug ?? ""))?.status).toBe(302);
		const leftover = await env.db.select().from(schema.linkClick).where(eq(schema.linkClick.ownerId, "guest-1"));
		expect(leftover).toEqual([]);
	});

	it("counts usage by accounts and guests", async () => {
		await links.createLink(alice(), newLink());
		await env.db.transaction((tx) => links.seedLinks(tx, "guest-1", "en"));
		expect(await links.linksUsage(env.db)).toEqual({ accounts: 1, guests: 1, rows: { links: 3, clicks: 40 } });
	});
});

describe("click facts", () => {
	it("classifies devices", () => {
		expect(deviceClass(null)).toBe("desktop");
		expect(deviceClass("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBe("desktop");
		expect(deviceClass("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("mobile");
		expect(deviceClass("Mozilla/5.0 (Linux; Android 13; SM-X700) Safari/537.36")).toBe("tablet");
		expect(deviceClass("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
		expect(deviceClass("Slackbot-LinkExpanding 1.0")).toBe("bot");
		expect(deviceClass("curl/8.5.0")).toBe("bot");
	});

	it("keeps only the referrer's host and a country code", () => {
		expect(referrerHost("https://www.Example.com/path?q=1")).toBe("example.com");
		expect(referrerHost("android-app://com.slack")).toBeNull();
		expect(referrerHost("not a url")).toBeNull();
		expect(countryCode(" np ")).toBe("NP");
		expect(countryCode("XX")).toBeNull();
		expect(countryCode("Nepal")).toBeNull();
		expect(clickFacts(new Headers())).toEqual({ referrerHost: null, country: null, device: "desktop" });
	});
});
