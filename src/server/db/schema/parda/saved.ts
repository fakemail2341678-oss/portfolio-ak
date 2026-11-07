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
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth";
import type { PardaMedia } from "./catalog";
import { pdProfile } from "./library";

/**
 * What a profile keeps (PLAN Task 67, decision 0240): My List and favourite titles, favourite
 * people, and likes. Every row belongs to a profile (cascade), so deleting a profile or a
 * guest deletes them. Titles are named from `pd_title`, which an add fills in.
 */

export type PardaListKind = "watchlist" | "favourite";
export type PardaRatingValue = "like" | "dislike";

/** My List (`watchlist`, watch later) and ♥ (`favourite`): one row per profile, kind and title. */
export const pdListItem = pgTable(
	"pd_list_item",
	{
		id: uuid().primaryKey().defaultRandom(),
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		kind: text().$type<PardaListKind>().notNull(),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		addedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		unique("pd_list_item_unique").on(table.profileId, table.kind, table.media, table.tmdbId),
		index("pd_list_item_recent_idx").on(table.profileId, table.kind, table.addedAt),
		check("pd_list_item_kind_valid", sql`${table.kind} in ('watchlist', 'favourite')`),
		check("pd_list_item_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/** ♥ on a person: their name and portrait as TMDB gave them when added (people have no snapshot table). */
export const pdFavouritePerson = pgTable(
	"pd_favourite_person",
	{
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		personId: integer().notNull(),
		name: text().notNull(),
		portrait: text(),
		addedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: "pd_favourite_person_pk", columns: [table.profileId, table.personId] }),
		index("pd_favourite_person_recent_idx").on(table.profileId, table.addedAt),
	],
);

/** Like or Not for me: one per profile and title; taking it back deletes the row. */
export const pdRating = pgTable(
	"pd_rating",
	{
		profileId: uuid()
			.notNull()
			.references(() => pdProfile.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		value: text().$type<PardaRatingValue>().notNull(),
		ratedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: "pd_rating_pk", columns: [table.profileId, table.media, table.tmdbId] }),
		index("pd_rating_recent_idx").on(table.profileId, table.value, table.ratedAt),
		check("pd_rating_value_valid", sql`${table.value} in ('like', 'dislike')`),
		check("pd_rating_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/**
 * An account's choices that aren't a profile's: the email digest of new episodes (Task 68
 * sends it, decision 0241) and the language it's written in, the page's when it was chosen.
 * One row per user, made when they first choose; guests have no email, so never one.
 */
export const pdAccount = pgTable("pd_account", {
	userId: text()
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	digest: boolean().notNull().default(false),
	/** "en" or "ne"; null (rows from before Task 68) is English. */
	locale: text(),
	updatedAt: timestamp({ withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
