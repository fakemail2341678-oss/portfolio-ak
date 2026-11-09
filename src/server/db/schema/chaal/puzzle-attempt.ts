import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { PuzzleMode } from "@/features/chaal/puzzles/schema";
import { user } from "../auth";

/** Whether an attempt goes to Lichess: `pending` until a batch posts it, then `sent`; null when it never does. */
export type PuzzleSync = "pending" | "sent";

/**
 * Puzzle attempts (PLAN 13.5, `ch_puzzle_attempt`; decision 0269): one row per puzzle a
 * player finished, for the progress panel and the streak's best, and, for a player connected
 * with the puzzle scopes, posted to Lichess in batches (`lichess`). The id comes from the
 * browser, so importing a visitor's attempts into a new session is idempotent. A guest's
 * move to the account it signs up or in as (src/server/chaal/guest-data.ts).
 */
export const chPuzzleAttempt = pgTable(
	"ch_puzzle_attempt",
	{
		id: uuid().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Lichess's puzzle id. */
		puzzleId: text().notNull(),
		/** Solved without a miss, a hint or the solution. */
		won: boolean().notNull(),
		/** From the player's first turn to the end, in ms. */
		ms: integer().notNull(),
		/** The puzzle's rating, as Lichess gave it. */
		rating: integer().notNull(),
		themes: jsonb().$type<string[]>().notNull().default([]),
		mode: text().$type<PuzzleMode>().notNull(),
		/** The theme training asked for (`mix` when none): Lichess's batch is posted under it. */
		angle: text().notNull().default("mix"),
		/** In a streak, its length after this puzzle (0 after a miss): the best streak is the highest. */
		streak: integer(),
		lichess: text().$type<PuzzleSync>(),
		/** The player's puzzle rating change on Lichess, once posted. */
		ratingDiff: integer(),
		/** When it was finished, as the browser saw it. */
		at: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		index("ch_puzzle_attempt_owner_at_idx").on(table.ownerId, table.at),
		index("ch_puzzle_attempt_pending_idx").on(table.ownerId).where(sql`${table.lichess} = 'pending'`),
	],
);
