#!/usr/bin/env node
/**
 * pnpm parda:probe: Parda's daily source probe (PLAN 12.5, "The daily probe"; decision
 * 0238). `.github/workflows/parda-probe.yml` runs it once a day; it also runs by hand.
 *
 * It asks the app what to probe (`GET /api/parda/probe`: each enabled source, filled for
 * the most popular movie, series and anime), plays each in real Chrome, and posts what a
 * page can see from outside the player (`POST /api/parda/probe`): whether it played, how
 * fast, the tallest picture and the stream's ladder, popups per click, top-page redirects
 * and the hosts the video came from.
 *
 * - One throwaway browser context per source and title, one iframe on a page the probe
 *   serves itself at the app's own origin (so a player that only lets this app frame it
 *   still plays).
 * - Each second it reads the longest `<video>` in every frame, falling back to the
 *   player's position messages; the ladder comes from `RESOLUTION=` lines in `#EXTM3U`
 *   responses. Nothing else from a response is kept.
 * - If nothing plays it clicks the player's centre now and then, closing every popup at
 *   once and counting it.
 * - It's an ordinary automated browser and never hides that: a site may refuse it, which
 *   is why a probe failure alone never demotes a source viewers watch.
 *
 * Env: PARDA_PROBE_URL (the app, e.g. https://example.com), PARDA_PROBE_SECRET.
 * Flags: --dry-run (print, post nothing), --seconds=N (per title, default 45),
 * --headed (watch it).
 */
import type { Browser, Page } from "playwright";

export type ProbePlan = {
	titles: Array<{ media: "movie" | "tv"; id: number; season?: number; episode?: number; name: string }>;
	sources: Array<{ id: string; name: string; adapter: string; needsClick: boolean; urls: Array<string | null> }>;
};

export type ProbeResult = {
	sourceId: string;
	media: "movie" | "tv";
	tmdbId: number;
	season?: number;
	episode?: number;
	alive: boolean;
	startMs: number | null;
	topHeight: number | null;
	ladder: number[];
	popups: number;
	clicks: number;
	redirects: number;
	videoHosts: string[];
	error: string | null;
};

/** The page the probe serves at the app's origin: one player and a listener for its position messages. */
export const PROBE_PATH = "/__parda-probe";

/** Heights a master playlist offers (`RESOLUTION=1920x1080`), tallest first. */
export function ladderHeights(playlist: string): number[] {
	if (!playlist.trimStart().startsWith("#EXTM3U")) return [];
	const heights = new Set<number>();
	for (const match of playlist.matchAll(/RESOLUTION=\d+x(\d+)/gi)) {
		const height = Number(match[1]);
		if (height > 0 && height <= 4320) heights.add(height);
	}
	return [...heights].sort((a, b) => b - a);
}

/**
 * A playback position in a player's message, whatever its shape: our `parda` protocol's
 * `event.position`, a `currentTime`, Viduki's `MEDIA_DATA` `progress.watched` (a series'
 * sits under `show_progress`, six levels down), or a JSON string holding any of them.
 */
export function positionOf(data: unknown, depth = 0): number | null {
	if (depth > 6 || data === null || data === undefined) return null;
	if (typeof data === "string") {
		if (!data.startsWith("{")) return null;
		try {
			return positionOf(JSON.parse(data), depth + 1);
		} catch {
			return null;
		}
	}
	if (typeof data !== "object") return null;
	const record = data as Record<string, unknown>;
	for (const key of ["position", "currentTime", "watched"]) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	}
	for (const value of Object.values(record)) {
		const found = positionOf(value, depth + 1);
		if (found !== null) return found;
	}
	return null;
}

