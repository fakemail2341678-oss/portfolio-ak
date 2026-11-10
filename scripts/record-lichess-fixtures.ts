#!/usr/bin/env node
/**
 * pnpm lichess:record: writes tests/fixtures/lichess/ from Lichess's real answers
 * (decision 0255). Tests and the e2e stand-in (e2e/harness/lichess.ts) read these files,
 * and neither ever calls Lichess. One request at a time, a second apart, as Lichess asks.
 *
 * It records the public answers Chaal reads so far: the daily puzzle, the TV channels, cloud
 * evals of the start and of 1. e4, a tablebase position, the first lines of the TV feed,
 * the daily puzzle's game as importing it into analysis reads it (Task 75), and a batch of
 * puzzles, the fake Lichess's pool for training (Task 80; `pnpm lichess:record puzzles`
 * records only that), and a player (Task 81: the leaderboards, the profile and status, the
 * rating history, details and activity, the latest games, a search; `pnpm lichess:record
 * players` records only those), and watch (Task 82: the TV's channels and their games, the live
 * streamers, the broadcasts' lists, a tournament, two rounds and a board of each; `pnpm
 * lichess:record watch` records only those), and community (Task 83: the arenas' list, an arena
 * of each state, a finished Swiss and its results, a team with its members and tournaments,
 * popular teams and a search, an account's studies and one study's PGN; `pnpm lichess:record
 * community` records only those). The
 * opening explorer refuses calls without a token: with LICHESS_APP_TOKEN in .env (a
 * personal token with no scopes) it records the masters and Lichess databases at the start
 * and after 1. e4, and a player's games (the stream's last line); without it, it keeps the
 * files already there. `events.ndjson` (the event stream's opening lines) is
 * written by hand from the API's examples: recording it needs a connected account.
 *
 * Files are named by `lichessFixtureName` (e2e/harness/lichess.ts). Tests read ids from
 * the files, so recording again changes no test.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type LichessHost, lichessFixtureName } from "../e2e/harness/lichess.ts";

process.loadEnvFile?.(".env");
const BASES: Record<LichessHost, string> = {
	api: process.env.LICHESS_API_BASE ?? "https://lichess.org",
	explorer: process.env.LICHESS_EXPLORER_BASE ?? "https://explorer.lichess.org",
	tablebase: process.env.LICHESS_TABLEBASE_BASE ?? "https://tablebase.lichess.org",
};
const APP_TOKEN = process.env.LICHESS_APP_TOKEN;
const OUT = path.resolve(import.meta.dirname, "../tests/fixtures/lichess");
/** In English, as Chaal asks (Lichess names a round "Round 1" in the language it's asked in). */
const HEADERS = {
	"user-agent": "Chaal-recorder/1 (template fixtures)",
	accept: "application/json",
	"accept-language": "en",
};

/** After 1. e4, a position every database and the cloud know. */
const SAMPLE_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
/** King and pawn against king and pawn: a tablebase win in a few moves. */
const TABLEBASE_FEN = "4k3/6KP/8/8/8/8/7p/8 w - - 0 1";

const pause = () => new Promise((resolve) => setTimeout(resolve, 1_100));

