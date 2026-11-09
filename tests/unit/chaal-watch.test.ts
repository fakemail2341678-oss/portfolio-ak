import { describe, expect, it } from "vitest";
import { readPgn } from "@/features/chaal/chess/pgn";
import { mainline } from "@/features/chaal/chess/tree";
import { readStream } from "@/features/chaal/live/reader";
import { broadcastPageSearch, broadcastsSearch } from "@/features/chaal/search";
import { readWatchLimits, TV_CHANNELS } from "@/features/chaal/watch/limits";
import { applyTvLine, squaresOfMove, tvStateOf } from "@/features/chaal/watch/live";
import { roundShown } from "@/features/chaal/watch/queries";
import {
	asText,
	boardFromPgn,
	boardOf,
	boardStateOf,
	lichessAddress,
	pgnGames,
	readBoard,
	takeGames,
	updatedBoard,
} from "@/features/chaal/watch/round-live";
import { broadcastSearchInput } from "@/features/chaal/watch/schema";
import { applySpectateLine, spectatedFen, spectatedFrom } from "@/features/chaal/watch/spectate";
import {
	broadcastRoundAnswer,
	broadcastSearchAnswer,
	broadcastTopAnswer,
	broadcastTourAnswer,
	gameLineAnswer,
	officialBroadcastAnswer,
	streamersAnswer,
	tvChannelsAnswer,
} from "@/server/chaal/lichess/schemas";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/**
 * Watch (Task 82, decision 0272): Lichess's recorded answers (pnpm lichess:record watch) as
 * Chaal maps them, the TV's feed lines, following a game from its stream, a broadcast
 * round's PGN stream, the admin's controls and the URL contracts.
 */

const TOUR = "9NE16qcS";

const text = (path: string, params: Record<string, string> = {}, extension = "json") => {
	const name = lichessFixtureName("api", path, Object.entries(params)).replace(/\.(json|pgn)$/, `.${extension}`);
	const found = readLichessFixture(name);
	if (!found) throw new Error(`tests/fixtures/lichess: ${name} (pnpm lichess:record watch)`);
	return found;
};
const recorded = (path: string, params: Record<string, string> = {}) => JSON.parse(text(path, params)) as unknown;
const lines = (path: string, params: Record<string, string> = {}) =>
	text(path, params, "ndjson")
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as unknown);

const tour = () => broadcastTourAnswer.parse(recorded(`/api/broadcast/${TOUR}`));
const roundOf = (id: string) => broadcastRoundAnswer.parse(recorded(`/api/broadcast/-/-/${id}`));

const bodyOf = (chunks: string[]) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
			controller.close();
		},
	});

