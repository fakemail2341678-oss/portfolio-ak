import { z } from "zod";
import { LOCAL_END_REASONS, LOCAL_GAMES_MAX, type LocalGameRecord } from "./types";

/**
 * A local game as it travels (PLAN Task 76, decision 0265): what saving and importing send,
 * and what reading returns. The shape is checked here; the PGN is read move by move on the
 * server (`fromRecord`) before it's stored.
 */

/** A game's PGN, at most: 2,000 moves with their clocks fit well inside. */
export const LOCAL_PGN_MAX = 100_000;

const timeControlSchema = z.strictObject({
	initial: z.number().int().min(0).max(10_800),
	increment: z.number().int().min(0).max(180),
});

const ms = z.number().int().min(0).max(36_000_000);
const iso = z.iso.datetime({ offset: true });

export const localGameRecordSchema = z
	.strictObject({
		id: z.uuid(),
		mode: z.enum(["engine", "board"]),
		level: z.number().int().min(1).max(8).nullable(),
		color: z.enum(["white", "black"]).nullable(),
		clock: timeControlSchema.nullable(),
		layout: z.enum(["flip", "tablet"]).nullable(),
		pgn: z.string().min(1).max(LOCAL_PGN_MAX),
		clocks: z.strictObject({ white: ms, black: ms }).nullable(),
		result: z.enum(["1-0", "0-1", "1/2-1/2"]).nullable(),
		reason: z.enum(LOCAL_END_REASONS).nullable(),
		status: z.enum(["playing", "ended"]),
		createdAt: iso,
		updatedAt: iso,
	})
	.refine(
		(game) =>
			game.mode === "engine"
				? game.level !== null && game.color !== null && game.layout === null
				: game.level === null && game.color === null && game.layout !== null,
		{ message: "The mode's fields don't match", path: ["mode"] },
	)
	.refine(
		(game) => (game.result === null) === (game.reason === null) && (game.status === "ended") === (game.result !== null),
		{
			message: "The result, reason and status don't match",
			path: ["status"],
		},
	)
	.refine((game) => (game.clock === null) === (game.clocks === null), {
		message: "Clocks without a time control",
		path: ["clocks"],
	});

export const saveLocalGameInput = z.strictObject({ game: localGameRecordSchema });

export const importLocalGamesInput = z.strictObject({
	games: z.array(localGameRecordSchema).max(LOCAL_GAMES_MAX),
});

/** A row of the history list: what the hub shows without reading the moves. */
export type LocalGameSummary = Omit<LocalGameRecord, "pgn"> & { moves: number };

export const summaryOfRecord = (record: LocalGameRecord, moves: number): LocalGameSummary => {
	const { pgn: _pgn, ...rest } = record;
	return { ...rest, moves };
};
