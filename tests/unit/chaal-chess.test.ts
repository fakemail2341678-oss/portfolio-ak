import { afterEach, describe, expect, it } from "vitest";
import {
	clockParts,
	flagged,
	formatClock,
	formatTimeControl,
	pressClock,
	remaining,
	speedOf,
} from "@/features/chaal/chess/clock";
import { formatScore, winChance } from "@/features/chaal/chess/eval";
import { figurine, moveSuggestions, nagSymbol, readTypedMove, showSan } from "@/features/chaal/chess/notation";
import {
	checkFen,
	checkSquare,
	type GameState,
	gameState,
	isPromotion,
	legalDests,
	materialBalance,
	parseUci,
	play,
	premoveDests,
	START_FEN,
	turnOf,
} from "@/features/chaal/chess/rules";
import { spokenMove, spokenTurn } from "@/features/chaal/chess/speech";
import {
	createTree,
	deleteFrom,
	fensTo,
	isMainline,
	lineFrom,
	mainline,
	nodeOf,
	playOn,
	promoteLine,
	sizeOf,
	stepFrom,
} from "@/features/chaal/chess/tree";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * Chaal's game model (Task 74, decision 0261): the rules over chess.js, notation, spoken
 * moves, clocks, evals and the game tree. PGN has its own file (chaal-pgn.test.ts).
 */

/** Plays SAN moves from a position; throws on an illegal one, so a typo fails loudly. */
function line(sans: string, from = START_FEN): string[] {
	const fens = [from];
	for (const san of sans.split(/\s+/).filter(Boolean)) {
		const move = play(fens.at(-1) as string, san);
		if (!move) throw new Error(`Illegal in the test: ${san}`);
		fens.push(move.fen);
	}
	return fens;
}

type Expect = { end: NonNullable<GameState["end"]> } | { claim: NonNullable<GameState["claim"]> } | { check: boolean };

