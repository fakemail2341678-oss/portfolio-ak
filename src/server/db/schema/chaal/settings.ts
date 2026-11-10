import { sql } from "drizzle-orm";
import { boolean, check, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { CommunityLimits } from "@/features/chaal/community/limits";
import type { EngineLimits } from "@/features/chaal/engine/limits";
import type { ChaalFeatureSwitches } from "@/features/chaal/features";
import type { PlayLimits } from "@/features/chaal/play/controls";
import type { PuzzleLimits } from "@/features/chaal/puzzles/limits";
import type { ChaalDefaults } from "@/features/chaal/settings/preferences";
import type { WatchLimits } from "@/features/chaal/watch/limits";
import { user } from "../auth";
import { localizedText } from "../columns";

/**
 * Chaal's controls (PLAN 13.5, decision 0254): one settings row, read at most every 5 s per
 * process (src/server/chaal/controls.ts). Columns arrive with the feature that needs them;
 * Task 71 has the feature switches, the connecting rules, the cache epoch and the public
 * lane's cooldown; Task 73 the notice under the top bar; Task 75 the engine's limits; Task 77
 * online play's; Task 79 players' defaults and maintenance; Task 80 puzzles'; Task 82 watch's; Task 83 community's. A missing row means the
 * defaults;
 * the admin edits it on /admin/chaal/settings.
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
		/** The admin's notice under Chaal's top bar, in both languages (set on /admin/chaal/settings, Task 79). */
		banner: localizedText(),
		/** The home's announcement, in both languages (set on /admin/chaal/curation, Task 84); empty English hides it. */
		announcement: localizedText(),
		/** The engine's limits in the browser (Task 75, decision 0263): depth, lines and hash. */
		engine: jsonb().$type<EngineLimits>().notNull().default({ maxDepth: 22, multiPv: 3, hashMb: 16 }),
		/** Online play's limits (Task 77, decision 0266): the Lichess AI's highest level, rated games; quick pairing's paces (Task 79). */
		play: jsonb().$type<PlayLimits>().notNull().default({ aiMaxLevel: 8, rated: true, quickPair: "all" }),
		/** Puzzles' limits (Task 80, decision 0269): how many training keeps ready, and whether the streak is offered. */
		puzzles: jsonb().$type<PuzzleLimits>().notNull().default({ ahead: 15, streak: true }),
		/** Watch's controls (Task 82, decision 0272): the TV channels shown, and whether live streamers are listed. */
		watch: jsonb()
			.$type<WatchLimits>()
			.notNull()
			.default({
				channels: ["best", "bullet", "blitz", "rapid", "classical", "ultraBullet", "bot", "computer"],
				streamers: true,
			}),
		/** Community's controls (Task 83, decision 0273): joining tournaments and teams, "Save to study", whose studies open the page. */
		community: jsonb()
			.$type<CommunityLimits>()
			.notNull()
			.default({ joinTournaments: true, joinTeams: true, saveToStudy: true, studiesBy: "lichess" }),
		/** The board, pieces and sound players start with until they choose (Task 79, decision 0268). */
		defaults: jsonb().$type<ChaalDefaults>().notNull().default({ board: "diagram", pieces: "cburnett", sounds: true }),
		/**
		 * Maintenance (Task 79, decision 0268): nothing reaches Lichess with a player's token
		 * (connecting, online play, the streams), and every page says why in `maintenanceMessage`.
		 * Public pages and what runs in the browser (analysis, the engine, local games) go on.
		 */
		maintenance: boolean().notNull().default(false),
		maintenanceMessage: localizedText(),
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
 * are refused and neither can connect. They are listed on /admin/chaal/blocks (Task 79).
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
