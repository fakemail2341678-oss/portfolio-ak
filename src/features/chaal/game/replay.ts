import type { Score } from "../chess/eval";
import { type Color, type GameEndReason, type GameResult, play, START_FEN, turnOf } from "../chess/rules";
import { addMove, createTree, type GameTree } from "../chess/tree";
import type { ChaalReplay, Judgement } from "../players/schema";
import { endingOf } from "./live-game";

/**
 * A finished game on Lichess, replayed (Task 81, decision 0271). Pure: the page builds the
 * tree once, from the start (or the game's position) through Lichess's SAN, with each
 * move's clock, eval and judgement on its node, so the kit's move list shows the
 * annotator's symbols and the eval graph reads the scores.
 */

/** Lichess's judgements as the annotator's symbols (NAGs): ?!, ? and ??. */
export const JUDGEMENT_NAGS: Readonly<Record<Judgement, number>> = { inaccuracy: 6, mistake: 2, blunder: 4 };

export type ReplayLine = {
	tree: GameTree;
	/** The node at each ply: `ids[0]` is the start, `ids[n]` the position after move n. */
	ids: string[];
	/** The moves in UCI, for the analysis board's link. */
	uci: string[];
	startFen: string;
};

export function replayLine(game: Pick<ChaalReplay, "initialFen" | "moves" | "clocks" | "analysis">): ReplayLine {
	const startFen = game.initialFen ?? START_FEN;
	let tree = createTree(startFen);
	const ids = [tree.root];
	const uci: string[] = [];
	let fen = startFen;
	for (const [index, san] of game.moves.entries()) {
		const move = play(fen, san);
		// Lichess's moves are legal; a move that doesn't read ends the replay there.
		if (!move) break;
		const analysis = game.analysis?.[index];
		const clock = game.clocks?.[index];
		const added = addMove(tree, ids[ids.length - 1] ?? tree.root, move, {
			...(clock !== undefined ? { clock } : {}),
			...(analysis?.eval ? { eval: analysis.eval } : {}),
			...(analysis?.judgement ? { nags: [JUDGEMENT_NAGS[analysis.judgement]] } : {}),
		});
		tree = added.tree;
		ids.push(added.id);
		uci.push(move.uci);
		fen = move.fen;
	}
	return { tree, ids, uci, startFen };
}

/**
 * Each side's clock in the position after `ply` moves: what it showed after its last move
 * so far, or the starting time before its first. Null for a game without a clock.
 */
export function clocksAt(
	game: Pick<ChaalReplay, "clock" | "clocks">,
	startFen: string,
	ply: number,
): Record<Color, number> | null {
	if (!game.clock) return null;
	const start = game.clock.initial * 1000;
	const clocks = { white: start, black: start };
	const first = turnOf(startFen);
	for (let index = 0; index < ply; index += 1) {
		const ms = game.clocks?.[index];
		if (ms === undefined) break;
		const mover: Color = (index % 2 === 0) === (first === "white") ? "white" : "black";
		clocks[mover] = ms;
	}
	return clocks;
}

/** How the game ended, as the result banner says it; null for an aborted game. */
export function replayEnding(
	game: Pick<ChaalReplay, "status" | "winner">,
): { result: GameResult; reason: GameEndReason | null } | null {
	// A draw Lichess ended by its own rules is a "draw" status: the banner says the result only.
	const ending = endingOf({ status: game.status, winner: game.winner });
	if (!ending || ending.aborted || !ending.result) return null;
	return { result: ending.result, reason: ending.reason };
}

/** The scores by move, for the eval graph: null where Lichess has none. */
export const replayScores = (game: Pick<ChaalReplay, "analysis" | "moves">): Array<Score | null> =>
	game.moves.map((_, index) => game.analysis?.[index]?.eval ?? null);
