import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth";
import type { PardaMedia } from "./catalog";
import { pdSource } from "./playback";

/**
 * A viewer's side of Parda (docs/guides/parda.md, decision 0236): profiles, progress and
 * what the Continue watching rail hides. Every row belongs to a profile, and every
 * profile to a user (guests included), so deleting a guest deletes its rows.
 */

export const pdProfile = pgTable(
	"pd_profile",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text().notNull(),
		avatar: text(),
		kids: boolean().notNull().default(false),
		/** A kids' profile's certification cap; null uses the admin's default. */
		cap: text(),
		pinHash: text(),
		/** Null follows the admin's default region. */
		region: text(),
		audioLanguage: text(),
		/** Up next plays the next episode on its own (a 10 s countdown). */
		autoplay: boolean().notNull().default(true),
		/** The profile `requirePardaViewer` creates: one per owner. */
		isDefault: boolean().notNull().default(false),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("pd_profile_owner_idx").on(table.ownerId),
		uniqueIndex("pd_profile_default_unique").on(table.ownerId).where(sql`${table.isDefault}`),
	],
);

/**
 * Where a profile is in a movie or an episode (PLAN 12.5, "Progress"): one row per
 * episode (a movie has no season or episode), the source that played it, and whether it
 * finished by playing or by a mark.
 */
export const pdProgress = pgTable(
	"pd_progress",
	{
		id: uuid().primaryKey().defaultRandom(),
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		season: integer(),
		episode: integer(),
		/** Seconds, as the player reported them. */
		watched: integer().notNull().default(0),
		duration: integer(),
		sourceId: uuid().references(() => pdSource.id, { onDelete: "set null" }),
		finished: boolean().notNull().default(false),
		/** Set by "Mark watched": finished without playing. */
		marked: boolean().notNull().default(false),
		updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		unique("pd_progress_episode_unique")
			.on(table.profileId, table.media, table.tmdbId, table.season, table.episode)
			.nullsNotDistinct(),
		index("pd_progress_recent_idx").on(table.profileId, table.updatedAt),
		check("pd_progress_media_valid", sql`${table.media} in ('movie', 'tv')`),
		check(
			"pd_progress_episode_valid",
			sql`(${table.media} = 'movie' and ${table.season} is null and ${table.episode} is null) or (${table.media} = 'tv' and ${table.season} is not null and ${table.episode} is not null)`,
		),
	],
);

/**
 * Per profile and title: *Remove* hides it from Continue watching until it's played again
 * (a later progress row), and *Rewatch* starts it over, so rows older than `rewatchAt`
 * no longer count (they stay for History, Task 67).
 */
export const pdContinueState = pgTable(
	"pd_continue_state",
	{
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		hiddenAt: timestamp({ withTimezone: true }),
		rewatchAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.profileId, table.media, table.tmdbId] }),
		check("pd_continue_state_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);
