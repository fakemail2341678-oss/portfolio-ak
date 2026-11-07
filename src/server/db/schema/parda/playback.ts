import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { PardaSourceAdapter } from "../../../../features/parda/player/adapters/types";
import type {
	PardaBand,
	PardaReportKind,
	PardaReportStatus,
	PardaViewerKind,
} from "../../../../features/parda/player/playback";
import { user } from "../auth";
import { localizedText } from "../columns";
import type { PardaMedia } from "./catalog";

/**
 * Parda's playback controls (docs/guides/parda.md, decision 0230). A source is a row
 * the admin manages; a source's code is only its adapter. `pd_settings` holds one row.
 */

export type PardaSourceSandbox = "none" | "popups" | "strict";
export type PardaSourceOrder = "auto" | "manual";

export const pdSettings = pgTable(
	"pd_settings",
	{
		id: integer().primaryKey().default(1),
		/** TMDB has no NP region: certifications and watch providers fall back to this one. */
		region: text().notNull().default("US"),
		languages: jsonb().$type<string[]>().notNull().default(["en", "ne"]),
		kidsCap: text().notNull().default("PG"),
		banner: localizedText(),
		/** The kill switch: off, no player loads anywhere. */
		playbackEnabled: boolean().notNull().default(true),
		/** Part of every catalogue cache key: bumping it purges the cache. */
		cacheEpoch: integer().notNull().default(0),
		sourceOrder: text().$type<PardaSourceOrder>().notNull().default("auto"),
		version: integer().notNull().default(1),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		check("pd_settings_one_row", sql`${table.id} = 1`),
		check("pd_settings_source_order_valid", sql`${table.sourceOrder} in ('auto', 'manual')`),
	],
);

export const pdSource = pgTable(
	"pd_source",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: localizedText().notNull(),
		/** Absolute https URLs, or paths under PARDA_PLAYER_BASE (else this app's placeholder routes). Tokens: src/features/parda/player/templates.ts. */
		movieTemplate: text().notNull(),
		tvTemplate: text().notNull(),
		/** The origins an absolute template may use and messages may come from. Empty for a relative template. */
		origins: jsonb().$type<string[]>().notNull().default([]),
		adapter: text().$type<PardaSourceAdapter>().notNull().default("none"),
		sandbox: text().$type<PardaSourceSandbox>().notNull().default("none"),
		/** The admin's word on an adaptive stream; null takes the probe's (decision 0238). */
		adaptive: boolean(),
		/** The admin's word on the top quality, in pixels of height; null takes the probe's. */
		quality: integer(),
		needsClick: boolean().notNull().default(false),
		/** Rows that fail together share a group: falling back skips to another group first. */
		cdnGroup: text(),
		autoFallback: boolean().notNull().default(true),
		enabled: boolean().notNull().default(true),
		pinned: boolean().notNull().default(false),
		position: integer().notNull().default(0),
		version: integer().notNull().default(1),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		check("pd_source_adapter_valid", sql`${table.adapter} in ('parda', 'viduki', 'none')`),
		check("pd_source_sandbox_valid", sql`${table.sandbox} in ('none', 'popups', 'strict')`),
		check("pd_source_quality_valid", sql`${table.quality} between 144 and 4320`),
	],
);

/**
 * One row per playback (PLAN 12.5, "pd_play"; decision 0236): what Task 65a's ranking
 * reads. The watch page makes the id, so later reports update the same row. No user,
 * IP or user agent: only the kind of viewer, and `viewer_key`, a keyed hash that changes
 * each UTC day, so a day's viewers can be counted and no one can be followed across days
 * (decision 0242).
 */
export const pdPlay = pgTable(
	"pd_play",
	{
		id: uuid().primaryKey(),
		viewerKind: text().$type<PardaViewerKind>().notNull(),
		viewerKey: text(),
		sourceId: uuid().references(() => pdSource.id, { onDelete: "set null" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		season: integer(),
		episode: integer(),
		failed: boolean().notNull().default(false),
		failReason: text(),
		/** From setting the iframe's src to the first moving position; null if it never moved. */
		startMs: integer(),
		stallCount: integer().notNull().default(0),
		stallMs: integer().notNull().default(0),
		watchedS: integer().notNull().default(0),
		switchedAway: boolean().notNull().default(false),
		band: text().$type<PardaBand>().notNull().default("unknown"),
		inParty: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("pd_play_source_idx").on(table.sourceId, table.createdAt),
		/** The rollup's window (decision 0238): the last 7 days, every source at once. */
		index("pd_play_created_idx").on(table.createdAt),
		check("pd_play_viewer_kind_valid", sql`${table.viewerKind} in ('account', 'guest', 'anonymous')`),
		check("pd_play_band_valid", sql`${table.band} in ('slow', 'ok', 'unknown')`),
		check("pd_play_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/** A viewer's *Report a problem* (PLAN 12.5): the admin works through them in Task 65. */
export const pdReport = pgTable(
	"pd_report",
	{
		id: uuid().primaryKey().defaultRandom(),
		kind: text().$type<PardaReportKind>().notNull(),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		season: integer(),
		episode: integer(),
		sourceId: uuid().references(() => pdSource.id, { onDelete: "set null" }),
		note: text().notNull().default(""),
		status: text().$type<PardaReportStatus>().notNull().default("open"),
		reporterId: text().references(() => user.id, { onDelete: "set null" }),
		resolvedBy: text().references(() => user.id, { onDelete: "set null" }),
		resolvedAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("pd_report_status_idx").on(table.status, table.createdAt),
		index("pd_report_source_idx").on(table.sourceId),
		check(
			"pd_report_kind_valid",
			sql`${table.kind} in ('not-playing', 'wrong-title', 'quality', 'audio-subtitles', 'ads', 'other')`,
		),
		check("pd_report_status_valid", sql`${table.status} in ('open', 'resolved', 'dismissed')`),
		check("pd_report_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);
