import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";

/**
 * Habits (/apps/habits, decision 0193). Every row has `owner_id` (the user, a guest
 * included), deleted with them; the repository scopes every query by it (`ownedBy`).
 */
const owner = () =>
	text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

export const habit = pgTable(
	"habit",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		name: text().notNull(),
		/** A palette name (src/features/apps/colors.ts). */
		color: text().notNull(),
		/** The days it is meant for: bit 0 is Sunday … bit 6 Saturday (127 is every day). */
		days: smallint().notNull().default(127),
		/** Check-ins a day that count as done ("drink water" 8 times). */
		target: smallint().notNull().default(1),
		archived: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("habit_owner_idx").on(table.ownerId, table.createdAt),
		check("habit_days_valid", sql`${table.days} between 1 and 127`),
		check("habit_target_valid", sql`${table.target} between 1 and 20`),
	],
);

/** One habit on one calendar day (the app's time zone): how many times it was done. No row is zero. */
export const habitCheckin = pgTable(
	"habit_checkin",
	{
		habitId: uuid()
			.notNull()
			.references(() => habit.id, { onDelete: "cascade" }),
		ownerId: owner(),
		day: date({ mode: "string" }).notNull(),
		count: smallint().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.habitId, table.day] }),
		index("habit_checkin_owner_idx").on(table.ownerId, table.day),
		check("habit_checkin_count_positive", sql`${table.count} > 0`),
	],
);

export type HabitRow = typeof habit.$inferSelect;
export type HabitCheckinRow = typeof habitCheckin.$inferSelect;
