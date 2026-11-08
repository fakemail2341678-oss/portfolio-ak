import { checkFen } from "../chess/rules";

/**
 * What a player pasted into "Import" (PLAN Task 75): a Lichess game (its address or id),
 * a FEN, or PGN. Read in that order: an id is eight letters and digits, a FEN has its
 * slashes, and anything else is tried as PGN.
 */
export type ImportKind =
	| { kind: "lichess"; id: string }
	| { kind: "fen"; fen: string }
	| { kind: "bad-fen"; reason: "format" | "kings" | "check" }
	| { kind: "pgn"; text: string }
	| { kind: "empty" };

/** A Lichess game's id from its id or address: lichess.org/AbCd1234, …/AbCd1234wxyz (a player's view), …/black, #12. */
export function lichessGameId(input: string): string | null {
	const match = input
		.trim()
		.match(
			/^(?:https?:\/\/)?(?:www\.)?(?:lichess\.org\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(?:white|black))?\/?(?:[?#]\S*)?$/,
		);
	// An eight-letter word on its own ("Ruy_Lopez" isn't one, "e4e5Nf3c" could be) needs a digit or the address.
	if (!match?.[1]) return null;
	const bare = !/lichess\.org\//.test(input);
	return bare && !/\d/.test(match[1]) ? null : match[1];
}

export function readImport(input: string): ImportKind {
	const text = input.trim();
	if (!text) return { kind: "empty" };
	const id = lichessGameId(text);
	if (id) return { kind: "lichess", id };
	if (!text.includes("\n") && text.split("/").length === 8) {
		const fen = checkFen(text);
		return fen.ok ? { kind: "fen", fen: fen.fen } : { kind: "bad-fen", reason: fen.reason };
	}
	return { kind: "pgn", text };
}
