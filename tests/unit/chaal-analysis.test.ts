import { describe, expect, it } from "vitest";
import { lichessGameId, readImport } from "@/features/chaal/analysis/import";
import { lineMoves } from "@/features/chaal/analysis/lines";
import { gameTreeSchema } from "@/features/chaal/analysis/schema";
import { searchFromTree, shareUrl, treeFromSearch } from "@/features/chaal/analysis/url";
import { readPgn, writePgn } from "@/features/chaal/chess/pgn";
import { START_FEN } from "@/features/chaal/chess/rules";
import {
	createTree,
	type GameTree,
	isMainline,
	mainline,
	nodeOf,
	playOn,
	promoteVariation,
	setComment,
	setShapes,
	toggleNag,
	verifyTree,
} from "@/features/chaal/chess/tree";
import { readEngineLimits } from "@/features/chaal/engine/limits";
import { analysisSearch } from "@/features/chaal/search";
import { cloudEvalAnswer, explorerAnswer, gameExportAnswer, tablebaseAnswer } from "@/server/chaal/lichess/schemas";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/**
 * The analysis board's pure parts (PLAN Task 75, decision 0264): editing the tree, arrows
 * in PGN, the URL, what "Import" reads, engine lines as moves, the stored tree's check, and
 * Lichess's answers as Chaal's lean shapes (read from the recordings).
 */

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const TABLEBASE_FEN = "4k3/6KP/8/8/8/8/7p/8 w - - 0 1";

/** Plays SAN moves along the first line from the root; returns the tree and the ids in order. */
function line(...moves: string[]): { tree: GameTree; ids: string[] } {
	let tree = createTree();
	const ids = [tree.root];
	for (const move of moves) {
		const played = playOn(tree, ids.at(-1) as string, move);
		if (!played) throw new Error(move);
		tree = played.tree;
		ids.push(played.id);
	}
	return { tree, ids };
}

const recorded = (host: "api" | "explorer" | "tablebase", path: string, params: Record<string, string>) => {
	const name = lichessFixtureName(host, path, Object.entries(params));
	const text = readLichessFixture(name) ?? readLichessFixture(name.replace(/\.json$/, ".ndjson"));
	if (!text) throw new Error(`tests/fixtures/lichess: ${name} (pnpm lichess:record)`);
	return JSON.parse(text.trim().split("\n").at(-1) as string) as unknown;
};