/** 50 positions, each with what the rules must say about it. */
const POSITIONS: ReadonlyArray<{ name: string; fen: string; history?: string[]; expect: Expect }> = [
	// Checkmate.
	{
		name: "fool's mate",
		fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
		expect: { end: { result: "0-1", reason: "checkmate" } },
	},
	{
		name: "scholar's mate",
		fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "the reversed fool's mate",
		fen: "rnbqkbnr/ppppp2p/5p2/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "back rank",
		fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "smothered",
		fen: "6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "queen and king",
		fen: "k7/1Q6/1K6/8/8/8/8/8 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "two rooks",
		fen: "R6k/1R6/8/8/8/8/8/6K1 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "Black's queen and king",
		fen: "8/8/8/8/8/1k6/1q6/K7 w - - 0 1",
		expect: { end: { result: "0-1", reason: "checkmate" } },
	},
	{
		name: "rook and knight on the h-file",
		fen: "5r2/4Nppk/8/7R/8/8/8/6K1 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "epaulette",
		fen: "3rkr2/8/4Q3/8/8/8/8/4K3 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{ name: "Arabian", fen: "7k/7R/5N2/8/8/8/8/K7 b - - 0 1", expect: { end: { result: "1-0", reason: "checkmate" } } },
	{
		name: "Damiano",
		fen: "5rk1/6pQ/6P1/8/8/8/8/6K1 b - - 0 1",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	{
		name: "Black's back rank",
		fen: "6k1/8/8/8/8/8/5PPP/3r2K1 w - - 0 1",
		expect: { end: { result: "0-1", reason: "checkmate" } },
	},
	{
		name: "mate on the hundredth half-move",
		fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 60",
		expect: { end: { result: "1-0", reason: "checkmate" } },
	},
	// Stalemate.
	{
		name: "queen in the corner",
		fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "queen on b6",
		fen: "k7/8/1Q6/8/8/8/8/7K b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "king and pawn against king",
		fen: "5k2/5P2/5K2/8/8/8/8/8 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "White stalemated by a pawn",
		fen: "8/8/8/8/8/5k2/5p2/5K2 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "queen on g6",
		fen: "7k/8/6Q1/8/8/8/8/K7 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "White stalemated by a queen",
		fen: "8/8/8/8/8/1qk5/8/K7 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "rook's pawn",
		fen: "k7/P7/1K6/8/8/8/8/8 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "stalemate outranks dead material",
		fen: "7k/5B2/6K1/8/8/8/8/8 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	{
		name: "stalemate on the 150th half-move",
		fen: "k7/P7/1K6/8/8/8/8/8 b - - 150 90",
		expect: { end: { result: "1/2-1/2", reason: "stalemate" } },
	},
	// Not enough material to mate.
	{
		name: "king against king",
		fen: "8/8/8/4k3/8/8/8/4K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "king and bishop",
		fen: "8/8/8/4k3/8/8/8/2B1K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "king and bishop, Black to move",
		fen: "8/8/8/4k3/8/8/8/2B1K3 b - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "king and knight",
		fen: "8/8/8/4k3/8/8/8/1N2K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "Black's king and bishop",
		fen: "8/8/8/4k3/8/8/8/2b1K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "bishops on one colour",
		fen: "5b2/8/8/4k3/8/8/8/2B1K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	{
		name: "three bishops on one colour",
		fen: "5b2/8/8/4k3/8/4B3/8/2B1K3 w - - 0 1",
		expect: { end: { result: "1/2-1/2", reason: "insufficient" } },
	},
	// Enough material: the game goes on.
	{ name: "bishops on opposite colours", fen: "2b5/8/8/4k3/8/8/8/2B1K3 w - - 0 1", expect: { check: false } },
	{ name: "two knights", fen: "8/8/8/4k3/8/8/8/1N1NK3 w - - 0 1", expect: { check: false } },
	{ name: "a pawn", fen: "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1", expect: { check: false } },
	{ name: "a knight each", fen: "8/8/1n6/4k3/8/8/8/1N2K3 w - - 0 1", expect: { check: false } },
	{ name: "the bishop pair", fen: "8/8/8/4k3/8/8/8/2BBK3 w - - 0 1", expect: { check: false } },
	// The fifty- and seventy-five-move rules.
	{ name: "99 half-moves", fen: "8/8/8/4k3/8/8/R7/4K3 w - - 99 80", expect: { check: false } },
	{ name: "100 half-moves: a claim", fen: "8/8/8/4k3/8/8/R7/4K3 w - - 100 80", expect: { claim: "fifty" } },
	{ name: "149 half-moves: still a claim", fen: "8/8/8/4k3/8/8/R7/4K3 b - - 149 80", expect: { claim: "fifty" } },
	{
		name: "150 half-moves: over",
		fen: "8/8/8/4k3/8/8/R7/4K3 w - - 150 80",
		expect: { end: { result: "1/2-1/2", reason: "seventy-five" } },
	},
	// Repetition, counted along the game.
	{ name: "twice is nothing", ...lastOf(line("Nf3 Nf6 Ng1 Ng8")), expect: { check: false } },
	{ name: "three times: a claim", ...lastOf(line("Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8")), expect: { claim: "threefold" } },
	{
		name: "five times: over",
		...lastOf(line("Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8")),
		expect: { end: { result: "1/2-1/2", reason: "fivefold" } },
	},
	{
		name: "lost castling rights make a new position",
		...lastOf(line("Nf3 Nf6 Rg1 Rg8 Rh1 Rh8 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8")),
		expect: { check: false },
	},
	{
		name: "…which repeats on its own",
		...lastOf(line("Nf3 Nf6 Rg1 Rg8 Rh1 Rh8 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8")),
		expect: { claim: "threefold" },
	},
	// Play goes on, in check or not.
	{ name: "the start", fen: START_FEN, expect: { check: false } },
	{ name: "check along a file", fen: "4k3/8/8/8/8/8/8/4R1K1 b - - 0 1", expect: { check: true } },
	{ name: "double check with a way out", fen: "4k3/8/5N2/8/8/8/8/4R1K1 b - - 0 1", expect: { check: true } },
	{ name: "check the king can take", fen: "4k3/8/8/8/8/8/3q4/4K3 w - - 0 1", expect: { check: true } },
	{
		name: "Ruy Lopez",
		fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
		expect: { check: false },
	},
	{ name: "a mate in one, not yet played", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", expect: { check: false } },
];

function lastOf(fens: string[]) {
	return { fen: fens.at(-1) as string, history: fens };
}

describe("the rules on 50 known positions", () => {
	it("has 50", () => {
		expect(POSITIONS).toHaveLength(50);
	});

	it.each(POSITIONS)("$name", ({ fen, history, expect: want }) => {
		expect(checkFen(fen)).toEqual({ ok: true, fen });
		const state = gameState(fen, history ?? [fen]);
		if ("end" in want) {
			expect(state.end).toEqual(want.end);
		} else if ("claim" in want) {
			expect(state.end).toBeNull();
			expect(state.claim).toBe(want.claim);
		} else {
			expect(state.end).toBeNull();
			expect(state.claim).toBeNull();
			expect(state.check).toBe(want.check);
		}
	});
});

describe("rules", () => {
	it("checks FENs and names what's wrong", () => {
		expect(checkFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -")).toEqual({ ok: true, fen: START_FEN });
		expect(checkFen("8/8/8/8/8/8/8/KK5k w - - 0 1")).toEqual({ ok: false, reason: "kings" });
		expect(checkFen("8/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({ ok: false, reason: "kings" });
		// White to move, but Black is in check: Black's last move left its king attacked.
		expect(checkFen("4k3/8/8/8/8/8/8/4R1K1 w - - 0 1")).toEqual({ ok: false, reason: "check" });
		expect(checkFen("not a fen")).toEqual({ ok: false, reason: "format" });
		expect(checkFen("4k3/8/8/8/8/8/8/P3K3 w - - 0 1")).toEqual({ ok: false, reason: "format" });
	});

	it("plays SAN, UCI and squares, and refuses what isn't legal", () => {
		expect(play(START_FEN, "Nf3")).toMatchObject({
			uci: "g1f3",
			san: "Nf3",
			piece: "n",
			color: "white",
			capture: false,
		});
		expect(play(START_FEN, "g1f3")?.san).toBe("Nf3");
		expect(play(START_FEN, { from: "e2", to: "e4" })?.san).toBe("e4");
		expect(play(START_FEN, "Ke2")).toBeNull();
		expect(play(START_FEN, { from: "e2", to: "e5" })).toBeNull();
		const castle = line("e4 e5 Nf3 Nc6 Bc4 Bc5").at(-1) as string;
		expect(play(castle, "0-0")).toMatchObject({ san: "O-O", uci: "e1g1", castle: true });
		const mate = play(line("f3 e5 g4").at(-1) as string, "Qh4");
		expect(mate).toMatchObject({ san: "Qh4#", check: true, mate: true });
	});

	it("lists legal targets, promotions, the checked king, whose turn it is", () => {
		const dests = legalDests(START_FEN);
		expect(dests.get("e2")).toEqual(["e3", "e4"]);
		expect(dests.get("g1")?.sort()).toEqual(["f3", "h3"]);
		expect(dests.has("e1")).toBe(false);
		const pawn = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
		expect(isPromotion(pawn, "a7", "a8")).toBe(true);
		expect(legalDests(pawn).get("a7")).toEqual(["a8"]);
		expect(play(pawn, { from: "a7", to: "a8", promotion: "n" })?.san).toBe("a8=N");
		expect(checkSquare("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1")).toBe("e8");
		expect(checkSquare(START_FEN)).toBeNull();
		expect(turnOf(START_FEN)).toBe("white");
		expect(parseUci("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
		expect(parseUci("Nf3")).toBeNull();
	});

	it("counts material", () => {
		expect(materialBalance(START_FEN)).toEqual({ white: { pieces: [], points: 0 }, black: { pieces: [], points: 0 } });
		// White has an extra knight; Black an extra pawn: White leads by 2.
		const balance = materialBalance("4k3/pp6/8/8/8/8/P7/1N2K3 w - - 0 1");
		expect(balance.white).toEqual({ pieces: ["n"], points: 2 });
		expect(balance.black).toEqual({ pieces: ["p"], points: 0 });
	});

	it("gives premove targets by geometry, through pieces", () => {
		const dests = premoveDests(START_FEN, "white");
		expect(dests.get("g1")?.sort()).toEqual(["e2", "f3", "h3"]);
		expect(dests.get("a1")).toContain("a8");
		expect(dests.get("e1")).toEqual(expect.arrayContaining(["g1", "c1", "d2"]));
		expect(dests.get("e2")).toEqual(expect.arrayContaining(["e3", "d3", "f3", "e4"]));
	});
});

describe("notation", () => {
	it("writes figurines and the annotator's symbols", () => {
		expect(figurine("Nf3")).toBe("♘f3");
		expect(figurine("exd8=Q+")).toBe("exd8=♕+");
		expect(figurine("O-O")).toBe("O-O");
		expect(showSan("Bb5", "letters")).toBe("Bb5");
		expect(nagSymbol(5)).toBe("!?");
		expect(nagSymbol(16)).toBe("±");
		expect(nagSymbol(999)).toBeNull();
	});

	it("reads what people type", () => {
		const read = (fen: string, text: string) => {
			const result = readTypedMove(fen, text);
			return result.ok ? result.move.san : result.reason;
		};
		expect(read(START_FEN, "nf3")).toBe("Nf3");
		expect(read(START_FEN, "g1f3")).toBe("Nf3");
		expect(read(START_FEN, "♘f3")).toBe("Nf3");
		expect(read(START_FEN, "e4!")).toBe("e4");
		expect(read(START_FEN, "")).toBe("empty");
		expect(read(START_FEN, "e5")).toBe("illegal");
		expect(read(line("e4 e5 Nf3 Nc6 Bc4 Bc5").at(-1) as string, "0-0")).toBe("O-O");
		expect(read(line("e4 e5").at(-1) as string, "bc4")).toBe("Bc4");
		// Both knights reach d2: the letter alone fits two moves.
		const knights = "4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1";
		expect(read(knights, "nd2")).toBe("ambiguous");
		expect(read(knights, "nbd2")).toBe("Nbd2");
		// Leaving out the capture's "x".
		expect(read(line("e4 d5").at(-1) as string, "ed5")).toBe("exd5");
	});

	it("suggests legal moves that start with what's typed", () => {
		expect(moveSuggestions(START_FEN, "n")).toEqual(["Na3", "Nc3", "Nf3", "Nh3"]);
		expect(moveSuggestions(START_FEN, "e")).toEqual(["e3", "e4"]);
		expect(moveSuggestions(START_FEN, "")).toEqual([]);
	});
});

describe("spoken moves", () => {
	afterEach(() => overwriteGetLocale(() => "en"));

	it("speaks English", () => {
		overwriteGetLocale(() => "en");
		expect(spokenMove("Nf3")).toBe("Knight to f3");
		expect(spokenMove("exd5")).toBe("Pawn takes d5");
		expect(spokenMove("O-O")).toBe("Castles kingside");
		expect(spokenMove("O-O-O+")).toBe("Castles queenside, check");
		expect(spokenMove("e8=Q#")).toBe("Pawn to e8, promotes to Queen, checkmate");
		expect(spokenMove("Nbd7")).toBe("Knight b to d7");
		expect(spokenTurn("Nf6", "black")).toBe("Black: Knight to f6");
	});

	it("speaks Nepali", () => {
		overwriteGetLocale(() => "ne");
		expect(spokenMove("Nf3")).toBe("घोडा f3 मा");
		expect(spokenMove("Bxe5+")).toBe("ऊँटले e5 काट्छ, चेक");
		expect(spokenTurn("O-O", "white")).toBe("सेतो: राजातर्फ क्यासलिङ");
	});
});

describe("clocks", () => {
	it("shows time", () => {
		expect(formatClock(495_000)).toBe("8:15");
		expect(formatClock(3_723_000)).toBe("1:02:03");
		expect(formatClock(9_400)).toBe("0:09.4");
		expect(formatClock(10_000)).toBe("0:10");
		expect(formatClock(-5)).toBe("0:00.0");
		expect(clockParts(61_250)).toEqual({ hours: 0, minutes: 1, seconds: 1, tenths: 2 });
	});

	it("names time controls as Lichess does", () => {
		expect(speedOf({ initial: 15, increment: 0 })).toBe("ultraBullet");
		expect(speedOf({ initial: 60, increment: 1 })).toBe("bullet");
		expect(speedOf({ initial: 180, increment: 2 })).toBe("blitz");
		expect(speedOf({ initial: 600, increment: 0 })).toBe("rapid");
		expect(speedOf({ initial: 1800, increment: 20 })).toBe("classical");
		expect(formatTimeControl({ initial: 30, increment: 0 })).toBe("½+0");
		expect(formatTimeControl({ initial: 600, increment: 5 })).toBe("10+5");
	});

	it("runs two clocks on a monotonic time", () => {
		let clock = { white: 60_000, black: 60_000, running: null, since: 0 } as Parameters<typeof remaining>[0];
		clock = pressClock(clock, 1_000, 2_000);
		expect(clock.running).toBe("white");
		expect(remaining(clock, "white", 11_000)).toBe(50_000);
		expect(remaining(clock, "black", 11_000)).toBe(60_000);
		clock = pressClock(clock, 11_000, 2_000);
		expect(clock).toMatchObject({ white: 52_000, running: "black", since: 11_000 });
		expect(flagged(clock, 70_000)).toBeNull();
		expect(flagged(clock, 71_000)).toBe("black");
		expect(remaining(clock, "black", 99_000)).toBe(0);
	});
});

describe("evaluations", () => {
	it("turns scores into a winning chance and text", () => {
		expect(winChance({ cp: 0 })).toBe(50);
		expect(winChance({ cp: 300 })).toBeGreaterThan(75);
		expect(winChance({ cp: -300 })).toBeLessThan(25);
		expect(winChance({ mate: 3 })).toBe(100);
		expect(winChance({ mate: -1 })).toBe(0);
		expect(formatScore({ cp: 35 })).toBe("+0.35");
		expect(formatScore({ cp: -120 })).toBe("−1.20");
		expect(formatScore({ cp: 0 })).toBe("0.00");
		expect(formatScore({ mate: 3 })).toBe("#3");
		expect(formatScore({ mate: -2 })).toBe("#−2");
	});
});

describe("the game tree", () => {
	it("adds moves, reuses one played twice, and walks the lines", () => {
		let tree = createTree();
		const e4 = playOn(tree, tree.root, "e4");
		if (!e4) throw new Error("e4");
		tree = e4.tree;
		const e5 = playOn(tree, e4.id, "e5");
		if (!e5) throw new Error("e5");
		tree = e5.tree;
		const again = playOn(tree, tree.root, "e2e4");
		expect(again?.id).toBe(e4.id);
		expect(playOn(tree, e5.id, "Ke3")).toBeNull();
		const c5 = playOn(tree, e4.id, "c5");
		if (!c5) throw new Error("c5");
		tree = c5.tree;
		expect(mainline(tree).map((node) => node.san)).toEqual(["e4", "e5"]);
		expect(nodeOf(tree, e4.id).children).toEqual([e5.id, c5.id]);
		expect(nodeOf(tree, c5.id).ply).toBe(2);
		expect(isMainline(tree, c5.id)).toBe(false);
		expect(stepFrom(tree, c5.id, "prev")).toBe(e4.id);
		expect(stepFrom(tree, tree.root, "last")).toBe(e5.id);
		expect(stepFrom(tree, e5.id, "next")).toBe(e5.id);
		expect(stepFrom(tree, e5.id, "first")).toBe(tree.root);
		expect(fensTo(tree, c5.id)).toHaveLength(3);
		expect(sizeOf(tree)).toBe(3);

		const promoted = promoteLine(tree, c5.id);
		expect(mainline(promoted).map((node) => node.san)).toEqual(["e4", "c5"]);
		expect(isMainline(promoted, c5.id)).toBe(true);

		const pruned = deleteFrom(tree, e4.id);
		expect(sizeOf(pruned)).toBe(0);
		expect(nodeOf(pruned, pruned.root).children).toEqual([]);
		expect(deleteFrom(tree, tree.root)).toBe(tree);
		// Nothing above changed the tree it was given.
		expect(mainline(tree).map((node) => node.san)).toEqual(["e4", "e5"]);
	});

	it("counts plies from a FEN's move number", () => {
		const tree = createTree("4k3/8/8/8/8/8/8/4K3 b - - 0 12");
		expect(nodeOf(tree, tree.root).ply).toBe(23);
		expect(lineFrom(tree, tree.root)).toHaveLength(1);
	});

	it("feeds repetitions to the rules along its path", () => {
		let tree = createTree();
		let at = tree.root;
		for (const san of "Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8".split(" ")) {
			const next = playOn(tree, at, san);
			if (!next) throw new Error(san);
			tree = next.tree;
			at = next.id;
		}
		expect(gameState(nodeOf(tree, at).fen, fensTo(tree, at)).claim).toBe("threefold");
	});
});
