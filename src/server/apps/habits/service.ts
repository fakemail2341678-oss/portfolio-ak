import "@tanstack/react-start/server-only";
import { type AppColor, isAppColor } from "@/features/apps/colors";
import { heatmapStart } from "@/features/apps/habits/heatmap";
import type { CheckinInput, CreateHabitInput, UpdateHabitInput } from "@/features/apps/habits/schema";
import { habitStats } from "@/features/apps/habits/streaks";
import {
	CHECKIN_DAYS_BACK,
	checkinId,
	EVERY_DAY,
	HABITS_QUOTAS,
	type HabitDetail,
	type HabitSummary,
	type HabitsOverview,
	RATE_DAYS,
	STRIP_DAYS,
} from "@/features/apps/habits/types";
import { ruleError } from "@/lib/errors";
import { addDays, type IsoDate, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { AppServices } from "@/server/apps/ownership";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { HabitRow } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import * as repo from "./repository";

/**
 * Habits' rules (decision 0193): every call acts on the caller's own habits (the
 * repository scopes by owner), a quota per user, check-ins only for today and the
 * year before (in the app's time zone). Streaks and rates come from
 * src/features/apps/habits/streaks.ts, the same code the tests check. Not audited:
 * app data isn't an admin action (0186).
 */

const color = (value: string): AppColor => (isAppColor(value) ? value : "slate");

const toSummary = (row: HabitRow, counts: ReadonlyMap<IsoDate, number>, today: IsoDate): HabitSummary => {
	const startedOn = todayInZone(APP_TIME_ZONE, row.createdAt);
	return {
		id: row.id,
		name: row.name,
		color: color(row.color),
		days: row.days,
		target: row.target,
		archived: row.archived,
		startedOn,
		...habitStats({ days: row.days, target: row.target, startedOn }, counts, today, RATE_DAYS),
	};
};

/** Check-ins grouped by habit, as day -> count. */
const byHabit = (rows: ReadonlyArray<{ habitId: string; day: IsoDate; count: number }>) => {
	const grouped = new Map<string, Map<IsoDate, number>>();
	for (const row of rows) {
		let days = grouped.get(row.habitId);
		if (!days) {
			days = new Map();
			grouped.set(row.habitId, days);
		}
		days.set(row.day, row.count);
	}
	return grouped;
};

/** The list page: every habit with its stats, and the strip's check-ins (the last STRIP_DAYS days). */
export async function getOverview({ db, user }: AppServices, now = new Date()): Promise<HabitsOverview> {
	const today = todayInZone(APP_TIME_ZONE, now);
	const [habits, rows] = await Promise.all([repo.listHabits(db, user.id), repo.checkins(db, user.id)]);
	const grouped = byHabit(rows);
	const stripStart = addDays(today, -(STRIP_DAYS - 1));
	return {
		habits: habits.map((row) => toSummary(row, grouped.get(row.id) ?? new Map(), today)),
		checkins: rows
			.filter((row) => row.day >= stripStart && row.day <= today)
			.map((row) => ({ id: checkinId(row.habitId, row.day), ...row })),
		today,
	};
}

/** A habit's page: its stats and its check-ins since the heatmap's first day. */
export async function getHabit({ db, user }: AppServices, id: string, now = new Date()): Promise<HabitDetail> {
	const today = todayInZone(APP_TIME_ZONE, now);
	const row = await repo.getHabit(db, user.id, id);
	if (!row) throw notFound("Habit");
	const rows = await repo.checkins(db, user.id, { habitId: id });
	const counts = new Map(rows.map((each) => [each.day, each.count]));
	const start = heatmapStart(today);
	return {
		habit: toSummary(row, counts, today),
		checkins: rows.filter((each) => each.day >= start).map(({ day, count }) => ({ day, count })),
		today,
	};
}

export async function createHabit({ db, user }: AppServices, input: CreateHabitInput, now = new Date()) {
	return db.transaction(async (tx) => {
		await lockQuota(tx, `habits:${user.id}`);
		if ((await repo.countHabits(tx, user.id)) >= HABITS_QUOTAS.habits) {
			throw ruleError("CONFLICT", "Habits quota reached", m.habits_quota({ max: formatNumber(HABITS_QUOTAS.habits) }));
		}
		// Created at the caller's now, which also decides the day the habit starts (its first rate day).
		const [row] = await repo.insertHabits(tx, user.id, [{ ...input, createdAt: now }]);
		if (!row) throw new Error("Habit insert returned no row");
		return toSummary(row, new Map(), todayInZone(APP_TIME_ZONE, now));
	});
}

export async function updateHabit({ db, user }: AppServices, { id, ...set }: UpdateHabitInput): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.updateHabit(tx, user.id, id, set))) throw notFound("Habit");
	});
}

export async function deleteHabit({ db, user }: AppServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.deleteHabit(tx, user.id, id))) throw notFound("Habit");
	});
}

/** Sets a day's count for one of the caller's habits: today or up to a year back, never ahead. */
export async function setCheckin({ db, user }: AppServices, input: CheckinInput, now = new Date()): Promise<void> {
	const today = todayInZone(APP_TIME_ZONE, now);
	if (input.day > today || input.day < addDays(today, -CHECKIN_DAYS_BACK)) {
		throw ruleError("BAD_REQUEST", "Check-in day out of range", m.habits_error_day());
	}
	await db.transaction(async (tx) => {
		if (!(await repo.getHabit(tx, user.id, input.habitId))) throw notFound("Habit");
		await repo.setCheckin(tx, user.id, input.habitId, input.day, input.count);
	});
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/** Mon–Fri: bits 1 to 5. */
const WEEKDAYS = 0b011_1110;

/**
 * A new guest's sample habits (decision 0186), in the language they started in, begun
 * two months ago, with a history that gives each a streak, a best and gaps (and the
 * heatmap something to draw).
 */
export async function seedHabits(tx: Tx, userId: string, locale: Locale, now = new Date()): Promise<void> {
	const t = { locale };
	const createdAt = new Date(now.getTime() - 60 * 86_400_000);
	const [read, walk, water] = await repo.insertHabits(tx, userId, [
		{ name: m.habits_seed_read({}, t), color: "violet", days: EVERY_DAY, target: 1, createdAt },
		{ name: m.habits_seed_walk({}, t), color: "green", days: WEEKDAYS, target: 1, createdAt },
		{ name: m.habits_seed_water({}, t), color: "blue", days: EVERY_DAY, target: 8, createdAt },
	]);
	if (!read || !walk || !water) return;
	const today = todayInZone(APP_TIME_ZONE, now);
	const rows: Array<{ habitId: string; day: IsoDate; count: number }> = [];
	for (let back = 1; back <= 60; back++) {
		const day = addDays(today, -back);
		// Reading: every day of the last 9, and most days before (a gap every 5th).
		if (back <= 9 || back % 5 !== 0) rows.push({ habitId: read.id, day, count: 1 });
		// Walking: most days, missing every 4th (weekends don't count either way).
		if (back % 4 !== 0) rows.push({ habitId: walk.id, day, count: 1 });
		// Water: some of the 8 glasses every day, all of them most days.
		rows.push({ habitId: water.id, day, count: back % 3 === 0 ? 5 : 8 });
	}
	rows.push({ habitId: water.id, day: today, count: 3 });
	await repo.insertCheckins(tx, userId, rows);
}

export const claimHabits = (tx: Tx, fromUserId: string, toUserId: string) =>
	repo.transferHabits(tx, fromUserId, toUserId);

export const habitsUsage = repo.habitsUsage;
