import { describe, expect, it } from "vitest";
import { clocksAt, JUDGEMENT_NAGS, replayEnding, replayLine, replayScores } from "@/features/chaal/game/replay";
import { historyRows } from "@/features/chaal/players/history";
import { gameKind, scoreOf } from "@/features/chaal/players/labels";
import { gamesInputOf, mainPerf } from "@/features/chaal/players/queries";
import { playerGamesInput, playerSearchInput } from "@/features/chaal/players/schema";
import { playerSearch, playersSearch } from "@/features/chaal/search";
import {
	activityAnswer,
	autocompleteAnswer,
	crosstableAnswer,
	gameExportAnswer,
	gameLineAnswer,
	leaderboardAnswer,
	perfStatsAnswer,
	ratingHistoryAnswer,
	userAnswer,
	userStatusAnswer,
} from "@/server/chaal/lichess/schemas";
import { gamesParams, resultOf } from "@/server/chaal/players/service";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/**
 * Players and games (Task 81, decision 0271): Lichess's recorded answers (pnpm
 * lichess:record players) as Chaal maps them, the games page's parameters and result
 * filter, the URL contracts, and a finished game's replay (clocks, evals, judgements).
 */

const PLAYER = "nihalsarin2004";

const text = (path: string, params: Record<string, string> = {}) => {
	const name = lichessFixtureName("api", path, Object.entries(params));
	const found = readLichessFixture(name) ?? readLichessFixture(name.replace(/\.json$/, ".ndjson"));
	if (!found) throw new Error(`tests/fixtures/lichess: ${name} (pnpm lichess:record players)`);
	return found;
};
const recorded = (path: string, params: Record<string, string> = {}) => JSON.parse(text(path, params)) as unknown;

const GAME_EXPORT = { pgnInJson: "true", clocks: "true", evals: "true", opening: "true", literate: "false" };
const exported = () => gameExportAnswer.parse(recorded("/game/export/T8myeL3d", GAME_EXPORT));