describe("Lichess's watch answers, recorded", () => {
	it("maps the TV's channels and their games' last positions", () => {
		const channels = tvChannelsAnswer.parse(recorded("/api/tv/channels"));
		for (const channel of TV_CHANNELS) expect(channels[channel]?.gameId).toMatch(/^[A-Za-z0-9]{8}$/);
		const games = lines("/api/games/export/_ids", { moves: "false", lastFen: "true" }).map((line) =>
			gameLineAnswer.parse(line),
		);
		expect(games.length).toBeGreaterThan(0);
		for (const game of games) {
			expect(game.lastFen).toMatch(/^[1-8pnbrqkPNBRQK/]+ [wb] /);
			expect(game.white.name.length).toBeGreaterThan(0);
		}
		// The Lichess AI is named by its level, not an account.
		expect(games.some((game) => game.white.aiLevel !== null || game.black.aiLevel !== null)).toBe(true);
	});

	it("keeps only streamers with a web address on the service they're live on, as text", () => {
		const streamers = streamersAnswer.parse(recorded("/api/streamer/live"));
		expect(streamers.length).toBeGreaterThan(0);
		for (const streamer of streamers) {
			expect(streamer.url).toMatch(/^https?:\/\//);
			expect(["twitch", "youtube"]).toContain(streamer.service);
			expect(streamer.status.length).toBeLessThanOrEqual(200);
		}
		const [first] = recorded("/api/streamer/live") as Array<Record<string, unknown>>;
		const unsafe = streamersAnswer.parse([
			{ ...first, stream: { service: "twitch", status: "x" }, streamer: { twitch: "javascript:alert(1)" } },
		]);
		expect(unsafe).toEqual([]);
	});

	it("maps the broadcasts' lists: top (live, coming up, a page of the past), official and a search", () => {
		const top = broadcastTopAnswer.parse(recorded("/api/broadcast/top", { page: "1" }));
		expect(top.active.length + top.past.length).toBeGreaterThan(0);
		expect(top.page).toBe(1);
		for (const each of [...top.active, ...top.past]) expect(each.id).toMatch(/^[A-Za-z0-9]{8}$/);
		const official = lines("/api/broadcast", { nb: "20" }).map((line) => officialBroadcastAnswer.parse(line));
		expect(official.length).toBe(20);
		expect(official.every((each) => each.tier !== null && each.round !== null)).toBe(true);
		const found = broadcastSearchAnswer.parse(recorded("/api/broadcast/search", { q: "spice", page: "1" }));
		expect(found.results.map((each) => each.id)).toContain(TOUR);
	});

	it("maps a tournament with its rounds, and the round Lichess opens", () => {
		const answer = tour();
		expect(answer.rounds.length).toBe(9);
		expect(answer.defaultRound).toBe("9gsZmGXg");
		expect(answer.info.website).toMatch(/^https:\/\//);
		expect(answer.rounds[0]?.state).toBe("finished");
		// The URL's round when the tournament has it, else Lichess's choice.
		expect(roundShown(answer, { round: answer.rounds[0]?.id })).toBe(answer.rounds[0]?.id);
		expect(roundShown(answer, { round: "zzzzzzzz" })).toBe("9gsZmGXg");
	});

	it("maps a round's boards: players with federations, clocks in ms, results", () => {
		const round = roundOf("9gsZmGXg");
		expect(round.tour.id).toBe(TOUR);
		expect(round.round.state).toBe("finished");
		expect(round.boards.length).toBeGreaterThan(10);
		const [board] = round.boards;
		expect(board?.white.fed).toMatch(/^[A-Z]{3}$/);
		expect(board?.white.clock).toBeGreaterThan(1_000);
		expect(["1-0", "0-1", "½-½", "*"]).toContain(board?.result);
	});

	it("reads a board's recorded PGN, with its clocks and evals, and finds its board by the game's address", () => {
		const round = roundOf("9gsZmGXg");
		const pgn = text(`/api/study/9gsZmGXg/${round.boards[0]?.id}.pgn`, {}, "pgn");
		expect(boardOf(pgn)).toBe(round.boards[0]?.id);
		const game = readBoard(pgn);
		expect(game).not.toBeNull();
		const moves = game ? mainline(game.tree) : [];
		expect(moves.length).toBeGreaterThan(20);
		expect(moves.some((node) => node.eval !== undefined)).toBe(true);
		const state = game ? boardStateOf(game) : null;
		expect(state?.clocks.white).toBeGreaterThan(0);
		expect(state?.result).toBe(round.boards[0]?.result);
		expect(state?.fen).toBe(round.boards[0]?.fen);
	});
});

describe("the TV's feed", () => {
	const feed = text("/api/tv/feed", {}, "ndjson")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as unknown);

	it("starts a game on `featured`, then moves on each `fen`, with the clocks", () => {
		let state = applyTvLine(null, feed[0], 10);
		expect(state?.id).toMatch(/^[A-Za-z0-9]{8}$/);
		expect(state?.clocks?.white).toBeGreaterThan(0);
		// A new featured game replaces the first (the recording has two).
		state = applyTvLine(state, feed[1], 20);
		const second = state?.id;
		state = applyTvLine(state, feed[2], 30);
		expect(state?.id).toBe(second);
		expect(state?.lastMove).toMatch(/^[a-h][1-8][a-h][1-8]$/);
		expect(state?.at).toBe(30);
		expect(squaresOfMove(state?.lastMove ?? null)).toHaveLength(2);
	});

	it("ignores what doesn't read: a fen line before any game, a featured line without players", () => {
		expect(applyTvLine(null, feed[2], 0)).toBeNull();
		const state = applyTvLine(null, feed[0], 0);
		expect(applyTvLine(state, { t: "featured", d: { id: "abcdEFGH", fen: "8/8/8/8/8/8/8/8 w - - 0 1" } }, 1)).toBe(
			state,
		);
		expect(applyTvLine(state, { t: "fen", d: { fen: 3 } }, 1)).toBe(state);
		expect(applyTvLine(state, "nonsense", 1)).toBe(state);
	});

	it("starts from the server's read, then a feed takes over", () => {
		const state = tvStateOf({
			channel: "rapid",
			id: "abcdEFGH",
			orientation: "black",
			white: { id: "a", name: "A", title: null, rating: 2000, ratingDiff: null, aiLevel: null },
			black: { id: null, name: "?", title: null, rating: null, ratingDiff: null, aiLevel: 4 },
			fen: null,
			lastMove: null,
			perf: "rapid",
			rated: true,
			clock: { initial: 600, increment: 5 },
		});
		expect(state.orientation).toBe("black");
		expect(state.black.aiLevel).toBe(4);
		expect(applyTvLine(state, feed[0], 5)?.fen).toBeTruthy();
	});
});

describe("following a game from its stream", () => {
	const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
	const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
	const AFTER_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
	const AFTER_NF3 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";

	it("passes over the moves it restates and adds the new ones, even when the export was ahead", () => {
		// The export already had 1. e4 e5 2. Nf3; the stream (behind) restates two of them.
		let state = spectatedFrom({ initialFen: null, moves: ["e4", "e5", "Nf3"] });
		state = applySpectateLine(state, { id: "abcdEFGH", players: {} }, 1);
		state = applySpectateLine(state, { fen: START, wc: 600, bc: 600 }, 2);
		expect(state.cursor).toBe(0);
		state = applySpectateLine(state, { fen: AFTER_E4, lm: "e2e4", wc: 600, bc: 600 }, 3);
		state = applySpectateLine(state, { fen: AFTER_E5, lm: "e7e5", wc: 598, bc: 597 }, 4);
		expect(state.moves).toHaveLength(3);
		expect(state.cursor).toBe(2);
		state = applySpectateLine(state, { fen: AFTER_NF3, lm: "g1f3", wc: 590, bc: 597 }, 5);
		expect(state.cursor).toBeNull();
		state = applySpectateLine(
			state,
			{ fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", lm: "b8c6", wc: 590, bc: 580 },
			6,
		);
		expect(state.moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
		expect(state.clocks).toEqual({ white: 590, black: 580 });
		expect(state.at).toBe(6);
	});

	it("takes Lichess's line where it differs, and starts again from a position it can't follow", () => {
		let state = spectatedFrom({ initialFen: null, moves: ["e4", "e5"] });
		state = applySpectateLine(state, { fen: START, wc: 1, bc: 1 }, 1);
		state = applySpectateLine(state, { fen: AFTER_E4, lm: "e2e4", wc: 1, bc: 1 }, 2);
		state = applySpectateLine(
			state,
			{ fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", lm: "c7c5", wc: 1, bc: 1 },
			3,
		);
		expect(state.moves.map((move) => move.san)).toEqual(["e4", "c5"]);
		const lost = applySpectateLine(state, { fen: AFTER_NF3, lm: "g1f3", wc: 1, bc: 1 }, 4);
		expect(lost.moves).toEqual([]);
		expect(spectatedFen(lost)).toBe(AFTER_NF3);
	});

	it("says how it ended from the last description", () => {
		const state = applySpectateLine(
			spectatedFrom({ initialFen: null, moves: [] }),
			{ id: "abcdEFGH", status: "mate", winner: "white" },
			1,
		);
		expect(state.over).toEqual({ status: "mate", winner: "white" });
		expect(applySpectateLine(state, { id: "abcdEFGH", status: "started" }, 2).over).toEqual(state.over);
	});
});

describe("a broadcast round's PGN stream", () => {
	const pgnA =
		'[Event "R"]\n[GameURL "https://lichess.org/broadcast/t/r/rOuNd001/boArD001"]\n[White "A, B"]\n[Black "C, D"]\n[WhiteElo "2400"]\n[WhiteTitle "GM"]\n[WhiteFed "NEP"]\n[Result "*"]\n\n1. e4 { [%clk 1:30:00] } 1... e5 { [%clk 1:29:30] } 2. Nf3 { [%clk 1:29:00] } *';
	const pgnB =
		'[Event "R"]\n[Site "https://lichess.org/broadcast/t/r/rOuNd001/boArD002"]\n[White "E"]\n[Black "F"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2';

	it("splits whole games, keeping a game still arriving", () => {
		const { games, rest } = takeGames(`${pgnA}\n\n\n${pgnB}\n\n\n[Event "half`);
		expect(games).toEqual([pgnA, pgnB]);
		expect(rest).toBe('[Event "half');
	});

	it("reads games across chunk boundaries, and the last one at the end", async () => {
		const text = `${pgnA}\n\n\n${pgnB}\n`;
		const chunks = [text.slice(0, 50), text.slice(50, 160), text.slice(160)];
		const out: string[] = [];
		for await (const game of pgnGames(bodyOf(chunks))) out.push(game);
		expect(out).toEqual([pgnA, pgnB.trim()]);
	});

	it("names each game's board, and brings a board up to date (or adds one it didn't have)", () => {
		expect(boardOf(pgnA)).toBe("boArD001");
		expect(boardOf(pgnB)).toBe("boArD002");
		expect(boardOf('[Event "x"]\n\n1. e4 *')).toBeNull();
		// A PGN's address is linked only when it's lichess.org's.
		expect(lichessAddress("https://lichess.org/broadcast/t/r/rOuNd001/boArD001")).toMatch(/^https:\/\/lichess\.org\//);
		expect(lichessAddress("javascript:alert(1)")).toBeNull();
		expect(lichessAddress("https://lichess.org.example.com/x")).toBeNull();
		const game = readBoard(pgnA);
		if (!game) throw new Error("pgnA");
		const added = boardFromPgn("boArD001", game);
		expect(added).toMatchObject({
			id: "boArD001",
			lastMove: "g1f3",
			result: "*",
			white: { name: "A, B", title: "GM", rating: 2400, fed: "NEP", clock: 5_340_000 },
			black: { name: "C, D", clock: 5_370_000 },
		});
		const draw = readBoard(pgnB);
		if (!draw) throw new Error("pgnB");
		expect(updatedBoard(added, draw)).toMatchObject({ result: "½-½", lastMove: "d7d5" });
		expect(readBoard('[Variant "Atomic"]\n\n1. e4 *')).toBeNull();
	});

	it("reads a PGN stream through the stream reader, a game per line", async () => {
		const seen: unknown[] = [];
		const end = await readStream("https://lichess.test/round.pgn", {
			signal: new AbortController().signal,
			onLine: (value) => seen.push(value),
			split: pgnGames,
			parse: asText,
			fetcher: async () => new Response(bodyOf([`${pgnA}\n\n\n`, `${pgnB}\n\n\n`]), { status: 200 }),
		});
		expect(end).toEqual({ kind: "closed" });
		expect(seen).toEqual([pgnA, pgnB]);
		expect(readPgn(String(seen[0])).ok).toBe(true);
	});
});

describe("watch's controls and URLs", () => {
	it("reads the admin's channels in the grid's order, all when none are stored, and the streamers' switch", () => {
		expect(readWatchLimits(null)).toEqual({ channels: [...TV_CHANNELS], streamers: true });
		expect(readWatchLimits({ channels: ["computer", "blitz", "horde" as never], streamers: false })).toEqual({
			channels: ["blitz", "computer"],
			streamers: false,
		});
		expect(readWatchLimits({ channels: [] }).channels).toEqual([...TV_CHANNELS]);
	});

	it("drops what doesn't read from the broadcasts' URLs", () => {
		expect(broadcastsSearch.parse({ view: "official", q: "x", page: "1" })).toEqual({ view: "official" });
		expect(broadcastsSearch.parse({ q: "spice", page: "3" })).toEqual({ q: "spice", page: 3 });
		expect(broadcastPageSearch.parse({ round: "9gsZmGXg", board: "bad id!" })).toEqual({ round: "9gsZmGXg" });
		expect(broadcastSearchInput.safeParse({ q: " s ", page: 1 }).success).toBe(false);
	});
});
