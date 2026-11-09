import { sql } from "drizzle-orm";
import { boolean, check, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { EngineLimits } from "@/features/chaal/engine/limits";
import type { ChaalFeatureSwitches } from "@/features/chaal/features";
import type { PlayLimits } from "@/features/chaal/play/controls";
import { user } from "../auth";
import { localizedText } from "../columns";

/**
 * Chaal's controls (PLAN 13.5, decision 0254): one settings row, read at most every 5 s per
 * process (src/server/chaal/controls.ts). Columns arrive with the feature that needs them;
 * Task 71 has the feature switches, the connecting rules, the cache epoch and the public
 * lane's cooldown; Task 73 the notice under the top bar; Task 75 the engine's limits; Task 77
 * online play's. A missing row means the defaults.
 */
export const chSettings = pgTable(
	"ch_settings",
	{
		id: integer().primaryKey().default(1),
		/** Feature switches: a feature is on unless it's here as false (src/features/chaal/features.ts). */
		features: jsonb().$type<ChaalFeatureSwitches>().notNull().default({}),
		/** Whether a guest session may connect Lichess (a guest's connection moves to the account it signs up as). */
		guestsMayConnect: boolean().notNull().default(true),
		/** Scopes connecting asks for on top of the enabled features' (LICHESS_SCOPES only). */
		extraScopes: jsonb().$type<string[]>().notNull().default([]),
		/** Part of every Lichess cache key: bumping it purges the cache. */
		cacheEpoch: integer().notNull().default(0),
		/** The public lane's cooldown after a 429 (src/server/chaal/lichess/client.ts), and its length for doubling. */
		publicCooldownUntil: timestamp({ withTimezone: true }),
		publicCooldownMs: integer().notNull().default(0),
		/** The admin's notice under Chaal's top bar, in both languages (its form arrives with Task 79). */
		banner: localizedText(),
		/** The engine's limits in the browser (Task 75, decision 0263): depth, lines and hash. Its form arrives with Task 79. */
		engine: jsonb().$type<EngineLimits>().notNull().default({ maxDepth: 22, multiPv: 3, hashMb: 16 }),
		/** Online play's limits (Task 77, decision 0266): the Lichess AI's highest level, rated games. Its form arrives with Task 79. */
		play: jsonb().$type<PlayLimits>().notNull().default({ aiMaxLevel: 8, rated: true }),
		version: integer().notNull().default(1),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [check("ch_settings_one_row", sql`${table.id} = 1`)],
);

/**
 * Blocks (PLAN 13.5): a site user or a Lichess account Chaal refuses. A blocked user's calls
 * are refused and neither can connect. The admin's page for them arrives with Task 79.
 */
export const chBlock = pgTable(
	"ch_block",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text().references(() => user.id, { onDelete: "cascade" }),
		/** A Lichess account's id: its username in lowercase. */
		lichessId: text(),
		reason: text().notNull(),
		blockedBy: text().references(() => user.id, { onDelete: "set null" }),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		check("ch_block_one_target", sql`(${table.userId} is null) <> (${table.lichessId} is null)`),
		check("ch_block_lichess_id_lower", sql`${table.lichessId} = lower(${table.lichessId})`),
		uniqueIndex("ch_block_user_unique").on(table.userId),
		uniqueIndex("ch_block_lichess_unique").on(table.lichessId),
	],
);
