/**
 * The piece placement of a FEN (its first field), for drawings that need no rules: the
 * home's diagram and, from Task 74, every MiniBoard. Legal moves, SAN and the rest come
 * from chess.js in Task 74's game model.
 */
export type PieceCode = "wK" | "wQ" | "wR" | "wB" | "wN" | "wP" | "bK" | "bQ" | "bR" | "bB" | "bN" | "bP";
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

const PIECES: Readonly<Record<string, PieceCode>> = {
	K: "wK",
	Q: "wQ",
	R: "wR",
	B: "wB",
	N: "wN",
	P: "wP",
	k: "bK",
	q: "bQ",
	r: "bR",
	b: "bB",
	n: "bN",
	p: "bP",
};

/** Square to piece; throws on a placement that isn't eight ranks of eight squares. */
export function placementOf(fen: string): Map<Square, PieceCode> {
	const rows = (fen.trim().split(/\s+/)[0] ?? "").split("/");
	if (rows.length !== 8) throw new Error(`Not a FEN placement: ${fen}`);
	const board = new Map<Square, PieceCode>();
	rows.forEach((row, index) => {
		const rank = RANKS[index];
		let file = 0;
		for (const char of row) {
			if (/[1-8]/.test(char)) {
				file += Number(char);
				continue;
			}
			const piece = PIECES[char];
			const name = FILES[file];
			if (!piece || !name || rank === undefined) throw new Error(`Not a FEN placement: ${fen}`);
			board.set(`${name}${rank}`, piece);
			file += 1;
		}
		if (file !== 8) throw new Error(`Not a FEN placement: ${fen}`);
	});
	return board;
}

/** Light or dark: a1 is dark. */
export const isDarkSquare = (fileIndex: number, rank: number) => (fileIndex + rank) % 2 === 1;
