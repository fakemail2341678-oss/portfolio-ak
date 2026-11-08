import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { GameTree } from "@/features/chaal/chess/tree";
import { user } from "../auth";

/**
 * "My analyses" (PLAN 13.5, `ch_analysis`; decision 0264): a saved analysis board, its
 * game tree as jsonb (variations, comments, NAGs and arrows), checked move by move before
 * it's written (src/server/chaal/analysis/service.ts). Owned by a site user, guests
 * included; a guest's move to the account they sign up or in as
 * (src/server/chaal/guest-data.ts).
 */
export const chAnalysis = pgTable(
	"ch_analysis",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text().notNull(),
		/** The tree (src/features/chaal/chess/tree.ts), at most PGN's 2,000 moves. */
		tree: jsonb().$type<GameTree>().notNull(),
		/** The root's position: the start, or a FEN the analysis began from. */
		startFen: text().notNull(),
		/** The PGN tags it came with (White, Black, Event…), for the list and the export. */
		tags: jsonb().$type<Record<string, string>>().notNull().default({}),
		/** The side the board was drawn from. */
		orientation: text().$type<"white" | "black">().notNull().default("white"),
		/** Moves in the tree, variations included (the list shows it; the tree isn't read for that). */
		moves: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp({ withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("ch_analysis_owner_updated_idx").on(table.ownerId, table.updatedAt)],
);