describe("Lichess's players, as Chaal reads them", () => {
	it("a profile: standard ratings only, the counts, text kept short", () => {
		const { player, following } = userAnswer.parse(recorded(`/api/user/${PLAYER}`));
		expect(player.id).toBe(PLAYER);
		expect(player.closed).toBe(false);
		expect(following).toBeNull();
		expect(player.ratings.length).toBeGreaterThan(0);
		expect(player.ratings.every((rating) => rating.games > 0)).toBe(true);
		expect(player.ratings.map((rating) => rating.perf)).not.toContain("chess960");
		expect(player.count.all).toBeGreaterThan(0);
		expect(mainPerf(player)).toBe("ultraBullet");
	});

	it("a closed account shows nothing but its name", () => {
		const { player } = userAnswer.parse({
			id: "Gone",
			username: "Gone",
			disabled: true,
			profile: { bio: "hello", links: "example.com" },
			perfs: { blitz: { games: 4, rating: 1500 } },
		});
		expect(player).toMatchObject({ id: "gone", closed: true, ratings: [], profile: { bio: null, links: [] } });
	});

	it("a profile's links are web addresses only, its bio clipped", () => {
		const { player } = userAnswer.parse({
			id: "x1",
			username: "x1",
			profile: { bio: "b".repeat(1_000), links: "example.com/a\njavascript:alert(1)\nhttps://t.example/b" },
		});
		expect(player.profile.links).toEqual(["example.com/a", "https://t.example/b"]);
		expect(player.profile.bio).toHaveLength(400);
	});

	it("online, playing and the game's id", () => {
		const status = userStatusAnswer.parse(recorded("/api/users/status", { ids: PLAYER, withGameIds: "true" }));
		expect(status[0]?.id).toBe(PLAYER);
		expect(userStatusAnswer.parse([{ id: "A", online: true, playing: true, playingId: "abcdEFGH" }])[0]).toEqual({
			id: "a",
			online: true,
			playingId: "abcdEFGH",
		});
	});

	it("each leaderboard lists its rating's players", () => {
		for (const perf of ["bullet", "blitz", "rapid", "classical", "ultraBullet"] as const) {
			const board = leaderboardAnswer(perf).parse(recorded(`/api/player/top/50/${perf}`));
			expect(board.players.length).toBeGreaterThan(10);
			const ratings = board.players.map((player) => player.rating);
			expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
		}
	});

	it("the rating history: days counted from 1, standard series only, thinned for the chart", () => {
		const series = ratingHistoryAnswer.parse(recorded(`/api/user/${PLAYER}/rating-history`));
		expect(series.map((each) => each.perf)).not.toContain("puzzle");
		expect(ratingHistoryAnswer.parse([{ name: "Blitz", points: [[2026, 0, 31, 1500]] }])).toEqual([
			{ perf: "blitz", points: [["2026-01-31", 1500]] },
		]);
		const long = series.find((each) => each.perf === "ultraBullet");
		expect(long?.points.length).toBeGreaterThan(120);
		const rows = historyRows(series, "ultraBullet");
		expect(rows.length).toBeLessThanOrEqual(120);
		expect(rows.length).toBeGreaterThan(60);
		expect(rows.at(-1)).toEqual({ day: long?.points.at(-1)?.[0], rating: long?.points.at(-1)?.[1] });
		expect(historyRows(series, "rapid")).toEqual([]);
	});

	it("a rating's details and the activity", () => {
		const stats = perfStatsAnswer("ultraBullet").parse(recorded(`/api/user/${PLAYER}/perf/ultraBullet`));
		expect(stats.perf).toBe("ultraBullet");
		expect(stats.games).toBeGreaterThan(0);
		expect(stats.count.win + stats.count.loss + stats.count.draw).toBeLessThanOrEqual(stats.count.all);
		expect(stats.bestWins.length).toBeLessThanOrEqual(5);
		const days = activityAnswer.parse(recorded(`/api/user/${PLAYER}/activity`));
		expect(days.length).toBeGreaterThan(0);
		expect(days.every((day) => day.games.every((games) => games.perf !== undefined))).toBe(true);
	});

	it("a page of games, the crosstable and the search", () => {
		const params = {
			max: "20",
			perfType: "ultraBullet,bullet,blitz,rapid,classical,correspondence",
			ongoing: "true",
			lastFen: "true",
			opening: "true",
			sort: "dateDesc",
		};
		const lines = text(`/api/games/user/${PLAYER}`, params).trim().split("\n");
		const games = lines.map((line) => gameLineAnswer.parse(JSON.parse(line)));
		expect(games).toHaveLength(20);
		expect(games.every((game) => game.lastFen !== null && game.plies > 0)).toBe(true);
		expect(games.every((game) => [game.white.id, game.black.id].includes(PLAYER))).toBe(true);
		expect(crosstableAnswer("Me", "them").parse({ users: { me: 2.5, them: 1.5 }, nbGames: 4 })).toEqual({
			you: 2.5,
			them: 1.5,
			games: 4,
		});
		const found = autocompleteAnswer.parse(
			recorded("/api/player/autocomplete", { term: "nihalsarin200", object: "true" }),
		);
		expect(found.some((player) => player.id === PLAYER)).toBe(true);
	});
});

