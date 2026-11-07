import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { PardaMedia } from "./catalog";
import { pdSource } from "./playback";

/**
 * Source ranking (PLAN 12.5, "Source ranking"; decision 0238). The daily job rolls the
 * last 7 days of `pd_play` up per source and connection band, adds the probe's numbers
 * and stores each source's score; the watch page orders sources from the latest day.
 */

/** `all` is every band together: the row that carries the probe's numbers and the score. */
export type PardaStatBand = "all" | "slow" | "ok" | "unknown";

export const pdSourceStat = pgTable(
	"pd_source_stat",
	{
		/** The UTC day the rollup ran: its window is the 7 days before it ran. */
		day: date({ mode: "string" }).notNull(),
		sourceId: uuid()
			.notNull()
			.references(() => pdSource.id, { onDelete: "cascade" }),
		band: text().$type<PardaStatBand>().notNull(),
		plays: integer().notNull().default(0),
		failed: integer().notNull().default(0),
		switchedAway: integer().notNull().default(0),
		/** Over the plays whose player moved; null when none did. */
		startMedianMs: integer(),
		startP90Ms: integer("start_p90_ms"),
		stallCount: integer().notNull().default(0),
		stallMs: bigint({ mode: "number" }).notNull().default(0),
		watchedS: bigint({ mode: "number" }).notNull().default(0),
		// The `all` row only: the probe's numbers over the same window, then the score.
		/** The probe's runs and how many of them played. */
		probeRuns: integer().notNull().default(0),
		probeAlive: integer().notNull().default(0),
		/** The highest picture the probe saw (pixels), and whether the stream had a ladder. */
		probeHeight: integer(),
		probeAdaptive: boolean(),
		probePopups: integer().notNull().default(0),
		probeClicks: integer().notNull().default(0),
		probedAt: timestamp({ withTimezone: true }),
		/** Null: no data at all, so the source keeps its seed position. */
		score: real(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.sourceId, table.day, table.band] }),
		index("pd_source_stat_day_idx").on(table.day),
		check("pd_source_stat_band_valid", sql`${table.band} in ('all', 'slow', 'ok', 'unknown')`),
	],
);

/**
 * One probe run of one source on one title (`POST /api/parda/probe`). What a page can see
 * from outside a player: whether it played, how fast, how high, popups per click, top-page
 * redirects and the hosts its video came from. Nothing from the responses themselves.
 */
export const pdSourceProbe = pgTable(
	"pd_source_probe",
	{
		id: uuid().primaryKey().defaultRandom(),
		sourceId: uuid()
			.notNull()
			.references(() => pdSource.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		season: integer(),
		episode: integer(),
		alive: boolean().notNull(),
		startMs: integer(),
		/** The tallest picture seen, from the video element or the stream's ladder. */
		topHeight: integer(),
		/** The heights the stream offers (`RESOLUTION=` in `#EXTM3U`): more than one is adaptive. */
		ladder: jsonb().$type<number[]>().notNull().default([]),
		popups: integer().notNull().default(0),
		clicks: integer().notNull().default(0),
		redirects: integer().notNull().default(0),
		videoHosts: jsonb().$type<string[]>().notNull().default([]),
		error: text(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("pd_source_probe_source_idx").on(table.sourceId, table.createdAt),
		check("pd_source_probe_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/**
 * Recent failures of a source on one title (PLAN 12.5, "At click"): the second failed
 * playback within 24 h skips the source for that title for 24 h. One row per source and
 * title, counted from the first failure of the current 24 h.
 */
export const pdSourceTitleFail = pgTable(
	"pd_source_title_fail",
	{
		sourceId: uuid()
			.notNull()
			.references(() => pdSource.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		failures: integer().notNull().default(1),
		firstAt: timestamp({ withTimezone: true }).notNull(),
		/**
		 * A hash of who reported the first failure (the rate limiter's key, hashed again):
		 * only a failure from someone else counts, so one client can't hide a source. Gone
		 * with the row, at most 48 h later.
		 */
		firstClient: text().notNull(),
		/** Set by the second failure; the source is skipped for this title until then. */
		skipUntil: timestamp({ withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.media, table.tmdbId, table.sourceId] }),
		check("pd_source_title_fail_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);
