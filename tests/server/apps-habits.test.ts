import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HABITS_QUOTAS } from "@/features/apps/habits/types";
import { isAppError } from "@/lib/errors";
import { addDays } from "@/lib/i18n/date-only";
import * as habits from "@/server/apps/habits/service";
import type { AppServices } from "@/server/apps/ownership";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Habits (decision 0193) on PGlite: every call sees and changes only its caller's
 * habits, check-ins are set (and cleared) per day only within a year up to today in
 * Kathmandu, stats come out of the stored check-ins, and a guest's sample habits,
 * claim and usage work.
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

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return isAppError(error) ? error.code : "thrown";
	}
};

/** 30 October 2026, 10:00 in Kathmandu. */
const NOW = new Date("2026-10-30T04:15:00Z");
const TODAY = "2026-10-30";

const habit = (services: AppServices, patch: Partial<{ name: string; days: number; target: number }> = {}) =>
	habits.createHabit(
		services,
		{ id: crypto.randomUUID(), name: "Read", color: "violet", days: 127, target: 1, ...patch },
		NOW,
	);

const checkin = (services: AppServices, habitId: string, day: string, count = 1) =>
	habits.setCheckin(services, { habitId, day, count }, NOW);

describe("Habits ownership", () => {
	it("never shows one user's habits or check-ins to another", async () => {
		const read = await habit(alice());
		await checkin(alice(), read.id, TODAY);
		const overview = await habits.getOverview(bob(), NOW);
		expect(overview.habits).toEqual([]);
		expect(overview.checkins).toEqual([]);
		expect(await code(habits.getHabit(bob(), read.id, NOW))).toBe("NOT_FOUND");
	});

	it("refuses every change to someone else's habit as not found", async () => {
		const read = await habit(alice());
		expect(await code(habits.updateHabit(bob(), { id: read.id, name: "Mine" }))).toBe("NOT_FOUND");
		expect(await code(habits.deleteHabit(bob(), read.id))).toBe("NOT_FOUND");
		expect(await code(checkin(bob(), read.id, TODAY))).toBe("NOT_FOUND");
		expect(await env.db.select().from(schema.habitCheckin)).toEqual([]);
		expect((await habits.getHabit(alice(), read.id, NOW)).habit.name).toBe("Read");
	});
});

describe("Habit check-ins", () => {
	it("sets, changes and clears a day's count", async () => {
		const water = await habit(alice(), { name: "Water", target: 8 });
		await checkin(alice(), water.id, TODAY, 3);
		await checkin(alice(), water.id, TODAY, 8);
		expect((await habits.getOverview(alice(), NOW)).checkins).toEqual([
			{ id: `${water.id}:${TODAY}`, habitId: water.id, day: TODAY, count: 8 },
		]);
		await checkin(alice(), water.id, TODAY, 0);
		expect(await env.db.select().from(schema.habitCheckin)).toEqual([]);
	});

	it("takes today and the year before in Kathmandu, never a day ahead", async () => {
		const read = await habit(alice());
		expect(await code(checkin(alice(), read.id, addDays(TODAY, 1)))).toBe("BAD_REQUEST");
		expect(await code(checkin(alice(), read.id, addDays(TODAY, -367)))).toBe("BAD_REQUEST");
		expect(await code(checkin(alice(), read.id, addDays(TODAY, -366)))).toBe("ok");
		// 18:20 UTC on 31 December is already 1 January in Kathmandu.
		const newYear = new Date("2026-12-31T18:20:00Z");
		expect(await code(habits.setCheckin(alice(), { habitId: read.id, day: "2027-01-01", count: 1 }, newYear))).toBe(
			"ok",
		);
	});

	it("shows the last seven days in the overview, and stats from every check-in", async () => {
		const read = await habit(alice());
		// Backfilled: the habit is new, the days before it were done too.
		for (let back = 0; back < 10; back++) await checkin(alice(), read.id, addDays(TODAY, -back));
		const overview = await habits.getOverview(alice(), NOW);
		expect(overview.today).toBe(TODAY);
		expect(overview.checkins).toHaveLength(7);
		expect(overview.habits[0]).toMatchObject({ streak: 10, best: 10, rate: 1, startedOn: TODAY });
		const detail = await habits.getHabit(alice(), read.id, NOW);
		expect(detail.checkins).toHaveLength(10);
		expect(detail.habit.streak).toBe(10);
	});

	it("deletes a habit's check-ins with it, and archives without losing them", async () => {
		const read = await habit(alice());
		await checkin(alice(), read.id, TODAY);
		await habits.updateHabit(alice(), { id: read.id, archived: true });
		expect((await habits.getOverview(alice(), NOW)).habits[0]?.archived).toBe(true);
		expect(await env.db.select().from(schema.habitCheckin)).toHaveLength(1);
		await habits.deleteHabit(alice(), read.id);
		expect(await env.db.select().from(schema.habitCheckin)).toEqual([]);
	});

	it("stops at the habits quota", async () => {
		await env.db.insert(schema.habit).values(
			Array.from({ length: HABITS_QUOTAS.habits }, (_, index) => ({
				ownerId: "alice",
				name: `H${index}`,
				color: "blue",
			})),
		);
		expect(await code(habit(alice()))).toBe("CONFLICT");
	});
});

describe("Habits guests", () => {
	it("seeds sample habits in the guest's language, with streaks and gaps", async () => {
		await env.db.transaction((tx) => habits.seedHabits(tx, "guest-1", "ne", NOW));
		const overview = await habits.getOverview(guest(), NOW);
		expect(overview.habits.map((each) => each.name)).toContain("बिहानको हिँडाइ");
		const read = overview.habits.find((each) => each.target === 1 && each.days === 127);
		expect(read?.streak).toBe(9);
		expect(read?.best).toBeGreaterThanOrEqual(9);
		const water = overview.habits.find((each) => each.target === 8);
		expect(water?.rate).toBeGreaterThan(0);
		expect(water?.rate).toBeLessThan(1);
		expect(overview.checkins.some((each) => each.day === TODAY && each.count === 3)).toBe(true);
	});

	it("claims a guest's habits and check-ins into an account", async () => {
		await env.db.transaction((tx) => habits.seedHabits(tx, "guest-1", "en", NOW));
		const before = await env.db.select().from(schema.habitCheckin);
		await env.db.transaction((tx) => habits.claimHabits(tx, "guest-1", "alice"));
		expect((await habits.getOverview(guest(), NOW)).habits).toEqual([]);
		expect((await habits.getOverview(alice(), NOW)).habits).toHaveLength(3);
		const after = await env.db.select().from(schema.habitCheckin);
		expect(after).toHaveLength(before.length);
		expect(after.every((row) => row.ownerId === "alice")).toBe(true);
	});

	it("counts accounts, guests and rows for /admin/apps", async () => {
		await env.db.transaction((tx) => habits.seedHabits(tx, "guest-1", "en", NOW));
		await habit(alice());
		const usage = await habits.habitsUsage(env.db);
		expect(usage).toMatchObject({ accounts: 1, guests: 1 });
		expect(usage.rows.habits).toBe(4);
		expect(usage.rows.checkins).toBeGreaterThan(100);
	});
});
