import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../auth";

/**
 * A Lichess account connected to a site user (PLAN 13.5, "Connecting Lichess"; decision
 * 0256): at most one per user (the key is the user), and a Lichess account belongs to one
 * user. The token is sealed (src/server/chaal/connect/vault.ts) and opened only inside a
 * service call; it is never logged, returned or rendered.
 */
export const chConnection = pgTable(
	"ch_connection",
	{
		userId: text()
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Lichess's id for the account: the username in lowercase. */
		lichessId: text().notNull(),
		username: text().notNull(),
		title: text(),
		/** The access token, sealed with CHAAL_TOKEN_KEY: `v1.<key id>.<iv>.<ciphertext>`. */
		token: text().notNull(),
		/** The scopes asked for when it connected (Lichess grants all of them or none). */
		scopes: jsonb().$type<string[]>().notNull().default([]),
		/** When Lichess says the token ends (about a year; there's no refresh). */
		expiresAt: timestamp({ withTimezone: true }),
		connectedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		lastUsedAt: timestamp({ withTimezone: true }),
		/** This connection's cooldown after a 429, and its length for doubling (src/server/chaal/lichess/client.ts). */
		cooldownUntil: timestamp({ withTimezone: true }),
		cooldownMs: integer().notNull().default(0),
		/** Set when Lichess refused the token (a 401): the UI offers "Reconnect". */
		revokedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		uniqueIndex("ch_connection_lichess_unique").on(table.lichessId),
		check("ch_connection_lichess_id_lower", sql`${table.lichessId} = lower(${table.lichessId})`),
	],
);