async function record(host: LichessHost, pathname: string, params: Record<string, string> = {}, token?: string) {
	const url = new URL(`${BASES[host]}${pathname}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	const response = await fetch(url, { headers: token ? { ...HEADERS, authorization: `Bearer ${token}` } : HEADERS });
	if (!response.ok) throw new Error(`${host} ${pathname}: ${response.status}`);
	const name = lichessFixtureName(host, pathname, Object.entries(params));
	// One line per file: code reads these.
	writeFileSync(path.join(OUT, name), `${JSON.stringify(await response.json())}\n`);
	console.log(`  ${name}`);
	await pause();
}

type StreamRecording = {
	host?: LichessHost;
	pathname: string;
	params?: Record<string, string>;
	token?: string;
	/** The file, or the fixture name with `.ndjson` when absent (a stream's answer, as the fake Lichess serves it). */
	file?: string;
	lines: number;
	/** The stream's first lines (TV: it never ends), or its last (the player explorer: each line restates the numbers). */
	keep: "first" | "last";
	maxMs: number;
};

/** An ndjson stream's lines, until it ends, `maxMs` passes or (keeping the first) enough came. */
async function recordStream({ host = "api", pathname, params = {}, token, file, lines, keep, maxMs }: StreamRecording) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), maxMs);
	const kept: string[] = [];
	const url = new URL(`${BASES[host]}${pathname}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	try {
		// Streams and exports answer ndjson (a games export would otherwise be PGN).
		const ndjson = { ...HEADERS, accept: "application/x-ndjson" };
		const headers = token ? { ...ndjson, authorization: `Bearer ${token}` } : ndjson;
		const response = await fetch(url, { headers, signal: controller.signal });
		if (!response.ok || !response.body) throw new Error(`${pathname}: ${response.status}`);
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of response.body) {
			buffer += decoder.decode(chunk, { stream: true });
			const parts = buffer.split("\n");
			buffer = parts.pop() ?? "";
			kept.push(...parts.filter((line) => line.trim()));
			if (keep === "first" && kept.length >= lines) break;
		}
		if (buffer.trim()) kept.push(buffer.trim());
	} catch (error) {
		if (!controller.signal.aborted) throw error;
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
	const name = file ?? lichessFixtureName(host, pathname, Object.entries(params)).replace(/\.json$/, ".ndjson");
	const chosen = keep === "first" ? kept.slice(0, lines) : kept.slice(-lines);
	writeFileSync(path.join(OUT, name), `${chosen.join("\n")}\n`);
	console.log(`  ${name} (${chosen.length} of ${kept.length} lines)`);
	await pause();
}

// The parameters below are the ones Chaal sends (src/server/chaal/analysis/lichess.ts): the
// fake Lichess finds a recording by them, so a change there is a change here (Task 75).
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** A player whose games the explorer has indexed, for the player tab. */
const EXPLORER_PLAYER = "thibault";
/** Training's pool in the fake Lichess (Task 80): one anonymous batch of mixed puzzles. */
const PUZZLE_BATCH = { path: "/api/puzzle/batch/mix", params: { nb: "15" } };
/** The player the fake Lichess knows (Task 81): an account with games at every speed. */
const PLAYER = "nihalsarin2004";
/** What the palette's search types in e2e. */
const PLAYER_TERM = "nihalsarin200";
/** The leaderboards Chaal shows, and how many players each lists (src/features/chaal/players/schema.ts). */
const LEADERBOARDS = ["bullet", "blitz", "rapid", "classical", "ultraBullet"];
const LEADERBOARD_SIZE = 50;
/** The standard ratings, as a games page without a rating filter asks for them. */
const PLAYER_PERFS = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"];

/**
 * A player, as Chaal reads one (src/server/chaal/players/service.ts): the parameters are
 * the ones it sends, so the fake Lichess finds each recording by them.
 */
async function recordPlayer() {
	for (const perf of LEADERBOARDS) await record("api", `/api/player/top/${LEADERBOARD_SIZE}/${perf}`);
	await record("api", `/api/user/${PLAYER}`);
	await record("api", "/api/users/status", { ids: PLAYER, withGameIds: "true" });
	await record("api", `/api/user/${PLAYER}/rating-history`);
	await record("api", `/api/user/${PLAYER}/activity`);
	// The rating the overview opens on: the one with the most games (mainPerf).
	const user = JSON.parse(readFileSync(path.join(OUT, lichessFixtureName("api", `/api/user/${PLAYER}`)), "utf8")) as {
		perfs: Record<string, { games?: number }>;
	};
	const main = PLAYER_PERFS.reduce((best, perf) =>
		(user.perfs[perf]?.games ?? 0) > (user.perfs[best]?.games ?? 0) ? perf : best,
	);
	await record("api", `/api/user/${PLAYER}/perf/${main}`);
	await recordStream({
		pathname: `/api/games/user/${PLAYER}`,
		params: {
			max: "20",
			perfType: PLAYER_PERFS.join(","),
			ongoing: "true",
			lastFen: "true",
			opening: "true",
			sort: "dateDesc",
		},
		lines: 20,
		keep: "first",
		maxMs: 30_000,
	});
	await record("api", "/api/player/autocomplete", { term: PLAYER_TERM, object: "true" });
}

/** The game-export parameters importing a game sends. */
const GAME_EXPORT = { pgnInJson: "true", clocks: "true", evals: "true", opening: "true", literate: "false" };

/** The TV channels Chaal shows: standard chess only (src/features/chaal/watch/schema.ts). */
const TV_CHANNELS = ["best", "bullet", "blitz", "rapid", "classical", "ultraBullet", "bot", "computer"];
/** What the TV page asks of its games' export: their last positions, without the moves. */
const TV_EXPORT = { moves: "false", lastFen: "true" };
/**
 * The broadcast the fake Lichess knows (Task 82): an official tournament that has finished,
 * so its rounds stay as recorded. Its default round and its first one are recorded, each with
 * its first board's PGN (the fake Lichess plays the first round as live).
 */
const BROADCAST_TOUR = "9NE16qcS";
/** What the broadcasts page's search types in e2e. */
const BROADCAST_TERM = "spice";

/** A text answer (a PGN) as Lichess sends it, kept as it came. */
async function recordText(pathname: string) {
	const url = new URL(`${BASES.api}${pathname}`);
	const response = await fetch(url, { headers: { ...HEADERS, accept: "application/x-chess-pgn" } });
	if (!response.ok) throw new Error(`api ${pathname}: ${response.status}`);
	const name = lichessFixtureName("api", pathname);
	writeFileSync(path.join(OUT, name), await response.text());
	console.log(`  ${name}`);
	await pause();
}

/** A POST whose answer is ndjson (an export by ids): every line, named by the path and parameters. */
async function recordPostLines(pathname: string, params: Record<string, string>, body: string) {
	const url = new URL(`${BASES.api}${pathname}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	const response = await fetch(url, {
		method: "POST",
		headers: { ...HEADERS, accept: "application/x-ndjson", "content-type": "text/plain" },
		body,
	});
	if (!response.ok) throw new Error(`api ${pathname}: ${response.status}`);
	const lines = (await response.text()).split("\n").filter((line) => line.trim());
	const name = lichessFixtureName("api", pathname, Object.entries(params)).replace(/\.json$/, ".ndjson");
	writeFileSync(path.join(OUT, name), `${lines.join("\n")}\n`);
	console.log(`  ${name} (${lines.length} lines)`);
	await pause();
}

const readRecorded = <T>(name: string): T => JSON.parse(readFileSync(path.join(OUT, name), "utf8")) as T;

/**
 * Watch (Task 82), as Chaal reads it (src/server/chaal/watch/service.ts): the TV's channels
 * and their games' last positions (one export by ids), the live streamers, the broadcasts'
 * lists (top, official, a search), a tournament, two of its rounds and a board of each. The
 * TV and game streams are the fake Lichess's own (e2e/harness/lichess-watch.ts).
 */
async function recordWatch() {
	await record("api", "/api/tv/channels");
	const channels = readRecorded<Record<string, { gameId?: string }>>("api_tv_channels.json");
	const ids = TV_CHANNELS.map((channel) => channels[channel]?.gameId).filter(Boolean);
	await recordPostLines("/api/games/export/_ids", TV_EXPORT, ids.join(","));
	await record("api", "/api/streamer/live");
	await record("api", "/api/broadcast/top", { page: "1" });
	await recordStream({ pathname: "/api/broadcast", params: { nb: "20" }, lines: 20, keep: "first", maxMs: 30_000 });
	await record("api", "/api/broadcast/search", { q: BROADCAST_TERM, page: "1" });
	await record("api", `/api/broadcast/${BROADCAST_TOUR}`);
	const tour = readRecorded<{ rounds: Array<{ id: string }>; defaultRoundId?: string }>(
		lichessFixtureName("api", `/api/broadcast/${BROADCAST_TOUR}`),
	);
	const rounds = [...new Set([tour.defaultRoundId ?? tour.rounds.at(-1)?.id, tour.rounds[0]?.id])].filter(
		(id): id is string => Boolean(id),
	);
	for (const round of rounds) {
		await record("api", `/api/broadcast/-/-/${round}`);
		const answer = readRecorded<{ games: Array<{ id: string }> }>(
			lichessFixtureName("api", `/api/broadcast/-/-/${round}`),
		);
		const first = answer.games[0]?.id;
		if (first) await recordText(`/api/study/${round}/${first}.pgn`);
	}
}

/** The team the fake Lichess knows (Task 83): Lichess's own Swiss team, with Swiss tournaments. */
const COMMUNITY_TEAM = "lichess-swiss";
/** What the teams page's search types in e2e. */
const TEAM_TERM = "nepal";
/** The account whose public studies the studies page shows first (`ch_settings.community.studiesBy`'s default). */
const STUDIES_BY = "lichess";
/** How many of a team's members, and of an account's studies, Chaal reads (src/features/chaal/community/schema.ts). */
const MEMBERS_SHOWN = 30;
const STUDIES_SHOWN = 100;
/** A study's PGN the fake serves whole; a smaller one keeps the fixtures light. */
const STUDY_MAX_BYTES = 120_000;

/**
 * Community (Task 83), as Chaal reads it (src/server/chaal/community/): the arenas' list and
 * one arena of each state (created, started, finished: standard chess, the first in each),
 * a finished Swiss and its results, the team's Swiss and arenas, popular teams, a search,
 * the team and its first members, an account's studies and the first of them that's small.
 */
async function recordCommunity() {
	await record("api", "/api/tournament");
	const list =
		readRecorded<Record<"created" | "started" | "finished", Array<{ id: string; variant: { key: string } }>>>(
			"api_tournament.json",
		);
	for (const state of ["created", "started", "finished"] as const) {
		const arena = list[state].find((each) => each.variant.key === "standard");
		if (arena) await record("api", `/api/tournament/${arena.id}`, { page: "1" });
	}
	const team = `/api/team/${COMMUNITY_TEAM}`;
	await recordStream({ pathname: `${team}/swiss`, params: { max: "10" }, lines: 10, keep: "first", maxMs: 30_000 });
	await recordStream({ pathname: `${team}/arena`, params: { max: "10" }, lines: 10, keep: "first", maxMs: 30_000 });
	// A finished Swiss for the results (the team's list opens with the coming ones).
	const finished = new URL(`${BASES.api}${team}/swiss`);
	finished.searchParams.set("max", "1");
	finished.searchParams.set("status", "finished");
	const swissLine = (
		await (await fetch(finished, { headers: { ...HEADERS, accept: "application/x-ndjson" } })).text()
	).split("\n")[0];
	await pause();
	const swiss = swissLine ? (JSON.parse(swissLine) as { id: string }).id : null;
	if (swiss) {
		await record("api", `/api/swiss/${swiss}`);
		await recordStream({
			pathname: `/api/swiss/${swiss}/results`,
			params: { nb: "100" },
			lines: 100,
			keep: "first",
			maxMs: 30_000,
		});
	}
	await record("api", "/api/team/all", { page: "1" });
	await record("api", "/api/team/search", { text: TEAM_TERM, page: "1" });
	await record("api", team);
	await recordStream({ pathname: `${team}/users`, lines: MEMBERS_SHOWN, keep: "first", maxMs: 30_000 });
	await recordStream({
		pathname: `/api/study/by/${STUDIES_BY}`,
		lines: STUDIES_SHOWN,
		keep: "first",
		maxMs: 30_000,
	});
	const studies = readFileSync(
		path.join(OUT, lichessFixtureName("api", `/api/study/by/${STUDIES_BY}`).replace(/\.json$/, ".ndjson")),
		"utf8",
	)
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => (JSON.parse(line) as { id: string }).id);
	for (const id of studies.slice(0, 10)) {
		const url = new URL(`${BASES.api}/api/study/${id}.pgn`);
		const response = await fetch(url, { headers: { ...HEADERS, accept: "application/x-chess-pgn" } });
		const text = await response.text();
		await pause();
		if (!response.ok || text.length > STUDY_MAX_BYTES) continue;
		const name = lichessFixtureName("api", `/api/study/${id}.pgn`);
		writeFileSync(path.join(OUT, name), text);
		console.log(`  ${name}`);
		break;
	}
}

mkdirSync(OUT, { recursive: true });
console.log("record-lichess-fixtures:");
/** `pnpm lichess:record puzzles`: only the puzzle batch, leaving every other recording as it is. */
const only = process.argv[2];
if (only === "puzzles") {
	await record("api", PUZZLE_BATCH.path, PUZZLE_BATCH.params);
	process.exit(0);
}
if (only === "players") {
	await recordPlayer();
	process.exit(0);
}
if (only === "watch") {
	await recordWatch();
	process.exit(0);
}
if (only === "community") {
	await recordCommunity();
	process.exit(0);
}
await record("api", "/api/puzzle/daily");
await record("api", PUZZLE_BATCH.path, PUZZLE_BATCH.params);
for (const fen of [START_FEN, SAMPLE_FEN]) await record("api", "/api/cloud-eval", { fen, multiPv: "3" });
await record("tablebase", "/standard", { fen: TABLEBASE_FEN });
await recordStream({ pathname: "/api/tv/feed", file: "api_tv_feed.ndjson", lines: 6, keep: "first", maxMs: 20_000 });
// A finished game to import into analysis: the daily puzzle's (its id is in the puzzle's recording).
const daily = JSON.parse(readFileSync(path.join(OUT, "api_puzzle_daily.json"), "utf8")) as { game: { id: string } };
await record("api", `/game/export/${daily.game.id}`, GAME_EXPORT);
await recordPlayer();
await recordWatch();
await recordCommunity();
if (APP_TOKEN) {
	for (const fen of [START_FEN, SAMPLE_FEN]) {
		await record("explorer", "/masters", { fen, topGames: "4", moves: "12" }, APP_TOKEN);
		await record(
			"explorer",
			"/lichess",
			{ variant: "standard", fen, topGames: "4", recentGames: "0", moves: "12" },
			APP_TOKEN,
		);
	}
	await recordStream({
		host: "explorer",
		pathname: "/player",
		params: {
			variant: "standard",
			fen: START_FEN,
			player: EXPLORER_PLAYER,
			color: "white",
			recentGames: "4",
			moves: "12",
		},
		token: APP_TOKEN,
		lines: 1,
		keep: "last",
		maxMs: 60_000,
	});
} else {
	console.log("  (the explorer needs LICHESS_APP_TOKEN: kept what's there)");
}
console.log(`record-lichess-fixtures: ${readdirSync(OUT).length} files in tests/fixtures/lichess`);
