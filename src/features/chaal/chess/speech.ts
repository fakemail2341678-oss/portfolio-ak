import { m } from "@/paraglide/messages";
import type { Color } from "./rules";

/**
 * A move in words, for the board's live region (PLAN 13.5, "Keyboard and screen readers"):
 * "Knight to f3, check", "घोडा f3 मा, चेक". Read from SAN alone, so a move list, a stream
 * or a PGN can be spoken without replaying the game. Call it at render time (messages).
 */

const SAN = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?([+#])?/;

const pieceName = (letter: string | undefined): string => {
	switch (letter) {
		case "K":
			return m.ch_piece_king();
		case "Q":
			return m.ch_piece_queen();
		case "R":
			return m.ch_piece_rook();
		case "B":
			return m.ch_piece_bishop();
		case "N":
			return m.ch_piece_knight();
		default:
			return m.ch_piece_pawn();
	}
};

/** A piece's name from its letter in either case ("n", "N"); anything else is a pawn. */
export const pieceWord = (letter: string) => pieceName(letter.toUpperCase());

export const sideName = (color: Color) => (color === "white" ? m.ch_white() : m.ch_black());

/** The move itself: "Knight to f3", "Pawn takes d5, promotes to queen, check", "Castles kingside". */
export function spokenMove(san: string): string {
	const suffix = /[+#]/.exec(san)?.[0];
	let words: string;
	if (san.startsWith("O-O-O")) words = m.ch_say_castle_long();
	else if (san.startsWith("O-O")) words = m.ch_say_castle_short();
	else {
		const match = SAN.exec(san);
		if (!match) return san;
		const [, letter, file, rank, takes, square = "", promotion] = match;
		// A piece named by its file or rank ("Nbd7") says so; a pawn's file is implied.
		const hint = letter ? `${file ?? ""}${rank ?? ""}` : "";
		const piece = hint ? `${pieceName(letter)} ${hint}` : pieceName(letter);
		words = takes ? m.ch_say_capture({ piece, square }) : m.ch_say_move({ piece, square });
		if (promotion) words = m.ch_say_promote({ move: words, piece: pieceName(promotion) });
	}
	if (suffix === "#") return m.ch_say_mate({ move: words });
	if (suffix === "+") return m.ch_say_check({ move: words });
	return words;
}

/** "Black: knight to f6", for a move announced as it happens. */
export const spokenTurn = (san: string, color: Color) =>
	m.ch_say_side({ side: sideName(color), move: spokenMove(san) });
