import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { ChaalFeaturedKind, ChaalHomeSectionKey } from "@/features/chaal/home/curation";
import { localizedText } from "../columns";
import type { ChaalActivityMode } from "./activity";

/**
 * What the admin curates for Chaal's home, and the overview's rollup (PLAN Task 84,
 * decision 0274). The home reads the curation through the controls' 5 s cache; only the
 * admin reads the rollup.
 */

/**
 * A featured broadcast, tournament (arena or Swiss), study or puzzle theme: Lichess's id
 * (a theme's key), the title the home shows in both languages (empty Nepali: the English),
 * its place in its section, and the dates it shows between (Kathmandu's, either open).
 */
export const chFeatured = pgTable(
	"ch_featured",
	{
		id: uuid().primaryKey().defaultRandom(),
		kind: text().$type<ChaalFeaturedKind>().notNull(),
		ref: text().notNull(),
		title: localizedText().notNull(),
		startsOn: date({ mode: "string" }),
		endsOn: date({ mode: "string" }),
		position: integer().notNull().default(0),
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("ch_featured_ref_unique").on(table.kind, table.ref),
		index("ch_featured_position_idx").on(table.position),
		check("ch_featured_kind_valid", sql`${table.kind} in ('broadcast', 'arena', 'swiss', 'study', 'theme')`),
		check("ch_featured_dates_valid", sql`${table.startsOn} <= ${table.endsOn}`),
	],
);

/**
 * The home's sections under the hero, in the admin's order, each with a switch. No rows
 * means the default order (src/features/chaal/home/curation.ts); a section added in code
 * joins at the end.
 */
export const chHomeSection = pgTable("ch_home_section", {
	key: text().$type<ChaalHomeSectionKey>().primaryKey(),
	position: integer().notNull().default(0),
	visible: boolean().notNull().default(true),
});

/**
 * One finished UTC day of `ch_activity` (and `ch_puzzle_attempt`'s solved puzzles), by the
 * daily job (src/server/chaal/daily.ts). It outlives the activity's 90 days. `players`
 * counts that day's distinct users.
 */
export const chDailyStat = pgTable("ch_daily_stat", {
	day: date({ mode: "string" }).primaryKey(),
	players: integer().notNull().default(0),
	connects: integer().notNull().default(0),
	games: jsonb().$type<Partial<Record<ChaalActivityMode, number>>>().notNull().default({}),
	puzzles: integer().notNull().default(0),
	puzzlesSolved: integer().notNull().default(0),
	analyses: integer().notNull().default(0),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
