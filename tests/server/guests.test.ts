import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userList } from "@/features/rbac/search";
import { getDashboard } from "@/server/admin/dashboard";
import { isGuestRefusedPath } from "@/server/auth/policy";
import * as schema from "@/server/db/schema";
import { isUndeliverable, sendEmail } from "@/server/email/send";
import type { EmailProvider } from "@/server/email/types";
import { GUEST_LIFETIME_MS, guestClaimValue, readGuestClaim } from "@/server/guests/claim-cookie";
import type { GuestData } from "@/server/guests/data";
import { GUEST_DATA } from "@/server/guests/data"; // @apps
import { claimGuest, deleteExpiredGuests, seedGuest } from "@/server/guests/service";
import { listRoles, listUsers, permissionsForUser } from "@/server/rbac/repository";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * Guest sessions (decisions 0185, 0186): no permissions, never listed or counted in the
 * admin area, no email; sample data on start; their data moves to an account on claim;
 * the daily cleanup deletes week-old guests with their rows and uploads.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const NOW = new Date("2026-10-29T03:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values([
			{ id: "member", name: "Member", email: "member@example.com", role: "user" },
			{
				id: "guest-new",
				name: "Guest",
				email: "a@anonymous.placeholder.invalid",
				isAnonymous: true,
				createdAt: ago(DAY),
			},
			{
				id: "guest-old",
				name: "Guest",
				email: "b@anonymous.placeholder.invalid",
				isAnonymous: true,
				createdAt: ago(GUEST_LIFETIME_MS + DAY),
			},
		]),
	);
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

// apps:start
const notesOf = async (userId: string) =>
	(await env.db.select({ title: schema.note.title }).from(schema.note).where(eq(schema.note.ownerId, userId)))
		.map((row) => row.title)
		.sort();
// apps:end

describe("guest permissions", () => {
	it("gives a guest nothing, not even the baseline role", async () => {
		const baseline = await permissionsForUser(env.db, { id: "member", role: "user", banned: false });
		expect(baseline.length).toBeGreaterThanOrEqual(0);
		expect(
			await permissionsForUser(env.db, { id: "guest-new", role: "admin", banned: false, isAnonymous: true }),
		).toEqual([]);
	});

	it("refuses account changes, but not two-factor's sign-in steps", () => {
		for (const path of ["/change-email", "/change-password", "/delete-user", "/link-social", "/two-factor/enable"]) {
			expect(isGuestRefusedPath(path), path).toBe(true);
		}
		for (const path of [
			"/two-factor/verify-totp",
			"/two-factor/verify-backup-code",
			"/sign-in/email",
			"/sign-up/email",
		]) {
			expect(isGuestRefusedPath(path), path).toBe(false);
		}
	});
});

describe("guests in the admin area", () => {
	it("aren't listed, counted on the dashboard or in the baseline role", async () => {
		const page = await listUsers(env.db, { ...userList.defaults, page: 1, pageSize: 50 });
		expect(page.items.map((user) => user.id).sort()).toEqual(["admin-1", "member"]);
		expect(page.total).toBe(2);
		const dashboard = await getDashboard(env.db, ["users:read"], NOW);
		expect(dashboard.users?.total).toBe(2);
		await env.db.insert(schema.role).values({ key: "user", name: "User", system: true });
		const baseline = (await listRoles(env.db)).find((role) => role.key === "user");
		expect(baseline?.userCount).toBe(2);
	});
});

describe("guest email", () => {
	it("is never sent to a placeholder address", async () => {
		const sent: string[] = [];
		const provider: EmailProvider = {
			name: "console",
			send: async (message) => {
				sent.push(message.to);
				return { id: "1" };
			},
		};
		expect(isUndeliverable("x@anonymous.placeholder.invalid")).toBe(true);
		expect(isUndeliverable("someone@example.com")).toBe(false);
		await expect(
			sendEmail(
				{ to: "x@anonymous.placeholder.INVALID", template: "account-deleted", locale: "en", data: { name: "X" } },
				provider,
			),
		).rejects.toThrow(/undeliverable/);
		expect(sent).toEqual([]);
	});
});

describe("the guest_claim cookie", () => {
	it("names the guest it was signed for, and nothing else", () => {
		const value = guestClaimValue("guest-new");
		expect(readGuestClaim(value)).toBe("guest-new");
		expect(readGuestClaim(value.replace("guest-new", "member"))).toBeNull();
		expect(readGuestClaim(`${value}x`)).toBeNull();
		expect(readGuestClaim("guest-new")).toBeNull();
		expect(readGuestClaim(undefined)).toBeNull();
	});
});

