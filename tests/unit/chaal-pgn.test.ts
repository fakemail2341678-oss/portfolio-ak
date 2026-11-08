import { describe, expect, it } from "vitest";
import { PGN_MAX_MOVES, type PgnGame, readPgn, writePgn } from "@/features/chaal/chess/pgn";
import { START_FEN } from "@/features/chaal/chess/rules";
import { type GameTree, mainline, nodeOf, type TreeNode } from "@/features/chaal/chess/tree";

/**
 * PGN in and out (Task 74, decision 0261): variations, comments, NAGs, Lichess's clocks and
 * evals, round trips, and the limits.
 */

const read = (text: string): PgnGame => {
	const result = readPgn(text);
	if (!result.ok) throw new Error(`Not read: ${result.reason} ${result.move ?? ""}`);
	return result.game;
};

/** A tree without its ids: what a round trip must keep. */
function shape(tree: GameTree, id = tree.root): unknown {
	const node: TreeNode = nodeOf(tree, id);
	return {
		san: node.san,
		fen: node.fen,
		comments: node.comments,
		nags: node.nags,
		eval: node.eval,
		clock: node.clock,
		children: node.children.map((child) => shape(tree, child)),
	};
}

const ANNOTATED = `[Event "Casual game"]
[Site "https://lichess.org/abcd1234"]
[Date "2026.11.08"]
[Round "-"]
[White "Sherpa_77"]
[Black "amrit_k"]
[Result "1-0"]
[Opening "Italian Game: Giuoco Piano"]

{ A quiet Italian. } 1. e4 { [%eval 0.3] [%clk 0:10:00] } 1... e5 { [%clk 0:10:00] } 2. Nf3 Nc6
(2... d6 3. d4 (3. Bc4 Be7) 3... exd4 $6) 3. Bc4! Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+!?
{ Sharper than it looks. [%cal Gb4e1] } 7. Bd2 Bxd2+ 8. Nbxd2 d5 $2 9. exd5 Nxd5 10. Qb3 1-0`;

