import { sql } from "drizzle-orm";
import { check, doublePrecision, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { PartyState } from "../../../../features/parda/party/types";
import { user } from "../auth";
import type { PardaMedia } from "./catalog";
import { pdSource } from "./playback";

/**
 * Watch parties (PLAN 12.5, "Watch party"; decision 0243). The realtime channel is the
 * live truth: these rows are for late joiners, reloads and the rules only the server can
 * keep (who's in, who's host, when it ends). A party is reached by its unguessable code
 * and never listed.
 */
export const pdParty = pgTable(
	"pd_party",
	{
		id: uuid().primaryKey().defaultRandom(),
		code: text().notNull().unique(),
		hostId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		media: text().$type<PardaMedia>().notNull(),
		tmdbId: integer().notNull(),
		season: integer(),
		episode: integer(),
		/** One source for everyone: timecodes differ between sources. */
		sourceId: uuid().references(() => pdSource.id, { onDelete: "set null" }),
		state: text().$type<PartyState>().notNull().default("lobby"),
		position: doublePrecision().notNull().default(0),
		stateAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		/** 12 h after the last sign of life; the daily job ends what's past it. */
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("pd_party_expires_idx").on(table.expiresAt),
		check("pd_party_state_valid", sql`${table.state} in ('lobby', 'playing', 'paused', 'ended')`),
		check("pd_party_media_valid", sql`${table.media} in ('movie', 'tv')`),
	],
);

/**
 * Who's in a party. The channel knows this member by the row's id, so the others never
 * see a user id. A seat is free again once its member left or stopped reporting.
 */
export const pdPartyMember = pgTable(
	"pd_party_member",
	{
		id: uuid().primaryKey().defaultRandom(),
		partyId: uuid()
			.notNull()
			.references(() => pdParty.id, { onDelete: "cascade" }),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text().notNull(),
		joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		seenAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		leftAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		unique("pd_party_member_unique").on(table.partyId, table.userId),
		index("pd_party_member_user_idx").on(table.userId),
	],
);
