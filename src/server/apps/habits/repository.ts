import "@tanstack/react-start/server-only";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { isAppColor } from "@/features/apps/colors";
import type { IsoDate } from "@/lib/i18n/date-only";
import { ownedBy } from "@/server/apps/ownership";
import { type HabitRow, habit, habitCheckin, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Habits' data access (decision 0193). Every function takes the owner and scopes by
 * it (`ownedBy`), so one user's call never reads or changes another's habits.
 */

export async function listHabits(db: Db, ownerId: string): Promise<HabitRow[]> {
	return db.select().from(habit).where(ownedBy(habit, ownerId)).orderBy(asc(habit.createdAt), asc(habit.id));
}

export async function getHabit(db: Db | Tx, ownerId: string, id: string): Promise<HabitRow | null> {
	const [row] = await db
		.select()
		.from(habit)
		.where(and(eq(habit.id, id), ownedBy(habit, ownerId)));
	return row ?? null;
}

/** The owner's check-ins (of one habit, when given) from `since` on. */
export async function checkins(db: Db, ownerId: string, options: { habitId?: string; since?: IsoDate } = {}) {
	return db
		.select({ habitId: habitCheckin.habitId, day: habitCheckin.day, count: habitCheckin.count })
		.from(habitCheckin)
		.where(
			and(
				ownedBy(habitCheckin, ownerId),
				options.habitId ? eq(habitCheckin.habitId, options.habitId) : undefined,
				options.since ? gte(habitCheckin.day, options.since) : undefined,
			),
		)
		.orderBy(asc(habitCheckin.day));
}

export const countHabits = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(habit).where(ownedBy(habit, ownerId)))[0]?.total ?? 0;

export type NewHabit = {
	id?: string;
	name: string;
	color: string;
	days: number;
	target: number;
	createdAt?: Date;
};

export async function insertHabits(tx: Tx, ownerId: string, habits: ReadonlyArray<NewHabit>): Promise<HabitRow[]> {
	if (habits.length === 0) return [];
	return tx
		.insert(habit)
		.values(habits.map((each) => ({ ...each, color: isAppColor(each.color) ? each.color : "slate", ownerId })))
		.returning();
}

export async function updateHabit(
	tx: Tx,
	ownerId: string,
	id: string,
	set: Partial<Pick<HabitRow, "name" | "color" | "days" | "target" | "archived">>,
): Promise<HabitRow | null> {
	const [row] = await tx
		.update(habit)
		.set(set)
		.where(and(eq(habit.id, id), ownedBy(habit, ownerId)))
		.returning();
	return row ?? null;
}

export async function deleteHabit(tx: Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await tx
		.delete(habit)
		.where(and(eq(habit.id, id), ownedBy(habit, ownerId)))
		.returning({ id: habit.id });
	return rows.length > 0;
}

/** Sets a day's count (0 removes the row). */
export async function setCheckin(tx: Tx, ownerId: string, habitId: string, day: IsoDate, value: number) {
	if (value === 0) {
		await tx
			.delete(habitCheckin)
			.where(and(eq(habitCheckin.habitId, habitId), eq(habitCheckin.day, day), ownedBy(habitCheckin, ownerId)));
		return;
	}
	await tx
		.insert(habitCheckin)
		.values({ habitId, ownerId, day, count: value })
		.onConflictDoUpdate({ target: [habitCheckin.habitId, habitCheckin.day], set: { count: value } });
}

export async function insertCheckins(
	tx: Tx,
	ownerId: string,
	rows: ReadonlyArray<{ habitId: string; day: IsoDate; count: number }>,
) {
	if (rows.length > 0) await tx.insert(habitCheckin).values(rows.map((row) => ({ ...row, ownerId })));
}

/** Moves every habit and check-in of a guest to an account (decision 0186). */
export async function transferHabits(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(habitCheckin).set({ ownerId: toUserId }).where(ownedBy(habitCheckin, fromUserId));
	await tx.update(habit).set({ ownerId: toUserId }).where(ownedBy(habit, fromUserId));
}

/** Usage for /admin/apps: how many accounts and guests have a habit, and the rows. */
export async function habitsUsage(db: Db) {
	const [owners] = await db
		.select({
			accounts:
				sql<number>`count(distinct ${habit.ownerId}) filter (where not coalesce(${user.isAnonymous}, false))`.mapWith(
					Number,
				),
			guests: sql<number>`count(distinct ${habit.ownerId}) filter (where ${user.isAnonymous})`.mapWith(Number),
			habits: count(),
		})
		.from(habit)
		.innerJoin(user, eq(user.id, habit.ownerId));
	const [checkinRows] = await db.select({ total: count() }).from(habitCheckin);
	return {
		accounts: owners?.accounts ?? 0,
		guests: owners?.guests ?? 0,
		rows: { habits: owners?.habits ?? 0, checkins: checkinRows?.total ?? 0 },
	};
}
