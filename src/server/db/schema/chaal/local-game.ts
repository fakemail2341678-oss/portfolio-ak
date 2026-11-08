import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { TimeControl } from "@/features/chaal/chess/clock";
import type { GameResult } from "@/features/chaal/chess/rules";
import type { BoardLayout, LocalEndReason, LocalMode } from "@/features/chaal/local/types";
import { user } from "../auth";

/**
 * Local games (PLAN 13.5, `ch_local_game`; decision 0265): a game against the computer or
 * over the board, saved as it's played. The id comes from the browser (a game starts
 * there, with or without a session, and keeps its id when it's imported). The moves are
 * PGN, read move by move before they're written (src/server/chaal/local/service.ts). A
 * guest's games move to the account it signs up or in as (src/server/chaal/guest-data.ts).
 */
export const chLocalGame = pgTable(
	"ch_local_game",
	{
		id: uuid().primaryKey(),
		ownerId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		mode: text().$type<LocalMode>().notNull(),
		/** The computer's level, 1–8 (engine games). */
		level: integer(),
		/** The player's side against the computer (engine games). */
		color: text().$type<"white" | "black">(),
		/** Start and increment in seconds; null without a clock. */
		clock: jsonb().$type<TimeControl>(),
		/** Over the board: "flip" or "tablet". */
		layout: text().$type<BoardLayout>(),
		pgn: text().notNull(),
		/** Half-moves played (the history list shows it without reading the PGN). */
		moves: integer().notNull().default(0),
		/** Each side's time left after the last move, in ms. */
		clocks: jsonb().$type<{ white: number; black: number }>(),
		result: text().$type<GameResult>(),
		reason: text().$type<LocalEndReason>(),
		status: text().$type<"playing" | "ended">().notNull().default("playing"),
		/** When the game started and was last played, as the browser saw it. */
		startedAt: timestamp({ withTimezone: true }).notNull(),
		playedAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("ch_local_game_owner_played_idx").on(table.ownerId, table.playedAt)],
);