describe("reading PGN", () => {
	it("reads tags, the main line, variations, comments, NAGs, clocks and evals", () => {
		const game = read(ANNOTATED);
		expect(game.result).toBe("1-0");
		expect(game.tags.White).toBe("Sherpa_77");
		expect(game.tags.Opening).toBe("Italian Game: Giuoco Piano");
		const moves = mainline(game.tree);
		expect(moves.map((node) => node.san).join(" ")).toBe(
			"e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3",
		);
		expect(nodeOf(game.tree, game.tree.root).comments).toEqual(["A quiet Italian."]);
		const [e4, e5, nf3] = moves;
		expect(e4).toMatchObject({ eval: { cp: 30 }, clock: 600_000, comments: [] });
		expect(e5?.clock).toBe(600_000);
		// 2...d6 is the alternative to 2...Nc6, with 3.Bc4 nested inside it.
		const alternatives = nodeOf(game.tree, nf3?.id as string).children.map((id) => nodeOf(game.tree, id).san);
		expect(alternatives).toEqual(["Nc6", "d6"]);
		const d6 = nodeOf(game.tree, nodeOf(game.tree, nf3?.id as string).children[1] as string);
		const d4 = nodeOf(game.tree, d6.children[0] as string);
		expect(d4.children.map((id) => nodeOf(game.tree, id).san)).toEqual(["exd4"]);
		expect(d6.children.map((id) => nodeOf(game.tree, id).san)).toEqual(["d4", "Bc4"]);
		expect(nodeOf(game.tree, d4.children[0] as string).nags).toEqual([6]);
		expect(moves[4]?.nags).toEqual([1]);
		// Arrows are read into the move's shapes (Task 75); the rest of the comment stays text.
		expect(moves[11]).toMatchObject({
			san: "Bb4+",
			nags: [5],
			comments: ["Sharper than it looks."],
			shapes: [{ from: "b4", to: "e1", brush: "ink" }],
		});
		expect(moves[15]?.nags).toEqual([2]);
	});

	it("reads a game from a position, with Black to move", () => {
		const game = read(`[FEN "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"]
[SetUp "1"]

3... a6 4. Ba4 Nf6 5. O-O *`);
		expect(mainline(game.tree).map((node) => node.san)).toEqual(["a6", "Ba4", "Nf6", "O-O"]);
		expect(nodeOf(game.tree, game.tree.root).ply).toBe(5);
		expect(game.result).toBe("*");
		expect(writePgn(game)).toContain("3... a6 4. Ba4 Nf6 5. O-O *");
	});

	it("reads lenient movetext: zeros for castling, figurines, numbers without spaces, line comments", () => {
		const game = read("1.e4 e5 2.♘f3 ♘c6 3.♗c4 ♗c5 4.0-0 ; castles\n4...♘f6 *");
		expect(mainline(game.tree).map((node) => node.san)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6"]);
	});

	it("takes the result from the tags when the movetext has none, and only the first game", () => {
		const game = read(`[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4#\n\n[Event "Second"]\n\n1. d4 *`);
		expect(game.result).toBe("0-1");
		expect(mainline(game.tree)).toHaveLength(4);
	});

	it("refuses what it can't read, saying why", () => {
		expect(readPgn("")).toEqual({ ok: false, reason: "empty" });
		expect(readPgn("1. e4 e5 2. Ke3 *")).toEqual({ ok: false, reason: "move", move: "Ke3" });
		expect(readPgn("1. e4 -- 2. d4 *")).toEqual({ ok: false, reason: "move", move: "--" });
		expect(readPgn('[Variant "Crazyhouse"]\n\n1. e4 *')).toEqual({ ok: false, reason: "variant" });
		expect(readPgn('[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n\n*')).toEqual({ ok: false, reason: "fen" });
		expect(readPgn(`{ ${"x".repeat(500_001)} } *`)).toEqual({ ok: false, reason: "too-large" });
		// 2,001 moves of knights going back and forth.
		const shuffle = Array.from({ length: PGN_MAX_MOVES + 1 }, (_, ply) => ["Nf3", "Nf6", "Ng1", "Ng8"][ply % 4]).join(
			" ",
		);
		expect(readPgn(shuffle)).toEqual({ ok: false, reason: "too-long" });
		expect(
			readPgn(Array.from({ length: PGN_MAX_MOVES }, (_, ply) => ["Nf3", "Nf6", "Ng1", "Ng8"][ply % 4]).join(" ")).ok,
		).toBe(true);
	});
});

describe("writing PGN", () => {
	it("writes the seven tags first, numbers after variations and comments, NAGs, clocks and evals", () => {
		const text = writePgn(read(ANNOTATED));
		expect(text.split("\n").slice(0, 8)).toEqual([
			'[Event "Casual game"]',
			'[Site "https://lichess.org/abcd1234"]',
			'[Date "2026.11.08"]',
			'[Round "-"]',
			'[White "Sherpa_77"]',
			'[Black "amrit_k"]',
			'[Result "1-0"]',
			'[Opening "Italian Game: Giuoco Piano"]',
		]);
		const moves = text.split("\n\n")[1]?.trim().replace(/\n/g, " ") ?? "";
		expect(moves).toContain(
			"{ A quiet Italian. } 1. e4 { [%eval 0.30] [%clk 0:10:00] } 1... e5 { [%clk 0:10:00] } 2. Nf3 Nc6",
		);
		expect(moves).toContain("(2... d6 3. d4 (3. Bc4 Be7) 3... exd4 $6) 3. Bc4 $1 Bc5");
		expect(moves).toContain("6. cxd4 Bb4+ $5 { [%cal Gb4e1] Sharper than it looks. } 7. Bd2");
		expect(moves.endsWith("10. Qb3 1-0")).toBe(true);
		for (const row of text.split("\n")) expect(row.length).toBeLessThanOrEqual(80);
	});

	it("fills unknown tags with ? and escapes quotes", () => {
		const text = writePgn({ ...read("1. e4 *"), tags: { White: 'Ram "the rook"' } });
		expect(text).toContain('[Event "?"]');
		expect(text).toContain('[White "Ram \\"the rook\\""]');
		expect(read(text).tags.White).toBe('Ram "the rook"');
	});

	it("round-trips: read, write, read gives the same tree, and the same text again", () => {
		const games = [
			ANNOTATED,
			"1. e4 (1. d4 d5 (1... Nf6 2. c4 (2. Nf3 g6) 2... e6) 2. c4) (1. c4) 1... c5 { Sicilian. } (1... e5 2. Nf3) 2. Nf3 *",
			'[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. a8=Q+ (1. a8=N) 1... Kd7 2. Qb7+ { [%eval #3] } *',
			"1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 { [%eval -0.25] [%clk 0:02:59.5] } 1/2-1/2",
		];
		for (const source of games) {
			const first = read(source);
			const written = writePgn(first);
			const second = read(written);
			expect(shape(second.tree)).toEqual(shape(first.tree));
			expect(second.result).toBe(first.result);
			expect(writePgn(second)).toBe(written);
		}
	});

	it("writes a game from the usual start without a FEN", () => {
		const text = writePgn(read("1. e4 *"));
		expect(text).not.toContain("FEN");
		expect(nodeOf(read(text).tree, read(text).tree.root).fen).toBe(START_FEN);
	});
});
