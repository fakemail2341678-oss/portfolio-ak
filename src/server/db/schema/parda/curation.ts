import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { localizedText } from "../columns";
import type { PardaMedia } from "./catalog";

/**
 * What the admin curates, and the overview's rollup (PLAN Task 69, decision 0242). All of
 * it is read through the controls' 30 s cache, except the rollup (only the admin reads it).
 */

export type PardaLayoutPage = "home" | "movies" | "series" | "anime";

const PAGE_CHECK = (column: unknown) => sql`${column} in ('home', 'movies', 'series', 'anime')`;

/**
 * A billboard slot: a title on a page's billboard between two dates (Kathmandu's, either
 * open), before what the page's rail brings. An empty tagline keeps TMDB's.
 */
export const pdBillboard = pgTable(
	"pd_billboard",
	{
		id: uuid().primaryKey().defaultRandom(),
		page: text().$type<PardaLayoutPage>().notNull(),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		tagline: localizedText(),
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
		index("pd_billboard_page_idx").on(table.page, table.position),
		check("pd_billboard_page_valid", PAGE_CHECK(table.page)),
		check("pd_billboard_media_valid", sql`${table.media} in ('movie', 'tv')`),
		check("pd_billboard_dates_valid", sql`${table.startsOn} <= ${table.endsOn}`),
	],
);

/** A collection the admin puts together: a page at /app/parda/c/{slug}, and a rail where the layout places it. */
export const pdCollection = pgTable(
	"pd_collection",
	{
		id: uuid().primaryKey().defaultRandom(),
		slug: text().notNull(),
		name: localizedText().notNull(),
		description: localizedText(),
		published: boolean().notNull().default(false),
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("pd_collection_slug_unique").on(table.slug)],
);

export const pdCollectionItem = pgTable(
	"pd_collection_item",
	{
		collectionId: uuid()
			.notNull()
			.references(() => pdCollection.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		position: integer().notNull().default(0),
	},
	(table) => [
		primaryKey({ name: "pd_collection_item_pk", columns: [table.collectionId, table.media, table.tmdbId] }),
		check("pd_collection_item_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/**
 * A page's saved layout: one row per rail in order, by the rail's id in code
 * (`catalog/rails.ts`) or `c-{collection}`. A page with no rows shows the config's order,
 * and a rail added in code later joins at the end (`mergedRails`, decision 0242).
 */
export const pdRail = pgTable(
	"pd_rail",
	{
		page: text().$type<PardaLayoutPage>().notNull(),
		key: text().notNull(),
		collectionId: uuid().references(() => pdCollection.id, { onDelete: "cascade" }),
		position: integer().notNull().default(0),
		visible: boolean().notNull().default(true),
	},
	(table) => [
		primaryKey({ name: "pd_rail_pk", columns: [table.page, table.key] }),
		check("pd_rail_page_valid", PAGE_CHECK(table.page)),
	],
);

/**
 * One finished day of `pd_play`, by UTC day (the daily job, `player/daily.ts`). It outlives
 * the plays' 90 days. `viewers` counts that day's distinct `pd_play.viewer_key`s.
 */
export const pdDailyStat = pgTable("pd_daily_stat", {
	day: date({ mode: "string" }).primaryKey(),
	accountPlays: integer().notNull().default(0),
	guestPlays: integer().notNull().default(0),
	anonymousPlays: integer().notNull().default(0),
	failed: integer().notNull().default(0),
	viewers: integer().notNull().default(0),
	watchedS: integer().notNull().default(0),
	updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
