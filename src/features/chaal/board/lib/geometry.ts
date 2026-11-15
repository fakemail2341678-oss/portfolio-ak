import { FILES, type PieceCode, type Square } from "./fen";

/**
 * Where squares sit on a drawn board: columns 0–7 left to right and rows 0–7 top to
 * bottom as the player sees it, for either orientation. And which piece is which across
 * two positions, so a moved piece keeps its React key and slides (the 150 ms `ch-move`).
 */
export type Orientation = "white" | "black";
export type Cell = { col: number; row: number };

export function cellOf(square: Square, orientation: Orientation): Cell {
	const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
	const rank = Number(square[1]);
	return orientation === "white" ? { col: file, row: 8 - rank } : { col: 7 - file, row: rank - 1 };
}

export function squareAt({ col, row }: Cell, orientation: Orientation): Square | null {
	if (col < 0 || col > 7 || row < 0 || row > 7) return null;
	const file = orientation === "white" ? FILES[col] : FILES[7 - col];
	const rank = orientation === "white" ? 8 - row : row + 1;
	return `${file}${rank}` as Square;
}

/** The square under a point, from the board's box (null off the board). */
export function squareFromPoint(
	x: number,
	y: number,
	box: { left: number; top: number; width: number; height: number },
	orientation: Orientation,
): Square | null {
	if (box.width === 0 || box.height === 0) return null;
	const col = Math.floor(((x - box.left) / box.width) * 8);
	const row = Math.floor(((y - box.top) / box.height) * 8);
	return squareAt({ col, row }, orientation);
}

export type KeyedPiece = { key: string; code: PieceCode; square: Square };

const distance = (a: Square, b: Square) =>
	Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(Number(a[1]) - Number(b[1]));

/**
 * Gives each piece of the next position a key: a piece still on its square keeps its key;
 * a piece that appeared takes the key of the nearest piece of its kind that left (so a
 * move, both halves of castling, and stepping back through a game all slide); the rest
 * are new. Captured pieces simply go.
 */
export function keyPieces(previous: ReadonlyArray<KeyedPiece>, next: ReadonlyMap<Square, PieceCode>): KeyedPiece[] {
	const before = new Map(previous.map((piece) => [piece.square, piece]));
	const keyed: KeyedPiece[] = [];
	const arrived: Array<[Square, PieceCode]> = [];
	for (const [square, code] of next) {
		const stayed = before.get(square);
		if (stayed && stayed.code === code) {
			keyed.push(stayed);
			before.delete(square);
		} else arrived.push([square, code]);
	}
	const used = new Set(previous.map((piece) => piece.key));
	let fresh = 0;
	for (const [square, code] of arrived) {
		// Every piece still in `before` has left its square (or been taken there).
		const left = [...before.values()]
			.filter((piece) => piece.code === code)
			.sort((a, b) => distance(a.square, square) - distance(b.square, square))[0];
		if (left) {
			before.delete(left.square);
			keyed.push({ key: left.key, code, square });
		} else {
			while (used.has(`p${fresh}`)) fresh++;
			used.add(`p${fresh}`);
			keyed.push({ key: `p${fresh}`, code, square });
		}
	}
	return keyed;
}
