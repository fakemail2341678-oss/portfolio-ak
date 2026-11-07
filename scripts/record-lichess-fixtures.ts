#!/usr/bin/env node
/**
 * pnpm lichess:record: writes tests/fixtures/lichess/ from Lichess's real answers
 * (decision 0255). Tests and the e2e stand-in (e2e/harness/lichess.ts) read these files,
 * and neither ever calls Lichess. One request at a time, a second apart, as Lichess asks.
 *
 * It records the public answers Chaal reads so far (the daily puzzle, the TV channels, a
 * cloud eval, a tablebase position) and the first lines of the TV feed. The opening
 * explorer refuses calls without a token: with LICHESS_APP_TOKEN in .env (a personal
 * token with no scopes) it records the masters and Lichess databases too; without it,
 * it keeps the files already there. `events.ndjson` (the event stream's opening lines) is
 * written by hand from the API's examples: recording it needs a connected account.
 *
 * Files are named by `lichessFixtureName` (e2e/harness/lichess.ts). Tests read ids from
 * the files, so recording again changes no test.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
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

/** The first `lines` lines of an ndjson stream, then it's closed. */
async function recordStream(pathname: string, file: string, lines: number, maxMs: number) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), maxMs);
	const kept: string[] = [];
	try {
		const response = await fetch(`${BASES.api}${pathname}`, { headers: HEADERS, signal: controller.signal });
		if (!response.ok || !response.body) throw new Error(`${pathname}: ${response.status}`);
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of response.body) {
			buffer += decoder.decode(chunk, { stream: true });
			const parts = buffer.split("\n");
			buffer = parts.pop() ?? "";
			kept.push(...parts.filter((line) => line.trim()));
			if (kept.length >= lines) break;
		}
	} catch (error) {
		if (!controller.signal.aborted) throw error;
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
	writeFileSync(path.join(OUT, file), `${kept.slice(0, lines).join("\n")}\n`);
	console.log(`  ${file} (${Math.min(kept.length, lines)} lines)`);
	await pause();
}

mkdirSync(OUT, { recursive: true });
console.log("record-lichess-fixtures:");
await record("api", "/api/puzzle/daily");
await record("api", "/api/tv/channels");
await record("api", "/api/cloud-eval", { fen: SAMPLE_FEN, multiPv: "3" });
await record("tablebase", "/standard", { fen: TABLEBASE_FEN });
await recordStream("/api/tv/feed", "api_tv_feed.ndjson", 6, 20_000);
if (APP_TOKEN) {
	await record("explorer", "/masters", { fen: SAMPLE_FEN }, APP_TOKEN);
	await record("explorer", "/lichess", { variant: "standard", fen: SAMPLE_FEN }, APP_TOKEN);
} else {
	console.log("  (the explorer needs LICHESS_APP_TOKEN: kept what's there)");
}
console.log(`record-lichess-fixtures: ${readdirSync(OUT).length} files in tests/fixtures/lichess`);
