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
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import type { Localized } from "@/lib/i18n/localized";
import { pdProfile } from "./library";

/**
 * New-episode alerts (PLAN Task 68, decision 0241). A series is followed by a profile that
 * has it in My List or ♥, or played or marked it in the last six months; the daily job
 * checks each followed series once, here, and tells every profile following it.
 */

/**
 * What the daily check last saw of a followed series: its latest aired episode, and when
 * the next one airs. One row per series for all profiles, so each is asked of TMDB once a
 * day however many follow it. The first check only records where the series is.
 */
export const pdFollowState = pgTable(
	"pd_follow_state",
	{
		tmdbId: integer().primaryKey(),
		lastSeason: integer(),
		lastEpisode: integer(),
		lastAirDate: date({ mode: "string" }),
		nextAirDate: date({ mode: "string" }),
		/** TMDB says it ended or was cancelled: checked weekly, not daily. */
		ended: boolean().notNull().default(false),
		checkedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("pd_follow_state_checked_idx").on(table.checkedAt)],
);

/** What an alert shows without asking TMDB: the series' name in both languages and its poster. */
export type PardaNotificationData = {
	title: Localized;
	poster: string | null;
	backdrop: string | null;
	/** The latest new episode's name, as TMDB gave it in English. */
	name: string;
	/** "YYYY-MM-DD": when the latest new episode aired. */
	airDate: string | null;
};

/**
 * A profile's alerts: new episodes of a series it follows, from `season`/`episode` to
 * `lastEpisode` of that season (a whole season can arrive at once). The bell lists them;
 * an account that chose the digest gets the unread ones by email once (`emailed_at`).
 */
export const pdNotification = pgTable(
	"pd_notification",
	{
		id: uuid().primaryKey().defaultRandom(),
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		kind: text().$type<"episode">().notNull().default("episode"),
		tmdbId: integer().notNull(),
		season: integer().notNull(),
		episode: integer().notNull(),
		lastEpisode: integer().notNull(),
		data: jsonb().$type<PardaNotificationData>().notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		readAt: timestamp({ withTimezone: true }),
		/** Claimed by the digest (sent, or skipped because it was read). */
		emailedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		unique("pd_notification_unique").on(table.profileId, table.tmdbId, table.season, table.lastEpisode),
		index("pd_notification_recent_idx").on(table.profileId, table.createdAt),
		index("pd_notification_digest_idx").on(table.createdAt).where(sql`${table.emailedAt} is null`),
		check("pd_notification_kind_valid", sql`${table.kind} in ('episode')`),
		check("pd_notification_range_valid", sql`${table.lastEpisode} >= ${table.episode}`),
	],
);