describe("editing the tree", () => {
	it("toggles a move symbol, replacing another of its kind, and keeps the position's", () => {
		const { tree, ids } = line("e4", "e5");
		const e5 = ids[2] as string;
		let edited = toggleNag(tree, e5, 1);
		edited = toggleNag(edited, e5, 16);
		edited = toggleNag(edited, e5, 2);
		expect(nodeOf(edited, e5).nags).toEqual([2, 16]);
		edited = toggleNag(edited, e5, 2);
		expect(nodeOf(edited, e5).nags).toEqual([16]);
		edited = toggleNag(edited, e5, 18);
		expect(nodeOf(edited, e5).nags).toEqual([18]);
		// The tree it was given is untouched.
		expect(nodeOf(tree, e5).nags).toEqual([]);
	});

	it("sets a comment and shapes, and an empty comment removes it", () => {
		const { tree, ids } = line("e4");
		const e4 = ids[1] as string;
		const commented = setComment(tree, e4, "  Best by test.  ");
		expect(nodeOf(commented, e4).comments).toEqual(["Best by test."]);
		expect(nodeOf(setComment(commented, e4, " "), e4).comments).toEqual([]);
		const drawn = setShapes(tree, e4, [{ from: "e2", to: "e4", brush: "mark" }, { from: "d5" }]);
		expect(nodeOf(drawn, e4).shapes).toEqual([{ from: "e2", to: "e4", brush: "mark" }, { from: "d5" }]);
	});

	it("promotes a variation one step at a time; the main line stays put", () => {
		// 1.e4 e5 (1...c5 2.Nf3 (2.Nc3)) 2.Nf3
		let { tree, ids } = line("e4", "e5", "Nf3");
		const e4 = ids[1] as string;
		const c5 = playOn(tree, e4, "c5");
		if (!c5) throw new Error("c5");
		const nf3 = playOn(c5.tree, c5.id, "Nf3");
		if (!nf3) throw new Error("Nf3");
		const nc3 = playOn(nf3.tree, c5.id, "Nc3");
		if (!nc3) throw new Error("Nc3");
		tree = nc3.tree;
		// Nc3 is second after c5: promoting it makes it first there, c5 stays a variation.
		const once = promoteVariation(tree, nc3.id);
		expect(nodeOf(once, c5.id).children[0]).toBe(nc3.id);
		expect(isMainline(once, nc3.id)).toBe(false);
		// Again: now c5 is the next branch up.
		const twice = promoteVariation(once, nc3.id);
		expect(nodeOf(twice, e4).children[0]).toBe(c5.id);
		expect(isMainline(twice, nc3.id)).toBe(true);
		expect(promoteVariation(twice, nc3.id)).toBe(twice);
		ids = [];
	});

	it("verifies a tree from outside: links, legal moves, FENs, SANs, ids and size", () => {
		const { tree, ids } = line("e4", "e5", "Nf3");
		expect(verifyTree(tree, 2_000)).toEqual({ ok: true, tree });
		expect(verifyTree(tree, 2)).toMatchObject({ ok: false, reason: "too-long" });
		const e5 = ids[2] as string;
		const forged = { ...tree, nodes: { ...tree.nodes, [e5]: { ...nodeOf(tree, e5), san: "Qh4" } } };
		expect(verifyTree(forged, 2_000)).toMatchObject({ ok: false, reason: "move" });
		const fenless = { ...tree, nodes: { ...tree.nodes, [e5]: { ...nodeOf(tree, e5), fen: START_FEN } } };
		expect(verifyTree(fenless, 2_000)).toMatchObject({ ok: false, reason: "move" });
		const orphan = {
			...tree,
			nodes: { ...tree.nodes, "99": { ...nodeOf(tree, e5), id: "99" } },
			next: 100,
		};
		expect(verifyTree(orphan, 2_000)).toMatchObject({ ok: false, reason: "links" });
		const cycle = { ...tree, nodes: { ...tree.nodes, [e5]: { ...nodeOf(tree, e5), children: [tree.root] } } };
		expect(verifyTree(cycle, 2_000).ok).toBe(false);
		expect(verifyTree({ ...tree, next: 1 }, 2_000)).toMatchObject({ ok: false, reason: "ids" });
		expect(verifyTree({ ...tree, root: "7" }, 2_000)).toMatchObject({ ok: false, reason: "root" });
	});

	it("the stored tree's shape refuses what isn't a tree", () => {
		const { tree } = line("e4");
		expect(gameTreeSchema.safeParse(tree).success).toBe(true);
		expect(gameTreeSchema.safeParse({ ...tree, extra: 1 }).success).toBe(false);
		const bad = { ...tree, nodes: { ...tree.nodes, "1": { ...nodeOf(tree, "1"), uci: "e2e9" } } };
		expect(gameTreeSchema.safeParse(bad).success).toBe(false);
	});
});

describe("arrows and circles in PGN", () => {
	it("reads [%cal] and [%csl] into shapes (red is the vermilion mark) and writes them back", () => {
		const read = readPgn('[Event "?"]\n\n1. e4 { [%cal Ge2e4,Rd1h5] [%csl Yd5] The king\'s pawn. } e5 *');
		if (!read.ok) throw new Error(read.reason);
		const e4 = mainline(read.game.tree)[0];
		expect(e4?.shapes).toEqual([
			{ from: "e2", to: "e4", brush: "ink" },
			{ from: "d1", to: "h5", brush: "mark" },
			{ from: "d5", brush: "ink" },
		]);
		expect(e4?.comments).toEqual(["The king's pawn."]);
		const text = writePgn(read.game);
		expect(text).toContain("{ [%cal Ge2e4,Rd1h5] [%csl Gd5] The king's pawn. }");
		const again = readPgn(text);
		expect(again.ok && mainline(again.game.tree)[0]?.shapes).toEqual(e4?.shapes);
	});

	it("draws shapes before the first move on the start position", () => {
		const read = readPgn("{ [%csl Re4] } 1. e4 *");
		if (!read.ok) throw new Error(read.reason);
		expect(nodeOf(read.game.tree, read.game.tree.root).shapes).toEqual([{ from: "e4", brush: "mark" }]);
	});
});

