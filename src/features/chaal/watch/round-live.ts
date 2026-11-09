import { type PgnGame, readPgn } from "../chess/pgn";
import { mainline, type TreeNode } from "../chess/tree";
import type { ChaalColor } from "../live/events";
import type { BoardResult, BroadcastBoard } from "./schema";

/**
 * A broadcast round, live (PLAN Task 82, decision 0272): `/api/stream/broadcast/round/{id}.pgn`,
 * read by the browser from Lichess. It sends every board's PGN, then a board's whole PGN
 * again each time it moves, and new boards as they're added. Each PGN names its board in
 * its `GameURL` (or `Site`), the study chapter's address.
 */

/** Lichess ends each game of a PGN stream with two empty lines. */
const SEPARATOR = /\r?\n[ \t]*\r?\n[ \t]*\r?\n/;

/** The whole games in `buffer`, and what's left of one still arriving. */
export function takeGames(buffer: string): { games: string[]; rest: string } {
	const parts = buffer.split(SEPARATOR);
	const rest = parts.pop() ?? "";
	return { games: parts.map((part) => part.trim()).filter(Boolean), rest };
}

/** A game longer than this is refused rather than buffered forever (the board's own reader stops at 500 kB). */
const MAX_GAME = 600_000;

/** A PGN stream's games, one at a time, for the stream reader (`split`). */
export async function* pgnGames(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const { games, rest } = takeGames(buffer);
			for (const game of games) yield game;
			buffer = rest;
			if (buffer.length > MAX_GAME) throw new Error("pgn game too long");
		}
		buffer += decoder.decode();
		if (buffer.trim()) yield buffer.trim();
	} finally {
		await reader.cancel().catch(() => {});
	}
}

/** A PGN stream's text as it is: games are read where they're shown. */
export const asText = (text: string): string => text;

const TAG = (name: string) => new RegExp(`\\[${name}\\s+"([^"]*)"\\]`);

/** The board a PGN is for: the last part of its `GameURL` (or `Site`), an 8-character chapter id. */
export function boardOf(pgn: string): string | null {
	for (const name of ["GameURL", "ChapterURL", "Site"]) {
		const url = TAG(name).exec(pgn)?.[1];
		const id = url?.split(/[?#]/)[0]?.split("/").at(-1);
		if (id && /^[A-Za-z0-9]{8}$/.test(id)) return id;
	}
	return null;
}

const RESULTS: Readonly<Record<string, BoardResult>> = { "1-0": "1-0", "0-1": "0-1", "1/2-1/2": "½-½", "½-½": "½-½" };

/**
 * Each side's clock after its own last move up to `count` moves into `line` (the main line,
 * without the start): PGN's `[%clk]` after each move. Null for a side with none yet.
 */
export function clocksAfter(line: ReadonlyArray<TreeNode>, count: number): Record<ChaalColor, number | null> {
	const clocks: Record<ChaalColor, number | null> = { white: null, black: null };
	for (let index = count - 1; index >= 0 && (clocks.white === null || clocks.black === null); index -= 1) {
		const node = line[index];
		if (node?.clock === undefined) continue;
		// The mover is the side not to move after it.
		const mover: ChaalColor = node.fen.split(" ")[1] === "b" ? "white" : "black";
		if (clocks[mover] === null) clocks[mover] = node.clock;
	}
	return clocks;
}

/** A game's result as a board shows it. */
export const resultOf = (game: PgnGame): BoardResult => RESULTS[game.tags.Result ?? ""] ?? "*";

/** A read game's state as a board in the grid shows it: the last position and move, the result, each side's clock. */
export function boardStateOf(game: PgnGame): Pick<BroadcastBoard, "fen" | "lastMove" | "result"> & {
	clocks: Record<ChaalColor, number | null>;
} {
	const line = mainline(game.tree);
	const last = line.at(-1);
	return {
		fen: last?.fen ?? game.tree.nodes[game.tree.root]?.fen ?? "",
		lastMove: last?.uci ?? null,
		result: resultOf(game),
		clocks: clocksAfter(line, line.length),
	};
}

/** A PGN's tag as a link to lichess.org, or null: a PGN is a broadcaster's text, so nothing else is linked. */
export function lichessAddress(value: string | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "lichess.org" ? url.href : null;
	} catch {
		return null;
	}
}

/** Reads a streamed board's PGN; null when it doesn't read (a variant, a broken move). */
export function readBoard(pgn: string): PgnGame | null {
	const read = readPgn(pgn);
	return read.ok ? read.game : null;
}

/** A board the round's first read didn't have (added since), from its PGN's tags. */
export function boardFromPgn(id: string, game: PgnGame): BroadcastBoard {
	const player = (side: "White" | "Black") => {
		const rating = Number.parseInt(game.tags[`${side}Elo`] ?? "", 10);
		const fed = game.tags[`${side}Fed`] ?? "";
		return {
			name: (game.tags[side] ?? "").trim().slice(0, 100) || "?",
			title: game.tags[`${side}Title`]?.slice(0, 4) || null,
			rating: Number.isFinite(rating) ? rating : null,
			fed: /^[A-Z]{3}$/.test(fed) ? fed : null,
			clock: null,
		};
	};
	return updatedBoard(
		{
			id,
			fen: game.tree.nodes[game.tree.root]?.fen ?? "",
			lastMove: null,
			result: "*",
			white: player("White"),
			black: player("Black"),
		},
		game,
	);
}

/** A board of the grid brought up to date by its latest PGN. */
export function updatedBoard(board: BroadcastBoard, game: PgnGame): BroadcastBoard {
	const state = boardStateOf(game);
	if (!state.fen) return board;
	return {
		...board,
		fen: state.fen,
		lastMove: state.lastMove,
		result: state.result,
		white: { ...board.white, clock: state.clocks.white ?? board.white.clock },
		black: { ...board.black, clock: state.clocks.black ?? board.black.clock },
	};
}