/** A stand-in for an app: records what it's asked to seed and claim. */
const recorder = () => {
	const calls: string[] = [];
	const owner: GuestData = {
		slug: "recorder",
		seedGuestData: async (_tx, userId, locale) => {
			calls.push(`seed ${userId} ${locale}`);
		},
		claim: async (_tx, from, to) => {
			calls.push(`claim ${from} ${to}`);
		},
	};
	return { calls, owner };
};

describe("seed and claim", () => {
	it("gives a new guest every owner's sample data", async () => {
		const { calls, owner } = recorder();
		await seedGuest(env.db, "guest-new", "ne", [owner]);
		expect(calls).toEqual(["seed guest-new ne"]);
	});

	it("moves a guest's rows and uploads to the account, then deletes the guest", async () => {
		const { calls, owner } = recorder();
		await env.db.insert(schema.attachment).values({
			publicId: "portfolio/guest-upload",
			version: 1,
			format: "png",
			bytes: 10,
			ownerId: "guest-new",
		});
		expect(await claimGuest(env.db, "guest-new", "member", [owner])).toBe(true);
		expect(calls).toEqual(["claim guest-new member"]);
		const [upload] = await env.db.select().from(schema.attachment);
		expect(upload?.ownerId).toBe("member");
		expect(await env.db.select().from(schema.user).where(eq(schema.user.id, "guest-new"))).toEqual([]);
		// Idempotent: the guest is gone, so a second claim (the cookie's fallback) does nothing.
		expect(await claimGuest(env.db, "guest-new", "member", [owner])).toBe(false);
		expect(calls).toHaveLength(1);
	});

	it("only claims a guest, and only into an account", async () => {
		const { calls, owner } = recorder();
		expect(await claimGuest(env.db, "member", "admin-1", [owner])).toBe(false);
		expect(await claimGuest(env.db, "guest-new", "guest-old", [owner])).toBe(false);
		expect(await claimGuest(env.db, "guest-new", "guest-new", [owner])).toBe(false);
		expect(await claimGuest(env.db, "guest-new", "nobody", [owner])).toBe(false);
		expect(calls).toEqual([]);
		expect(
			await env.db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, "guest-new")),
		).toHaveLength(1);
	});

	it("undoes the whole claim when an owner fails", async () => {
		const failing: GuestData = {
			slug: "failing",
			seedGuestData: async () => undefined,
			claim: async () => {
				throw new Error("claim failed");
			},
		};
		await expect(claimGuest(env.db, "guest-new", "member", [failing])).rejects.toThrow("claim failed");
		expect(
			await env.db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, "guest-new")),
		).toHaveLength(1);
	});

	// apps:start
	it("hands the apps' rows over (Notes' sample notes)", async () => {
		expect(GUEST_DATA.map((owner) => owner.slug)).toContain("notes");
		await seedGuest(env.db, "guest-new", "en");
		const seeded = await notesOf("guest-new");
		expect(seeded.length).toBeGreaterThan(0);
		expect(await claimGuest(env.db, "guest-new", "member")).toBe(true);
		expect(await notesOf("member")).toEqual(seeded);
		expect(await notesOf("guest-new")).toEqual([]);
	});
	// apps:end
});

describe("the daily cleanup", () => {
	it("deletes week-old guests with their uploads, and nobody else", async () => {
		const cloudinary = createFakeCloudinary();
		cloudinary.put("portfolio/old-guest");
		await env.db.insert(schema.attachment).values({
			publicId: "portfolio/old-guest",
			version: 1,
			format: "png",
			bytes: 10,
			ownerId: "guest-old",
		});
		const result = await deleteExpiredGuests(env.db, cloudinary.store, NOW);
		expect(result).toEqual({ guests: 1, attachments: 1, failedAttachments: 0 });
		expect(cloudinary.destroyed).toEqual(["portfolio/old-guest"]);
		const users = await env.db.select({ id: schema.user.id }).from(schema.user);
		expect(users.map((user) => user.id).sort()).toEqual(["admin-1", "guest-new", "member"]);
		expect(await env.db.select().from(schema.attachment)).toEqual([]);
		// Nothing left to do on the next run.
		expect(await deleteExpiredGuests(env.db, cloudinary.store, NOW)).toEqual({
			guests: 0,
			attachments: 0,
			failedAttachments: 0,
		});
	});

	// apps:start
	it("takes the guests' app rows with them", async () => {
		await seedGuest(env.db, "guest-old", "en");
		await seedGuest(env.db, "guest-new", "en");
		await deleteExpiredGuests(env.db, null, NOW);
		const notes = await env.db.selectDistinct({ ownerId: schema.note.ownerId }).from(schema.note);
		expect(notes.map((row) => row.ownerId)).toEqual(["guest-new"]);
	});
	// apps:end
});