describe("the URL", () => {
	it("opens the line and the move it names, and stops at a move that isn't legal", () => {
		const { tree, current } = treeFromSearch({ moves: "e2e4_e7e5_g1f3", ply: 2 });
		expect(mainline(tree).map((node) => node.san)).toEqual(["e4", "e5", "Nf3"]);
		expect(nodeOf(tree, current).san).toBe("e5");
		const broken = treeFromSearch({ moves: "e2e4_e2e4_g1f3" });
		expect(mainline(broken.tree).map((node) => node.san)).toEqual(["e4"]);
		const start = treeFromSearch({ fen: "not a fen", ply: 40 });
		expect(nodeOf(start.tree, start.current).fen).toBe(START_FEN);
	});

	it("writes the line through the move shown and where it is; a round trip is the same board", () => {
		const { tree, ids } = line("e4", "e5", "Nf3");
		const at = ids[1] as string;
		const search = searchFromTree(tree, at, "black");
		expect(search).toEqual({ moves: "e2e4_e7e5_g1f3", ply: 1, orientation: "black" });
		const back = treeFromSearch(search);
		expect(nodeOf(back.tree, back.current).fen).toBe(nodeOf(tree, at).fen);
		expect(searchFromTree(tree, ids.at(-1) as string, "white")).toEqual({ moves: "e2e4_e7e5_g1f3" });
		const fromFen = searchFromTree(createTree(AFTER_E4), "0", "white");
		expect(fromFen).toEqual({ fen: AFTER_E4 });
		expect(shareUrl("https://chaal.test", "/app/chaal/analysis", search)).toBe(
			"https://chaal.test/app/chaal/analysis?moves=e2e4_e7e5_g1f3&ply=1&orientation=black",
		);
	});

	it("drops what doesn't read, so a mangled link opens a board", () => {
		expect(
			analysisSearch.parse({ moves: "e2e4;drop", ply: "-3", orientation: "up", id: "x", utm_source: "a" }),
		).toEqual({});
		expect(analysisSearch.parse({ moves: "e2e4_e7e5", ply: "1" })).toEqual({ moves: "e2e4_e7e5", ply: 1 });
	});
});

describe("import", () => {
	it("reads a Lichess game's address or id", () => {
		expect(lichessGameId("https://lichess.org/q7ZvsdUF")).toBe("q7ZvsdUF");
		expect(lichessGameId("lichess.org/q7ZvsdUFab12/black")).toBe("q7ZvsdUF");
		expect(lichessGameId("https://lichess.org/q7ZvsdUF#24")).toBe("q7ZvsdUF");
		expect(lichessGameId("q7ZvsdUF")).toBe("q7ZvsdUF");
		// Eight letters alone could be a word; an id has a digit.
		expect(lichessGameId("Fischers")).toBeNull();
		expect(lichessGameId("https://example.com/q7ZvsdUF")).toBeNull();
	});

	it("tells a game, a FEN and PGN apart", () => {
		expect(readImport("  ")).toEqual({ kind: "empty" });
		expect(readImport("https://lichess.org/q7ZvsdUF")).toEqual({ kind: "lichess", id: "q7ZvsdUF" });
		expect(readImport(AFTER_E4)).toEqual({ kind: "fen", fen: AFTER_E4 });
		expect(readImport("8/8/8/8/8/8/8/8 w - - 0 1")).toEqual({ kind: "bad-fen", reason: "kings" });
		expect(readImport("1. e4 e5 *")).toEqual({ kind: "pgn", text: "1. e4 e5 *" });
	});
});

describe("engine lines and limits", () => {
	it("shows a line as numbered SAN, and stops where it stops being legal", () => {
		expect(lineMoves(AFTER_E4, ["e7e5", "g1f3", "b8c6"]).map((move) => [move.number, move.san])).toEqual([
			["1…", "e5"],
			["2.", "Nf3"],
			[null, "Nc6"],
		]);
		expect(lineMoves(START_FEN, ["e2e4", "e2e4"])).toHaveLength(1);
		expect(lineMoves(START_FEN, ["e2e4", "e7e5", "g1f3"], 2)).toHaveLength(2);
	});

	it("clamps the admin's limits to what the browser build can do", () => {
		expect(readEngineLimits(null)).toEqual({ maxDepth: 22, multiPv: 3, hashMb: 16 });
		expect(readEngineLimits({ maxDepth: 99, multiPv: 0, hashMb: 1024 })).toEqual({
			maxDepth: 30,
			multiPv: 1,
			hashMb: 64,
		});
	});
});