const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export const probePage = (url: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Parda probe</title>
<style>html,body{margin:0;background:#000}iframe{display:block;width:1280px;height:720px;border:0}</style></head>
<body><iframe id="player" src="${attribute(url)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="origin"></iframe>
<script>
const positionOf = ${positionOf.toString()};
const frame = document.getElementById("player");
window.__probe = { position: null };
window.addEventListener("message", (event) => {
	if (event.source !== frame.contentWindow) return;
	const position = positionOf(event.data, 0);
	if (position !== null) window.__probe.position = position;
});
</script></body></html>`;

type Sample = { position: number | null; height: number | null };

/** The longest `<video>` in any frame, else the player's last position message. */
async function sample(page: Page): Promise<Sample> {
	let best: { duration: number; position: number; height: number } | null = null;
	for (const frame of page.frames()) {
		const found = await frame
			.evaluate(() => {
				const videos = [...document.querySelectorAll("video")];
				const longest = videos.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
				return longest
					? { duration: longest.duration || 0, position: longest.currentTime, height: longest.videoHeight }
					: null;
			})
			.catch(() => null);
		if (found && (!best || found.duration > best.duration)) best = found;
	}
	if (best) return { position: best.position, height: best.height || null };
	const position = await page
		.evaluate(() => (window as unknown as { __probe?: { position: number | null } }).__probe?.position ?? null)
		.catch(() => null);
	return { position, height: null };
}

const MEDIA_URL = /\.(m3u8|ts|m4s|mp4|webm)(\?|$)/i;
const CLICK_AFTER_MS = 4_000;
const CLICK_EVERY_MS = 5_000;
const MAX_CLICKS = 4;
/** After the first movement, keep watching this long: adaptive players ramp up. */
const SETTLE_MS = 15_000;

export async function probeOne(
	browser: Browser,
	appOrigin: string,
	url: string,
	options: { seconds: number },
): Promise<Omit<ProbeResult, "sourceId" | "media" | "tmdbId" | "season" | "episode">> {
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	let popups = 0;
	context.on("page", (popup) => {
		popups += 1;
		void popup.close().catch(() => {});
	});
	const page = await context.newPage();
	const ladder = new Set<number>();
	const hosts = new Set<string>();
	page.on("response", (response) => {
		const type = response.headers()["content-type"] ?? "";
		const address = response.url();
		const playlist = /mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(address);
		if (!playlist && !/^(video|audio)\//i.test(type) && !MEDIA_URL.test(address)) return;
		try {
			hosts.add(new URL(address).hostname);
		} catch {
			return;
		}
		if (playlist) {
			void response
				.text()
				.then((text) => {
					for (const height of ladderHeights(text)) ladder.add(height);
				})
				.catch(() => {});
		}
	});
	const probeUrl = `${appOrigin}${PROBE_PATH}`;
	await page.route(probeUrl, (route) =>
		route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: probePage(url) }),
	);
	let redirects = 0;
	page.on("framenavigated", (frame) => {
		if (frame === page.mainFrame() && frame.url() !== probeUrl) redirects += 1;
	});

	let error: string | null = null;
	let startMs: number | null = null;
	let topHeight: number | null = null;
	let clicks = 0;
	let lastClick = 0;
	let first: number | null = null;
	const setAt = Date.now();
	try {
		await page.goto(probeUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
		const until = setAt + options.seconds * 1_000;
		while (Date.now() < until) {
			await page.waitForTimeout(1_000);
			if (redirects > 0) {
				error = "redirected";
				break;
			}
			const now = Date.now();
			const { position, height } = await sample(page);
			if (height) topHeight = Math.max(topHeight ?? 0, height);
			if (position !== null) {
				if (first === null) first = position;
				else if (startMs === null && position !== first) startMs = now - setAt;
			}
			if (startMs !== null) {
				if (now - setAt - startMs >= SETTLE_MS) break;
				continue;
			}
			if (now - setAt >= CLICK_AFTER_MS && now - lastClick >= CLICK_EVERY_MS && clicks < MAX_CLICKS) {
				clicks += 1;
				lastClick = now;
				await page.mouse.click(640, 360).catch(() => {});
			}
		}
	} catch (caught) {
		error = (caught instanceof Error ? caught.message : String(caught)).slice(0, 200);
	} finally {
		await context.close().catch(() => {});
	}
	const heights = [...ladder].sort((a, b) => b - a);
	const tallest = Math.max(topHeight ?? 0, heights[0] ?? 0);
	return {
		alive: startMs !== null,
		startMs: startMs === null ? null : Math.min(600_000, startMs),
		topHeight: tallest > 0 ? Math.min(4320, tallest) : null,
		ladder: heights.slice(0, 20),
		popups,
		clicks,
		redirects,
		videoHosts: [...hosts].slice(0, 20),
		error: error ?? (startMs === null ? "never-moved" : null),
	};
}

const flag = (name: string) => process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));

async function main() {
	process.loadEnvFile?.(".env");
	const base = process.env.PARDA_PROBE_URL?.replace(/\/$/, "");
	const secret = process.env.PARDA_PROBE_SECRET;
	if (!base || !secret) {
		console.error("probe-sources: set PARDA_PROBE_URL and PARDA_PROBE_SECRET first.");
		process.exit(1);
	}
	const seconds = Number(flag("seconds")?.split("=")[1] ?? 45);
	const dryRun = Boolean(flag("dry-run"));
	const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
	const endpoint = `${base}/api/parda/probe`;

	const planned = await fetch(endpoint, { headers });
	if (!planned.ok) {
		console.error(`probe-sources: GET ${endpoint} answered ${planned.status}.`);
		process.exit(1);
	}
	const plan = (await planned.json()) as ProbePlan;
	if (plan.sources.length === 0 || plan.titles.length === 0) {
		console.log("probe-sources: nothing to probe (playback off, no sources or no titles yet).");
		return;
	}

	const { chromium } = await import("playwright");
	const browser = await chromium.launch({
		channel: "chrome",
		headless: !flag("headed"),
		// Players start without a gesture where they can; the probe clicks where they can't.
		args: ["--autoplay-policy=no-user-gesture-required"],
	});
	const appOrigin = new URL(base).origin;
	const results: ProbeResult[] = [];
	const started = Date.now();
	try {
		for (const source of plan.sources) {
			for (const [index, title] of plan.titles.entries()) {
				const url = source.urls[index];
				if (!url) continue;
				const seen = await probeOne(browser, appOrigin, url, { seconds });
				results.push({
					sourceId: source.id,
					media: title.media,
					tmdbId: title.id,
					...(title.season === undefined ? {} : { season: title.season }),
					...(title.episode === undefined ? {} : { episode: title.episode }),
					...seen,
				});
				const start = seen.startMs === null ? "—" : `${(seen.startMs / 1000).toFixed(1)} s`;
				console.log(
					`${source.name} · ${title.name}: ${seen.alive ? "played" : "didn't play"}, start ${start}, ` +
						`${seen.topHeight ?? "?"}p, ${seen.popups} popups / ${seen.clicks} clicks, ${seen.redirects} redirects` +
						(seen.error ? ` (${seen.error})` : ""),
				);
			}
		}
	} finally {
		await browser.close();
	}
	console.log(`probe-sources: ${results.length} runs in ${Math.round((Date.now() - started) / 1000)} s.`);
	if (dryRun || results.length === 0) return;
	const posted = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ results }) });
	if (!posted.ok) {
		console.error(`probe-sources: POST ${endpoint} answered ${posted.status}: ${await posted.text()}`);
		process.exit(1);
	}
	console.log(`probe-sources: stored ${JSON.stringify(await posted.json())}`);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
}
