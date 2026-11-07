import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";
import { localizedText } from "../columns";

export type PardaMedia = "movie" | "tv";

/**
 * A snapshot of the titles Parda knows (docs/guides/parda.md, decision 0229): what the
 * sitemap and filters read without calling TMDB. The daily job refreshes it.
 */
export const pdTitle = pgTable(
	"pd_title",
	{
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		title: localizedText().notNull(),
		poster: text(),
		backdrop: text(),
		year: integer(),
		genres: jsonb().$type<number[]>().notNull().default([]),
		runtime: integer(),
		/** The US certificate (the kids' cap ladder, decision 0240); null when TMDB has none or nobody asked yet. */
		certification: text(),
		/** When `certification` was last asked of TMDB: the daily job asks for the oldest first. */
		certificationCheckedAt: timestamp({ withTimezone: true }),
		/** 1 is the most popular of its media type; null once it left the top of the list. */
		popularityRank: integer(),
		refreshedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.media, table.tmdbId] }),
		check("pd_title_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/** Takedowns: a blocked title is gone from every catalogue read (src/server/parda/catalog/service.ts). */
export const pdBlockedTitle = pgTable(
	"pd_blocked_title",
	{
		id: uuid().primaryKey().defaultRandom(),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		reason: text().notNull(),
		blockedBy: text().references(() => user.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		check("pd_blocked_title_media_valid", sql`${table.media} in ('movie', 'tv')`),
		/** One takedown per title: blocking it again is a field error (decision 0237). */
		uniqueIndex("pd_blocked_title_unique").on(table.media, table.tmdbId),
	],
);
