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
 * records only that). The
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
const HEADERS = { "user-agent": "Chaal-recorder/1 (template fixtures)", accept: "application/json" };

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
		const headers = token ? { ...HEADERS, authorization: `Bearer ${token}` } : HEADERS;
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
/** The game-export parameters importing a game sends. */
const GAME_EXPORT = { pgnInJson: "true", clocks: "true", evals: "true", opening: "true", literate: "false" };

mkdirSync(OUT, { recursive: true });
console.log("record-lichess-fixtures:");
/** `pnpm lichess:record puzzles`: only the puzzle batch, leaving every other recording as it is. */
const only = process.argv[2];
if (only === "puzzles") {
	await record("api", PUZZLE_BATCH.path, PUZZLE_BATCH.params);
	process.exit(0);
}
await record("api", "/api/puzzle/daily");
await record("api", "/api/tv/channels");
await record("api", PUZZLE_BATCH.path, PUZZLE_BATCH.params);
for (const fen of [START_FEN, SAMPLE_FEN]) await record("api", "/api/cloud-eval", { fen, multiPv: "3" });
await record("tablebase", "/standard", { fen: TABLEBASE_FEN });
await recordStream({ pathname: "/api/tv/feed", file: "api_tv_feed.ndjson", lines: 6, keep: "first", maxMs: 20_000 });
// A finished game to import into analysis: the daily puzzle's (its id is in the puzzle's recording).
const daily = JSON.parse(readFileSync(path.join(OUT, "api_puzzle_daily.json"), "utf8")) as { game: { id: string } };
await record("api", `/game/export/${daily.game.id}`, GAME_EXPORT);
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
