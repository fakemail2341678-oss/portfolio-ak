import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";

/** What a row counts (PLAN 13.5, `ch_activity`). Puzzles join with Task 80. */
export type ChaalActivityKind = "connect" | "game" | "analysis" | "puzzle";

/**
 * How a game started: online against the Lichess AI, from a challenge (to a player or an
 * open link), from a seek (Task 78) or elsewhere on Lichess; or locally, against the
 * computer or over the board.
 */
export type ChaalActivityMode = "ai" | "challenge" | "seek" | "lichess" | "local-engine" | "local-board";

/**
 * Chaal's activity (PLAN 13.5; decision 0266): one row per thing a player did, for the
 * admin's overview and its daily rollups (Task 84). A deleted user's rows stay, without
 * the user. `ref` is the game's or the analysis's id, so a game the event stream restates
 * on every reconnect is counted once. Pruned after 90 days by the daily job
 * (src/server/chaal/cron.ts).
 */
export const chActivity = pgTable(
	"ch_activity",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text().references(() => user.id, { onDelete: "set null" }),
		kind: text().$type<ChaalActivityKind>().notNull(),
		mode: text().$type<ChaalActivityMode>(),
		ref: text(),
		at: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("ch_activity_at_idx").on(table.at),
		uniqueIndex("ch_activity_ref_unique").on(table.userId, table.kind, table.ref).where(sql`${table.ref} is not null`),
	],
);
