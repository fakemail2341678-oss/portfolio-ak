import { describe, expect, it } from "vitest";
import { type PlayedMove, play, START_FEN } from "@/features/chaal/chess/rules";
import { movesInPgn } from "@/features/chaal/local/browser";
import {
	addLocalMove,
	analysisLineOf,
	canTakeBack,
	computerToMove,
	endLocalGame,
	fenOf,
	flagResult,
	fromRecord,
	localGamePgn,
	newLocalGame,
	resignResult,
	stateOf,
	takeBack,
	toRecord,
} from "@/features/chaal/local/game";
import { localGameRecordSchema } from "@/features/chaal/local/schema";
import type { LocalGame } from "@/features/chaal/local/types";

/**
 * Local games' model (PLAN Task 76, decision 0265): starting, moves and the board's own
 * endings, takebacks with their clocks, resigning, flags and FIDE 6.9, the record and its
 * PGN, and what the schema refuses.
 */
const ID = "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const AT = new Date("2026-11-09T10:00:00.000Z");

const engineGame = (color: "white" | "black" = "white", clock: LocalGame["clock"] = null) =>
	newLocalGame({ mode: "engine", level: 3, color, clock }, ID, AT);
const boardGame = (clock: LocalGame["clock"] = { initial: 300, increment: 3 }) =>
	newLocalGame({ mode: "board", clock, layout: "flip" }, ID, AT);

function moved(game: LocalGame, uci: string, clocks: LocalGame["clocks"] = null): LocalGame {
	const played = play(fenOf(game), uci) as PlayedMove;
	expect(played).not.toBeNull();
	return addLocalMove(game, played, clocks, AT);
}

const playAll = (game: LocalGame, line: string[]) => line.reduce((current, uci) => moved(current, uci), game);

describe("local games", () => {
	it("starts a game against the computer or over the board", () => {
		const engine = engineGame("black", { initial: 600, increment: 0 });
		expect(engine).toMatchObject({ mode: "engine", level: 3, color: "black", layout: null, startFen: START_FEN });
		expect(engine.clocks).toEqual({ white: 600_000, black: 600_000 });
		expect(computerToMove(engine)).toBe(true);
		const random = newLocalGame({ mode: "engine", level: 12, color: "random", clock: null }, ID, AT, () => 0.9);
		expect(random).toMatchObject({ color: "black", level: 8, clocks: null });
		expect(boardGame()).toMatchObject({ mode: "board", level: null, color: null, layout: "flip" });
	});

	it("ends on the board by itself: fool's mate", () => {
		const game = playAll(boardGame(null), ["f2f3", "e7e5", "g2g4", "d8h4"]);
		expect(game.result).toBe("0-1");
		expect(game.reason).toBe("checkmate");
		// A finished game takes no more moves.
		expect(addLocalMove(game, { uci: "a2a3", san: "a3", fen: START_FEN }, null, AT)).toBe(game);
	});

	it("takes back one move over the board and two against the computer, with their clocks", () => {
		let game = boardGame();
		game = moved(game, "e2e4", { white: 290_000, black: 300_000 });
		game = moved(game, "e7e5", { white: 290_000, black: 280_000 });
		const back = takeBack(game, AT);
		expect(back.moves.map((move) => move.uci)).toEqual(["e2e4"]);
		expect(back.clocks).toEqual({ white: 290_000, black: 300_000 });

		let engine = engineGame("white");
		expect(canTakeBack(engine)).toBe(false);
		engine = playAll(engine, ["e2e4", "e7e5", "g1f3"]);
		// The computer hasn't answered yet: back to before the player's move.
		expect(takeBack(engine, AT).moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5"]);
		engine = moved(engine, "b8c6");
		expect(takeBack(engine, AT).moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5"]);

		// Playing Black, the computer's first move can't be taken back.
		const asBlack = moved(engineGame("black"), "e2e4");
		expect(canTakeBack(asBlack)).toBe(false);
		expect(canTakeBack(moved(asBlack, "c7c5"))).toBe(true);
		expect(takeBack(moved(moved(asBlack, "c7c5"), "g1f3"), AT).moves).toHaveLength(1);
	});

	it("resigns, agrees and claims", () => {
		expect(resignResult("white")).toBe("0-1");
		const ended = endLocalGame(boardGame(), resignResult("black"), "resign", AT);
		expect(ended).toMatchObject({ result: "1-0", reason: "resign" });
		expect(endLocalGame(ended, "1/2-1/2", "agreement", AT)).toBe(ended);
		// Knights out and back twice: the third time is a claim, not an end.
		const repeated = playAll(boardGame(null), ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
		expect(stateOf(repeated).claim).toBe("threefold");
		expect(repeated.result).toBeNull();
	});

	it("a flag wins unless the other side can't mate (FIDE 6.9)", () => {
		expect(flagResult(START_FEN, "white")).toEqual({ result: "0-1", reason: "timeout" });
		// Black has a lone king: White's flag is a draw.
		expect(flagResult("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "white")).toEqual({
			result: "1/2-1/2",
			reason: "timeout-draw",
		});
		// A knight against a lone king can't mate; against a king and pawn it can.
		expect(flagResult("4k3/8/8/8/8/8/8/1N2K3 b - - 0 1", "black").reason).toBe("timeout-draw");
		expect(flagResult("4k3/4p3/8/8/8/8/8/1N2K3 b - - 0 1", "black")).toEqual({ result: "1-0", reason: "timeout" });
	});

	it("stores a game as PGN and reads it back", () => {
		let game = engineGame("white", { initial: 180, increment: 2 });
		game = moved(game, "e2e4", { white: 181_500, black: 180_000 });
		game = moved(game, "c7c5", { white: 181_500, black: 179_200 });
		const record = toRecord(game);
		expect(record.status).toBe("playing");
		expect(localGameRecordSchema.safeParse(record).success).toBe(true);
		expect(record.pgn).toContain("[%clk 0:03:01.5]");
		expect(record.pgn).toContain('[TimeControl "180+2"]');
		const read = fromRecord(record);
		expect(read.ok && read.game.moves).toEqual(game.moves);
		expect(read.ok && read.game.clocks).toEqual({ white: 181_500, black: 179_200 });
		expect(movesInPgn(record.pgn)).toBe(2);
		expect(analysisLineOf(game)).toBe("e2e4_c7c5");
		expect(localGamePgn(game, { white: "You", black: "Stockfish" })).toContain('[White "You"]');
	});

	it("refuses what it doesn't write: variations, an unfinished game on a finished board, mixed fields", () => {
		const record = toRecord(boardGame(null));
		expect(fromRecord({ ...record, pgn: "1. e4 (1. d4) e5 *" })).toEqual({ ok: false, reason: "variations" });
		expect(fromRecord({ ...record, pgn: "1. f3 e5 2. g4 Qh4# *" })).toEqual({ ok: false, reason: "ended" });
		expect(fromRecord({ ...record, pgn: "1. e4 Ke7 2. Ke9 *" }).ok).toBe(false);
		expect(localGameRecordSchema.safeParse({ ...record, level: 3 }).success).toBe(false);
		expect(localGameRecordSchema.safeParse({ ...record, result: "1-0" }).success).toBe(false);
		expect(localGameRecordSchema.safeParse({ ...record, clocks: { white: 1, black: 1 } }).success).toBe(false);
	});
});