describe("Lichess's analysis answers, lean", () => {
	it("cloud eval: lines with scores from White's side", () => {
		const evaluation = cloudEvalAnswer.parse(recorded("api", "/api/cloud-eval", { fen: AFTER_E4, multiPv: "3" }));
		expect(evaluation.lines).toHaveLength(3);
		expect(evaluation.depth).toBeGreaterThan(20);
		expect(evaluation.lines[0]?.moves[0]).toMatch(/^[a-h][1-8][a-h][1-8]/);
		expect(Object.keys(evaluation).sort()).toEqual(["depth", "knodes", "lines"]);
	});

	it("the masters and Lichess explorers: moves, totals, the opening and at most four games", () => {
		const masters = explorerAnswer("masters").parse(
			recorded("explorer", "/masters", { fen: AFTER_E4, topGames: "4", moves: "12" }),
		);
		expect(masters.opening).toEqual({ eco: "B00", name: expect.any(String) });
		expect(masters.moves.length).toBeGreaterThan(3);
		expect(masters.moves[0]).toEqual({
			uci: expect.any(String),
			san: expect.any(String),
			white: expect.any(Number),
			draws: expect.any(Number),
			black: expect.any(Number),
			rating: expect.any(Number),
		});
		expect(masters.games.length).toBeLessThanOrEqual(4);
		expect(masters.indexing).toBe(false);
		const lichess = explorerAnswer("lichess").parse(
			recorded("explorer", "/lichess", {
				variant: "standard",
				fen: START_FEN,
				topGames: "4",
				recentGames: "0",
				moves: "12",
			}),
		);
		expect(lichess.database).toBe("lichess");
		expect(lichess.white + lichess.draws + lichess.black).toBeGreaterThan(0);
	});

	it("a player's explorer reads the opponents' rating and the player's latest games", () => {
		const player = explorerAnswer("player").parse(
			recorded("explorer", "/player", {
				variant: "standard",
				fen: START_FEN,
				player: "thibault",
				color: "white",
				recentGames: "4",
				moves: "12",
			}),
		);
		expect(player.moves[0]?.rating).toEqual(expect.any(Number));
		expect(player.games.length).toBeGreaterThan(0);
	});

	it("drops an explorer game whose id isn't a game's, not the answer", () => {
		const masters = explorerAnswer("masters").parse({
			opening: null,
			white: 1,
			draws: 0,
			black: 0,
			moves: [],
			topGames: [
				{
					id: "../admin",
					winner: "white",
					white: { name: "A", rating: 1 },
					black: { name: "B", rating: 2 },
					year: 2000,
				},
				{ id: "abcd1234", winner: null, white: { name: "A", rating: 1 }, black: { name: "B", rating: 2 }, year: 2000 },
			],
		});
		expect(masters.games.map((game) => game.id)).toEqual(["abcd1234"]);
	});

	it("the tablebase: the position's result, and each move's for the side that plays it", () => {
		const tablebase = tablebaseAnswer.parse(recorded("tablebase", "/standard", { fen: TABLEBASE_FEN }));
		expect(tablebase.result).toBe("win");
		// The winning moves come first, as wins for White.
		expect(tablebase.moves[0]?.result).toBe("win");
		expect(tablebase.moves.at(-1)?.result).not.toBe("win");
	});

	it("a game's export: its PGN, and whether it's finished standard chess", () => {
		const daily = JSON.parse(readLichessFixture(lichessFixtureName("api", "/api/puzzle/daily")) ?? "{}") as {
			game: { id: string };
		};
		const game = gameExportAnswer.parse(
			recorded("api", `/game/export/${daily.game.id}`, {
				pgnInJson: "true",
				clocks: "true",
				evals: "true",
				opening: "true",
				literate: "false",
			}),
		);
		expect(game).toMatchObject({ id: daily.game.id, standard: true, finished: true });
		const read = readPgn(game.pgn);
		expect(read.ok).toBe(true);
		expect(gameExportAnswer.parse({ id: "abcdEFGH", variant: "chess960", status: "started", pgn: "" })).toMatchObject({
			standard: false,
			finished: false,
		});
	});
});
