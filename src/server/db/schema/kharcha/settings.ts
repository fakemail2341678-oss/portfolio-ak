import { sql } from "drizzle-orm";
import { check, date, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { StoredKharchaSettings } from "@/features/kharcha/settings";

/**
 * Kharcha's controls (docs/guides/kharcha.md): one row. `settings` holds only what the
 * admin changed; the defaults are in code (src/features/kharcha/settings.ts), so a missing
 * row and `{}` both mean the defaults, and a new setting needs no migration. The admin
 * edits it on /admin/kharcha/settings (Task 96), saved with `version`.
 */
export const khSettings = pgTable(
	"kh_settings",
	{
		id: integer().primaryKey().default(1),
		settings: jsonb().$type<StoredKharchaSettings>().notNull().default({}),
		version: integer().notNull().default(1),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [check("kh_settings_one_row", sql`${table.id} = 1`)],
);

/**
 * The admin's overview (Task 96, decision 0290): one row per UTC day, written by the daily
 * job from the rows as they stood. Counts only, never an amount or a name (0186). The rows
 * they count can go later (the trash, expired guests and invites); these stay.
 *
 * - `people`: accounts that started Kharcha that day; `guests`: guests who tried it.
 * - `active`: accounts that did anything that day (their `kh_activity`), guests apart.
 * - `expenses`, `groups`, `payments`, `receipts`: made that day.
 * - `invites_sent`: invites made; `invites_accepted`: invites taken that day.
 */
export const khDailyStat = pgTable("kh_daily_stat", {
	day: date({ mode: "string" }).primaryKey(),
	people: integer().notNull().default(0),
	guests: integer().notNull().default(0),
	active: integer().notNull().default(0),
	expenses: integer().notNull().default(0),
	groups: integer().notNull().default(0),
	payments: integer().notNull().default(0),
	receipts: integer().notNull().default(0),
	invitesSent: integer().notNull().default(0),
	invitesAccepted: integer().notNull().default(0),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