describe("A page of games", () => {
	const base = { username: "Someone" };

	it("asks for standard chess, the games in progress on the first page only, and pages by time", () => {
		expect(gamesParams(base, 20)).toMatchObject({
			max: 20,
			perfType: "ultraBullet,bullet,blitz,rapid,classical,correspondence",
			ongoing: true,
			until: undefined,
		});
		const page = gamesParams({ ...base, perf: "blitz", before: 1_000, vs: "Rival", rated: false }, 20);
		expect(page).toMatchObject({ perfType: "blitz", until: 999, ongoing: undefined, vs: "rival", rated: false });
		// The "until" day is included; the cursor wins when it's earlier.
		const days = gamesParams({ ...base, since: "2026-01-01", until: "2026-01-31" }, 20);
		expect(days.since).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
		expect(days.until).toBe(Date.parse("2026-02-01T00:00:00.000Z") - 1);
	});

	it("tells a win, a loss and a draw from the player's side", () => {
		const game = gameLineAnswer.parse({
			id: "abcdEFGH",
			variant: "standard",
			status: "mate",
			winner: "black",
			players: { white: { user: { id: "a", name: "A" } }, black: { user: { id: "b", name: "B" } } },
		});
		expect(resultOf(game, "b")).toBe("win");
		expect(resultOf(game, "a")).toBe("loss");
		expect(resultOf({ ...game, winner: null, status: "draw" }, "a")).toBe("draw");
		expect(resultOf({ ...game, status: "started", ongoing: true }, "a")).toBeNull();
		expect(scoreOf(game)).toBe("0–1");
		expect(
			gameKind({ rated: true, perf: "blitz", clock: { initial: 180, increment: 2 }, daysPerTurn: null }),
		).toContain("3+2");
	});

	it("the URL: the games tab's filters become the input, and junk is dropped", () => {
		const search = playerSearch.parse({ tab: "games", mode: "casual", result: "win", vs: "x", before: "123" });
		expect(search).toMatchObject({ tab: "games", mode: "casual", result: "win", vs: undefined, before: 123 });
		expect(gamesInputOf("Player1", search)).toEqual({ username: "Player1", rated: false, result: "win", before: 123 });
		expect(playerGamesInput.safeParse(gamesInputOf("Player1", search)).success).toBe(true);
		expect(playersSearch.parse({ perf: "correspondence" })).toEqual({ perf: undefined });
		expect(playerSearchInput.safeParse({ term: "ab" }).success).toBe(false);
		expect(playerSearchInput.safeParse({ term: "a b c" }).success).toBe(false);
	});
});

describe("A finished game's replay", () => {
	it("the export: players, clocks in ms, Lichess's analysis by move", () => {
		const game = exported();
		expect(game).toMatchObject({ id: "T8myeL3d", standard: true, ongoing: false, finished: true, winner: "black" });
		expect(game.moves).toHaveLength(64);
		expect(game.clocks?.[0]).toBe(300_030);
		expect(game.analysis).toHaveLength(64);
		expect(game.analysis?.[19]).toEqual({ eval: { cp: 216 }, judgement: "blunder", best: "c6d4" });
		expect(game.analysis?.[63]).toEqual({ eval: null, judgement: null, best: null });
		expect(game.white.analysis).toMatchObject({ inaccuracy: 4, mistake: 4, blunder: 1, acpl: 64 });
	});

	it("the line: every move with its clock, eval and judgement as a symbol", () => {
		const game = exported();
		const line = replayLine(game);
		expect(line.ids).toHaveLength(65);
		expect(line.uci[0]).toBe("c2c4");
		const blunder = line.tree.nodes[line.ids[20] as string];
		expect(blunder).toMatchObject({ san: "Ne5", nags: [JUDGEMENT_NAGS.blunder], eval: { cp: 216 } });
		expect(replayScores(game)).toHaveLength(64);
		expect(replayEnding(game)).toEqual({ result: "0-1", reason: "checkmate" });
	});

	it("each side's clock after a move, the start before its first", () => {
		const game = exported();
		const { startFen } = replayLine(game);
		expect(clocksAt(game, startFen, 0)).toEqual({ white: 600_000, black: 600_000 });
		expect(clocksAt(game, startFen, 1)).toEqual({ white: 300_030, black: 600_000 });
		expect(clocksAt(game, startFen, 2)).toEqual({ white: 300_030, black: 600_030 });
		expect(clocksAt({ ...game, clock: null }, startFen, 2)).toBeNull();
	});

	it("an aborted game has no result, a variant isn't standard", () => {
		expect(replayEnding({ status: "aborted", winner: null })).toBeNull();
		const variant = gameExportAnswer.parse({ id: "abcdEFGH", variant: "chess960", status: "started", pgn: "" });
		expect(variant).toMatchObject({ standard: false, ongoing: true, finished: false, moves: [], analysis: null });
	});
});
