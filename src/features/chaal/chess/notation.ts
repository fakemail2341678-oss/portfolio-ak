import { legalSans, type PlayedMove, play } from "./rules";

/**
 * How moves are written (PLAN 13.5, "Notation"): figurine SAN on screen, which reads the
 * same in English and Nepali (♘f3), letters in PGN (Nf3); the annotator's symbols for
 * NAGs; and the move input, which takes what a person types ("nf3", "e2e4", "0-0", "♘f3").
 */

const FIGURINES: Readonly<Record<string, string>> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };
const LETTERS: Readonly<Record<string, string>> = { "♔": "K", "♕": "Q", "♖": "R", "♗": "B", "♘": "N" };

/** "Nf3" → "♘f3", "e8=Q+" → "e8=♕+"; the move's letters otherwise unchanged. */
export function figurine(san: string): string {
	return san
		.replace(/^[KQRBN]/, (piece) => FIGURINES[piece] ?? piece)
		.replace(/=([QRBN])/, (_, piece: string) => `=${FIGURINES[piece] ?? piece}`);
}

/** SAN as the player chose to read it. */
export const showSan = (san: string, notation: "figurine" | "letters") =>
	notation === "figurine" ? figurine(san) : san;

/**
 * The annotator's symbols (NAGs, PGN's "$n"), the ones a game or an analysis shows beside a
 * move or after it. Others stay in the PGN and aren't shown.
 */
const NAG_SYMBOLS: Readonly<Record<number, string>> = {
	1: "!",
	2: "?",
	3: "!!",
	4: "??",
	5: "!?",
	6: "?!",
	7: "□",
	10: "=",
	13: "∞",
	14: "⩲",
	15: "⩱",
	16: "±",
	17: "∓",
	18: "+−",
	19: "−+",
	22: "⨀",
	23: "⨀",
	32: "⟳",
	33: "⟳",
	36: "→",
	37: "→",
	40: "↑",
	41: "↑",
	132: "⇆",
	133: "⇆",
	146: "N",
};

export const nagSymbol = (nag: number): string | null => NAG_SYMBOLS[nag] ?? null;

/** The move suffixes PGN allows after SAN, as their NAGs (`e4!` is `e4 $1`). */
export const SUFFIX_NAGS: Readonly<Record<string, number>> = { "!": 1, "?": 2, "!!": 3, "??": 4, "!?": 5, "?!": 6 };

/** Typed text with figurines, check marks, suffixes and zeros made plain SAN. */
const plain = (text: string) =>
	text
		.trim()
		.replace(/[♔♕♖♗♘]/g, (glyph) => LETTERS[glyph] ?? glyph)
		.replace(/[+#!?]+$/, "")
		.replaceAll("0", "O");

const bare = (san: string) => san.replace(/[+#]$/, "");

/** A move without what people leave out: case, the capture's "x", and which piece of two ("Nbd7" → "nd7"). */
const loose = (san: string) => {
	const lower = bare(san).toLowerCase();
	return /^[kqrbn]/.test(lower)
		? lower.replace(/^([kqrbn])[a-h]?[1-8]?x?(?=[a-h][1-8])/, "$1")
		: lower.replace("x", "");
};

export type TypedMove = { ok: true; move: PlayedMove } | { ok: false; reason: "empty" | "illegal" | "ambiguous" };

/**
 * The move a person typed: SAN in any case ("nf3", "Nf3", "exd5", "O-O"), UCI ("g1f3",
 * "e7e8q") or figurines, and SAN with less in it ("ne5" for Nxe5, "nd2" when one knight
 * can go there). Exact SAN wins ("bxc5" is the pawn); text that fits two moves ("bc5",
 * "nd2" for two knights) is "ambiguous".
 */
export function readTypedMove(fen: string, text: string): TypedMove {
	const typed = plain(text);
	if (!typed) return { ok: false, reason: "empty" };
	const exact = play(fen, typed);
	if (exact) return { ok: true, move: exact };
	const sans = legalSans(fen);
	for (const same of [
		(san: string) => bare(san).toLowerCase() === typed.toLowerCase(),
		(san: string) => loose(san) === loose(typed),
	]) {
		const matches = sans.filter(same);
		if (matches.length > 1) return { ok: false, reason: "ambiguous" };
		const only = matches[0] ? play(fen, matches[0]) : null;
		if (only) return { ok: true, move: only };
	}
	return { ok: false, reason: "illegal" };
}

/** Legal moves that start with what's typed (any case), for the move input's suggestions. */
export function moveSuggestions(fen: string, text: string, limit = 6): string[] {
	const typed = plain(text).toLowerCase();
	if (!typed) return [];
	return legalSans(fen)
		.filter((san) => bare(san).toLowerCase().startsWith(typed))
		.slice(0, limit);
}
