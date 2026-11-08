import { type PlayedMove, play } from "../chess/rules";

/**
 * An engine's line (UCI) as moves to show (Task 75): each with its SAN, the position after
 * it and its number, played from `fen` until a move isn't legal (a line from a position
 * that has since changed). At most `limit` moves: a line is read at a glance.
 */
export type LineMove = { uci: string; san: string; number: string | null; fen: string };

export function lineMoves(fen: string, moves: ReadonlyArray<string>, limit = 12): LineMove[] {
	const out: LineMove[] = [];
	let position = fen;
	for (const [index, uci] of moves.slice(0, limit).entries()) {
		const move: PlayedMove | null = play(position, uci);
		if (!move) break;
		const [, turn, , , , full] = position.split(" ");
		const white = turn === "w";
		out.push({
			uci,
			san: move.san,
			// "9." before White's moves, "9…" before a line that starts with Black's.
			number: white ? `${full}.` : index === 0 ? `${full}…` : null,
			fen: move.fen,
		});
		position = move.fen;
	}
	return out;
}
