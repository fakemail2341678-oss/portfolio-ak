import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withinCap } from "@/features/parda/kids";
import { PARTY_MAX_MEMBERS } from "@/features/parda/party/source";
import type { Session } from "@/lib/session";
import * as schema from "@/server/db/schema";
import type { PardaCatalog } from "@/server/parda/catalog/context";
import { popularTitles, titleDetails, usCertificate } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import { PARDA_GUEST_DATA } from "@/server/parda/guest-data";
import type { PardaServices } from "@/server/parda/library/service";
import * as party from "@/server/parda/party/service";
import { mintPartyToken, PARTY_TOKEN_TTL_S } from "@/server/parda/party/token";
import { recordPlay } from "@/server/parda/player/plays";
import { resolveViewer } from "@/server/parda/profiles/service";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Watch parties on PGlite (PLAN Task 69a, decision 0243): create, join, full, expired, a wrong
 * code, a blocked title, playback off, the host's rules and the daily clean-up. Each
 * party function's access is checked in tests/server/parda-access.test.ts.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const fetcher = vi.fn<typeof fetch>(async (input) => {
	const url = new URL(String(input));
	const body = readFixture(
		fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? ""),
	);
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
});
const tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fetcher,
);
const realtime = { key: "app.key:top-secret", relayUrl: null };
let time = 0;
const catalog = (): PardaCatalog => ({
	services: { tmdb, cache: createTmdbCache(), controls: createPardaControls(env.db, () => time) },
	region: "US",
	cap: null,
});
const session = (id: string): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
});
const ctx = async (id: string): Promise<PardaServices> => ({
	db: env.db,
	viewer: await resolveViewer(env.db, session(id), undefined, "en"),
	catalog: catalog(),
});
const addUser = (id: string) => env.db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` });

let movie = 0;
const create = async (id = "asha") =>
	(await party.createParty(await ctx(id), realtime, { media: "movie", id: movie }, "en")).code;
const join = async (code: string, id: string) => party.joinParty(await ctx(id), realtime, code, "en");
const row = async (code: string) => {
	const [found] = await env.db.select().from(schema.pdParty).where(eq(schema.pdParty.code, code));
	if (!found) throw new Error("no party");
	return found;
};
const blockTitle = async () => {
	await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie, reason: "A notice" });
	time += 30_001;
};
const killSwitch = async () => {
	await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
	time += 30_001;
};

beforeAll(async () => {
	env = await createTestDb();
	const first = (await popularTitles(catalog().services, { locale: "en", region: "US", cap: null }, "movie"))
		.results[0];
	movie = first?.id ?? 550;
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	await env.db.insert(schema.pdSource).values(
		[1, 2].map((server) => ({
			name: { en: `Server ${server}`, ne: `Server ${server}` },
			movieTemplate: `/${server}/movie/{id}?start={start}`,
			tvTemplate: `/${server}/tv/{id}/{season}/{episode}?start={start}`,
			adapter: "parda" as const,
			position: server,
		})),
	);
	for (const id of ["asha", "bina", "chet"]) await addUser(id);
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("creating a party", () => {
	it("makes an unguessable code, with the caller as host on a source that obeys commands", async () => {
		const code = await create();
		expect(code).toMatch(/^[\w-]{16}$/);
		const saved = await row(code);
		expect(saved).toMatchObject({ hostId: "asha", media: "movie", tmdbId: movie, state: "lobby", position: 0 });
		expect(saved.sourceId).not.toBeNull();
		expect(saved.expiresAt.getTime() - Date.now()).toBeGreaterThan(party.PARTY_IDLE_MS - 60_000);
	});

	it("starts where the host is", async () => {
		const { code } = await party.createParty(
			await ctx("asha"),
			realtime,
			{ media: "movie", id: movie, position: 321 },
			"en",
		);
		expect((await row(code)).position).toBe(321);
	});

	it("takes a source without commands only when no other can play", async () => {
		await env.db.update(schema.pdSource).set({ adapter: "none" });
		time += 30_001;
		const code = await create();
		const page = await party.partyPage(catalog(), env.db, realtime, code, { profileId: null, autoplay: true }, "en");
		expect(page.watch.sources.find((source) => source.id === page.sourceId)?.adapter).toBe("none");
	});

	it("is refused with playback off, for a blocked title, and without a key", async () => {
		const asha = await ctx("asha");
		await expect(party.createParty(asha, null, { media: "movie", id: movie }, "en")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await blockTitle();
		await expect(create()).rejects.toMatchObject({ code: "NOT_FOUND" });
		await killSwitch();
		await expect(create()).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("is rate limited", async () => {
		for (let count = 0; count < 10; count += 1) await create();
		await expect(create()).rejects.toMatchObject({ code: "RATE_LIMITED" });
	});
});

describe("joining a party", () => {
	it("takes a seat, and hands back a token for this party's channel only", async () => {
		const code = await create();
		const joined = await join(code, "bina");
		expect(joined.name).toBe("bina");
		expect(joined.hostMemberId).not.toBe(joined.memberId);
		expect(joined.connection).toMatchObject({
			channel: `parda-party:${code}`,
			clientId: joined.memberId,
			relayUrl: null,
		});
		const claims = JSON.parse(Buffer.from(joined.connection.token.split(".")[1] ?? "", "base64url").toString());
		expect(JSON.parse(claims["x-ably-capability"])).toEqual({
			[`parda-party:${code}`]: ["publish", "subscribe", "presence"],
		});
		expect(claims["x-ably-clientId"]).toBe(joined.memberId);
	});

	it("gives two people of the same name different names in the room", async () => {
		expect(party.seatName("Guest", ["Guest"])).toBe("Guest 2");
		expect(party.seatName("Guest", ["Guest", "Guest 2"])).toBe("Guest 3");
		expect(party.seatName("Sam", ["Guest"])).toBe("Sam");
		expect(party.seatName("  ", [])).toBe("?");
	});

	it("a wrong code is a 404", async () => {
		await expect(join("no-such-party-00", "bina")).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			party.partyPage(catalog(), env.db, realtime, "no-such-party-00", { profileId: null, autoplay: true }, "en"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("is full at 10, keeps a member's own seat, and frees those who left or went quiet", async () => {
		const code = await create();
		const seats = Array.from({ length: PARTY_MAX_MEMBERS - 1 }, (_, index) => `seat${index}`);
		for (const id of seats) {
			await addUser(id);
			await join(code, id);
		}
		await expect(join(code, "chet")).rejects.toMatchObject({ code: "CONFLICT" });
		// A reload is the same seat.
		await expect(join(code, "seat0")).resolves.toMatchObject({ name: "seat0" });

		await party.leaveParty(await ctx("seat0"), code);
		await join(code, "chet");
		await addUser("late");
		await expect(join(code, "late")).rejects.toMatchObject({ code: "CONFLICT" });

		const [seat1] = await env.db.select().from(schema.pdPartyMember).where(eq(schema.pdPartyMember.userId, "seat1"));
		await env.db
			.update(schema.pdPartyMember)
			.set({ seenAt: new Date(Date.now() - party.PARTY_STALE_MS - 1000) })
			.where(eq(schema.pdPartyMember.id, seat1?.id ?? ""));
		await expect(join(code, "late")).resolves.toMatchObject({ name: "late" });
	});

	it("an expired party is a 404, like one that ended", async () => {
		const code = await create();
		await env.db
			.update(schema.pdParty)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(schema.pdParty.code, code));
		await expect(join(code, "bina")).rejects.toMatchObject({ code: "NOT_FOUND" });
		const ended = await create();
		await party.endPartyAsHost(await ctx("asha"), ended);
		await expect(join(ended, "bina")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("a blocked title and the kill switch end it", async () => {
		const blocked = await create();
		await blockTitle();
		await expect(party.pulseParty(await ctx("asha"), blocked, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await row(blocked)).state).toBe("ended");
		await expect(join(blocked, "bina")).rejects.toMatchObject({ code: "NOT_FOUND" });

		await env.db.delete(schema.pdBlockedTitle);
		time += 30_001;
		const off = await create();
		await killSwitch();
		await expect(join(off, "bina")).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await row(off)).state).toBe("ended");
	});

	it("a kids' cap keeps the title's page closed, and leaves the party running", async () => {
		const code = await create();
		const details = await titleDetails(catalog().services, { locale: "en", region: "US", cap: null }, "movie", movie);
		const kids: PardaServices = { ...(await ctx("bina")), catalog: { ...catalog(), cap: "G" } };
		const seat = party.joinParty(kids, realtime, code, "en");
		if (withinCap("G", "movie", usCertificate(details))) await expect(seat).resolves.toBeDefined();
		else await expect(seat).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await row(code)).state).toBe("lobby");
	});
});

describe("the party's page", () => {
	it("needs no session, and says what's playing", async () => {
		const code = await create();
		const page = await party.partyPage(catalog(), env.db, realtime, code, { profileId: null, autoplay: true }, "en");
		expect(page).toMatchObject({ code, hostName: "asha", snapshot: { state: "lobby", position: 0 } });
		expect(page.watch.title.id).toBe(movie);
		expect(page.watch.sources.length).toBeGreaterThan(0);
	});

	it("is a 404 without a key, and the watch page hides *Watch together*", async () => {
		const code = await create();
		const page = await party.partyPage(catalog(), env.db, realtime, code, { profileId: null, autoplay: true }, "en");
		// The tests run without PARDA_REALTIME_KEY (tests/setup/env.ts).
		expect(page.watch.party).toBe(false);
		await expect(
			party.partyPage(catalog(), env.db, null, code, { profileId: null, autoplay: true }, "en"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("moves a party off a source that's gone", async () => {
		const code = await create();
		const before = (await row(code)).sourceId;
		await env.db
			.update(schema.pdSource)
			.set({ enabled: false })
			.where(eq(schema.pdSource.id, before ?? ""));
		time += 30_001;
		const page = await party.partyPage(catalog(), env.db, realtime, code, { profileId: null, autoplay: true }, "en");
		expect(page.sourceId).not.toBe(before);
		expect(page.sourceId).not.toBeNull();
		expect((await row(code)).sourceId).toBe(page.sourceId);
	});
});

describe("a pulse", () => {
	const report = (over: Partial<party.PartyStateReport> = {}): party.PartyStateReport => ({
		playing: true,
		started: true,
		position: 100,
		at: Date.now(),
		...over,
	});

	it("saves the host's state and nobody else's", async () => {
		const code = await create();
		await join(code, "bina");
		await party.pulseParty(await ctx("bina"), code, report({ position: 999 }));
		expect((await row(code)).state).toBe("lobby");
		await party.pulseParty(await ctx("asha"), code, report());
		expect(await row(code)).toMatchObject({ state: "playing", position: 100 });
	});

	it("saves at most every 10 s while nothing changes, and at once on a pause", async () => {
		const code = await create();
		const asha = await ctx("asha");
		const start = Date.now();
		await party.pulseParty(asha, code, report({ at: start }), start);
		await party.pulseParty(asha, code, report({ position: 105, at: start + 5000 }), start + 5000);
		expect((await row(code)).position).toBe(100);
		await party.pulseParty(asha, code, report({ position: 107, at: start + 7000, playing: false }), start + 7000);
		expect(await row(code)).toMatchObject({ state: "paused", position: 107 });
		await party.pulseParty(asha, code, report({ position: 120, at: start + 20_000, playing: false }), start + 20_000);
		expect((await row(code)).position).toBe(120);
	});

	it("doesn't believe a clock far from the server's", async () => {
		const code = await create();
		const now = Date.now();
		await party.pulseParty(await ctx("asha"), code, report({ at: now + 3_600_000 }), now);
		expect((await row(code)).stateAt.getTime()).toBe(now);
	});

	it("keeps the party alive, and says who's host and the time", async () => {
		const code = await create();
		const joined = await join(code, "bina");
		await env.db
			.update(schema.pdParty)
			.set({ expiresAt: new Date(Date.now() + 1000) })
			.where(eq(schema.pdParty.code, code));
		const answer = await party.pulseParty(await ctx("bina"), code, null, 5_000_000_000_000);
		expect(answer).toEqual({ now: 5_000_000_000_000, hostMemberId: joined.hostMemberId });
		expect((await row(code)).expiresAt.getTime()).toBe(5_000_000_000_000 + party.PARTY_IDLE_MS);
	});
});

describe("the host's rules", () => {
	it("a non-host can't change the source or end the party", async () => {
		const code = await create();
		await join(code, "bina");
		const other = (await env.db.select().from(schema.pdSource)).find((source) => source.position === 2);
		await expect(party.setPartySource(await ctx("bina"), code, other?.id ?? "")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(party.endPartyAsHost(await ctx("bina"), code)).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect((await row(code)).state).toBe("lobby");
	});

	it("the host changes to an enabled source only", async () => {
		const code = await create();
		const rows = await env.db.select().from(schema.pdSource);
		const other = rows.find((source) => source.id !== rows[0]?.id);
		await party.setPartySource(await ctx("asha"), code, other?.id ?? "");
		expect((await row(code)).sourceId).toBe(other?.id);
		await env.db
			.update(schema.pdSource)
			.set({ enabled: false })
			.where(eq(schema.pdSource.id, rows[0]?.id ?? ""));
		time += 30_001;
		await expect(party.setPartySource(await ctx("asha"), code, rows[0]?.id ?? "")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("a host who left hands over to the longest-present member, and to nobody else", async () => {
		const code = await create();
		const bina = await join(code, "bina");
		await join(code, "chet");
		await expect(party.takeOverParty(await ctx("bina"), code)).rejects.toMatchObject({ code: "CONFLICT" });
		await party.leaveParty(await ctx("asha"), code);
		await expect(party.takeOverParty(await ctx("chet"), code)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(party.takeOverParty(await ctx("bina"), code)).resolves.toEqual({ hostMemberId: bina.memberId });
		expect((await row(code)).hostId).toBe("bina");
		// The old host comes back as a member.
		const back = await join(code, "asha");
		expect(back.hostMemberId).toBe(bina.memberId);
	});

	it("a host who stopped reporting hands over too", async () => {
		const code = await create();
		await join(code, "bina");
		await env.db
			.update(schema.pdPartyMember)
			.set({ seenAt: new Date(Date.now() - party.PARTY_STALE_MS - 1000) })
			.where(eq(schema.pdPartyMember.userId, "asha"));
		await expect(party.takeOverParty(await ctx("bina"), code)).resolves.toBeDefined();
	});
});

describe("the token", () => {
	it("is an Ably JWT signed with the key's secret, and doesn't carry the secret", () => {
		const token = mintPartyToken("app.key:top-secret", { code: "abc", memberId: "m1" }, 1_000_000);
		const [head, claims, signature] = token.split(".");
		expect(JSON.parse(Buffer.from(head ?? "", "base64url").toString())).toEqual({
			typ: "JWT",
			alg: "HS256",
			kid: "app.key",
		});
		expect(JSON.parse(Buffer.from(claims ?? "", "base64url").toString())).toMatchObject({
			iat: 1000,
			exp: 1000 + PARTY_TOKEN_TTL_S,
			"x-ably-clientId": "m1",
		});
		expect(signature).toBe(createHmac("sha256", "top-secret").update(`${head}.${claims}`).digest("base64url"));
		expect(token).not.toContain("top-secret");
	});
});

describe("the daily job", () => {
	it("ends parties idle past their time, and deletes them a week later", async () => {
		const idle = await create();
		const live = await create();
		const now = new Date();
		await env.db
			.update(schema.pdParty)
			.set({ expiresAt: new Date(now.getTime() - 1000) })
			.where(eq(schema.pdParty.code, idle));
		expect(await party.endIdleParties(env.db, now)).toEqual({ ended: 1, deleted: 0 });
		expect((await row(idle)).state).toBe("ended");
		expect((await row(live)).state).toBe("lobby");
		expect(await party.endIdleParties(env.db, new Date(now.getTime() + 7 * 86_400_000 + 1000))).toEqual({
			ended: 1,
			deleted: 1,
		});
		const left = await env.db.select().from(schema.pdParty);
		expect(left.map((each) => each.code)).toEqual([live]);
	});
});

describe("a guest's account", () => {
	it("keeps the parties a guest hosts and sits in", async () => {
		await addUser("guest");
		await addUser("account");
		const hosted = await create("guest");
		const seated = await create("asha");
		await join(seated, "guest");
		const both = await create("asha");
		await join(both, "guest");
		await join(both, "account");
		await env.db.transaction((tx) => PARDA_GUEST_DATA.claim(tx, "guest", "account"));
		expect((await row(hosted)).hostId).toBe("account");
		const seats = await env.db.select().from(schema.pdPartyMember).where(eq(schema.pdPartyMember.userId, "account"));
		expect(seats).toHaveLength(3);
		expect(await env.db.select().from(schema.pdPartyMember).where(eq(schema.pdPartyMember.userId, "guest"))).toEqual(
			[],
		);
	});
});

describe("a party's plays", () => {
	it("are marked, so ranking leaves them out", async () => {
		const [source] = await env.db.select().from(schema.pdSource);
		const playbackId = "00000000-0000-4000-8000-000000000001";
		await recordPlay(
			env.db,
			createPardaControls(env.db, () => time),
			"account",
			{
				playbackId,
				sourceId: source?.id ?? "",
				media: "movie",
				id: movie,
				failed: false,
				startMs: 100,
				stallCount: 0,
				stallMs: 0,
				watchedS: 10,
				switchedAway: false,
				band: "unknown",
				inParty: true,
			},
		);
		const [play] = await env.db.select().from(schema.pdPlay).where(eq(schema.pdPlay.id, playbackId));
		expect(play?.inParty).toBe(true);
	});
});
