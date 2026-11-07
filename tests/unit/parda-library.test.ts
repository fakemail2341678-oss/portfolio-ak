import { describe, expect, it } from "vitest";
import { type LocalProgress, localContinue } from "@/features/parda/library/local";
import {
	airedEpisodes,
	continueEntry,
	isFinished,
	isStarted,
	minutesLeft,
	nextUnwatched,
	type ProgressRow,
	type SeriesShape,
} from "@/features/parda/library/progress";
import { BLOCKER_STORES, blockerStore } from "@/features/parda/player/blocker";
import {
	fallsBack,
	firstSource,
	formatClock,
	isBehind,
	isNearEnd,
	isStuttering,
	nextSource,
	playOrder,
	startFor,
} from "@/features/parda/player/machine";
import { connectionBand } from "@/features/parda/player/playback";
import { fillTemplate, withStart } from "@/features/parda/player/templates";
import type { WatchSource } from "@/features/parda/player/watch-types";

/**
 * Task 64's pure rules (PLAN 12.5, decision 0236): Continue watching, the watch page's
 * choices, and the ad-blocker's store for each browser.
 */

const row = (over: Partial<ProgressRow>): ProgressRow => ({
	season: 1,
	episode: 1,
	watched: 0,
	duration: 1500,
	finished: false,
	updatedAt: 1,
	...over,
});

const SHAPE: SeriesShape = {
	seasons: [
		{ number: 0, episodes: 3 },
		{ number: 1, episodes: 3 },
		{ number: 2, episodes: 2 },
	],
	latest: { season: 2, episode: 2 },
};

describe("started and finished", () => {
	it("starts after a minute or 2%", () => {
		expect(isStarted(59, 7200)).toBe(false);
		expect(isStarted(60, 7200)).toBe(true);
		expect(isStarted(31, 1500)).toBe(true);
		expect(isStarted(20, null)).toBe(false);
	});

	it("finishes at 92%, or with 5 minutes left of a movie and 2 of an episode", () => {
		expect(isFinished("movie", 6624, 7200)).toBe(true);
		expect(isFinished("movie", 6900, 7200)).toBe(true);
		expect(isFinished("movie", 6000, 7200)).toBe(false);
		expect(isFinished("tv", 1380, 1500)).toBe(true);
		expect(isFinished("tv", 1300, 1500)).toBe(false);
		expect(isFinished("movie", 9999, null)).toBe(false);
	});

	it("rounds the time left up to whole minutes", () => {
		expect(minutesLeft(0, 1500)).toBe(25);
		expect(minutesLeft(1499, 1500)).toBe(1);
		expect(minutesLeft(10, null)).toBeNull();
	});
});

describe("continueEntry", () => {
	it("is nothing until something has started", () => {
		expect(continueEntry("movie", [])).toBeNull();
		expect(continueEntry("movie", [row({ season: null, episode: null, watched: 10, duration: 7200 })])).toBeNull();
	});

	it("resumes a movie part way through, and is complete once it's finished", () => {
		const resume = continueEntry("movie", [row({ season: null, episode: null, watched: 600, duration: 7200 })]);
		expect(resume).toEqual({ kind: "resume", season: null, episode: null, watched: 600, duration: 7200 });
		expect(continueEntry("movie", [row({ season: null, episode: null, finished: true })])).toEqual({
			kind: "complete",
		});
	});

	it("resumes the episode in progress, the latest touched", () => {
		const entry = continueEntry(
			"tv",
			[row({ episode: 1, finished: true, updatedAt: 1 }), row({ episode: 2, watched: 300, updatedAt: 2 })],
			SHAPE,
		);
		expect(entry).toMatchObject({ kind: "resume", season: 1, episode: 2 });
	});

	it("goes on to the next unwatched episode, across seasons, skipping finished and marked ones", () => {
		expect(continueEntry("tv", [row({ episode: 1, finished: true })], SHAPE)).toEqual({
			kind: "next",
			season: 1,
			episode: 2,
		});
		const rows = [row({ episode: 2, finished: true, updatedAt: 3 }), row({ episode: 3, finished: true, updatedAt: 1 })];
		expect(continueEntry("tv", rows, SHAPE)).toEqual({ kind: "next", season: 2, episode: 1 });
	});

	it("skips specials: after one, the first regular episode not yet watched", () => {
		expect(continueEntry("tv", [row({ season: 0, episode: 2, finished: true })], SHAPE)).toEqual({
			kind: "next",
			season: 1,
			episode: 1,
		});
		expect(nextUnwatched(SHAPE, new Set(), { season: 1, episode: 3 })).toEqual({ season: 2, episode: 1 });
	});

	it("waits in Schedule when the next one hasn't aired, and is complete at the end", () => {
		const shape = { ...SHAPE, latest: { season: 2, episode: 1 } };
		expect(continueEntry("tv", [row({ season: 2, episode: 1, finished: true })], shape)).toEqual({
			kind: "schedule",
			season: 2,
			episode: 2,
		});
		expect(continueEntry("tv", [row({ season: 2, episode: 2, finished: true })], SHAPE)).toEqual({
			kind: "complete",
		});
	});

	it("takes a season marked at once as ending on its last episode", () => {
		const rows = [1, 2, 3].map((episode) => row({ episode, finished: true, updatedAt: 5 }));
		expect(continueEntry("tv", rows, SHAPE)).toEqual({ kind: "next", season: 2, episode: 1 });
	});

	it("lists every aired episode of a series or a season", () => {
		expect(airedEpisodes(SHAPE)).toHaveLength(5);
		expect(airedEpisodes(SHAPE, 0)).toHaveLength(3);
		expect(airedEpisodes({ ...SHAPE, latest: { season: 1, episode: 2 } }, 1)).toEqual([
			{ season: 1, episode: 1 },
			{ season: 1, episode: 2 },
		]);
	});
});

describe("the browser's own Continue watching", () => {
	const entry = (over: Partial<LocalProgress>): LocalProgress => ({
		media: "tv",
		id: 1,
		season: 1,
		episode: 1,
		watched: 300,
		duration: 1500,
		updatedAt: 1,
		slug: "a",
		title: "A",
		backdrop: null,
		...over,
	});

	it("shows the latest entry per title: a resume, or the next episode once it's finished", () => {
		const items = localContinue([
			entry({ id: 1, updatedAt: 2 }),
			entry({ id: 1, episode: 2, updatedAt: 1 }),
			entry({ id: 2, watched: 1490, next: { season: 1, episode: 2 } }),
			entry({ id: 3, media: "movie", watched: 10, duration: 7200 }),
		]);
		expect(items.map((item) => [item.id, item.cta.kind])).toEqual([
			[1, "resume"],
			[2, "next"],
		]);
	});
});

const source = (id: string, over: Partial<WatchSource> = {}): WatchSource => ({
	id,
	name: { en: id, ne: id },
	url: `/parda/api/${id}/movie/1?start={start}`,
	origins: [],
	adapter: "parda",
	sandbox: "none",
	adaptive: false,
	needsClick: false,
	autoFallback: true,
	cdnGroup: null,
	deadlineMs: 15_000,
	quality: null,
	...over,
});

describe("the watch page's choices", () => {
	const sources = [
		source("1", { cdnGroup: "a" }),
		source("2", { cdnGroup: "a" }),
		source("3", { cdnGroup: "b", adaptive: true }),
	];
	const order = { ok: ["1", "2", "3"], slow: ["3", "1", "2"] };

	it("plays the order for the connection, the viewer's pick first", () => {
		expect(playOrder(sources, order, "ok").map((each) => each.id)).toEqual(["1", "2", "3"]);
		expect(playOrder(sources, order, "slow").map((each) => each.id)).toEqual(["3", "1", "2"]);
		expect(playOrder(sources, order, "unknown").map((each) => each.id)).toEqual(["1", "2", "3"]);
		expect(firstSource(sources, "2")?.id).toBe("2");
		expect(firstSource(sources, "gone")?.id).toBe("1");
	});

	it("falls back to another CDN group first, then to the rest", () => {
		const queue = playOrder(sources, order, "ok");
		expect(nextSource(queue, new Set(["1"]), { cdnGroup: "a" })?.id).toBe("3");
		expect(nextSource(queue, new Set(["1", "3"]), { cdnGroup: "b" })?.id).toBe("2");
		expect(nextSource(queue, new Set(["1", "2", "3"]), { cdnGroup: "a" })).toBeNull();
		// No group: a group of its own.
		expect(nextSource([source("x"), source("y")], new Set(["x"]), { cdnGroup: null })?.id).toBe("y");
	});

	it("never falls back from a source that reports nothing, or one the admin pinned to stay", () => {
		expect(fallsBack(source("1"))).toBe(true);
		expect(fallsBack(source("1", { adapter: "none" }))).toBe(false);
		expect(fallsBack(source("1", { autoFallback: false }))).toBe(false);
	});

	it("starts where the viewer was, 30 s earlier on another source", () => {
		expect(startFor(source("1"), null)).toBe(0);
		expect(startFor(source("1"), { position: 600, sourceId: "1" })).toBe(600);
		expect(startFor(source("2"), { position: 600, sourceId: "1" })).toBe(570);
		expect(startFor(source("2"), { position: 20, sourceId: null })).toBe(0);
		expect(withStart("/p?start={start}", 570.9)).toBe("/p?start=570");
		expect(fillTemplate("/p/{id}?start={start}", { id: 5, start: 1 }, { keep: ["start"] })).toBe("/p/5?start={start}");
	});

	it("says where the viewer was when a self-resuming player is a minute behind", () => {
		expect(isBehind(2050, 0)).toBe(true);
		expect(isBehind(50, 0)).toBe(false);
		expect(isBehind(null, 0)).toBe(false);
	});

	it("calls 2 stalls or 6 s stalled in the first 2 minutes stuttering", () => {
		expect(isStuttering({ stalled: false, count: 2, ms: 1000 }, 60)).toBe(true);
		expect(isStuttering({ stalled: true, count: 1, ms: 6000 }, 60)).toBe(true);
		expect(isStuttering({ stalled: false, count: 1, ms: 2000 }, 60)).toBe(false);
		expect(isStuttering({ stalled: false, count: 5, ms: 9000 }, 300)).toBe(false);
	});

	it("shows Up next in the last 30 s", () => {
		expect(isNearEnd(1470, 1500)).toBe(true);
		expect(isNearEnd(1400, 1500)).toBe(false);
		expect(isNearEnd(10, null)).toBe(false);
		expect(formatClock(2050)).toBe("34:10");
		expect(formatClock(3725)).toBe("1:02:05");
	});

	it("reads the connection band", () => {
		expect(connectionBand(undefined)).toBe("unknown");
		expect(connectionBand({ downlink: 10 })).toBe("ok");
		expect(connectionBand({ downlink: 4.5 })).toBe("slow");
		expect(connectionBand({ downlink: 10, saveData: true })).toBe("slow");
	});
});

describe("blockerStore", () => {
	const href = (browser: string) => BLOCKER_STORES.find((store) => store.browser === browser)?.href;
	const UA = {
		chrome:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		brave:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
		firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
		safari:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
		androidChrome:
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
		iphone:
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
		ipadFirefox:
			"Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
		inApp:
			"Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 Instagram 300.0",
		unknown: "curl/8.0",
	};

	it("picks each desktop browser's own store; Chromium browsers get Chrome's", () => {
		expect(blockerStore(UA.chrome)?.href).toBe(href("Chrome"));
		expect(blockerStore(UA.brave)?.href).toBe(href("Chrome"));
		expect(blockerStore(UA.edge)?.href).toBe(href("Edge"));
		expect(blockerStore(UA.firefox)?.href).toBe(href("Firefox"));
		expect(blockerStore(UA.safari)?.href).toBe(href("Safari"));
	});

	it("gives none where extensions aren't supported, or the browser is unknown", () => {
		for (const ua of [UA.androidChrome, UA.iphone, UA.ipadFirefox, UA.inApp, UA.unknown]) {
			expect(blockerStore(ua)).toBeNull();
		}
	});

	it("lists all four official stores", () => {
		expect(BLOCKER_STORES.map((store) => store.browser)).toEqual(["Chrome", "Edge", "Firefox", "Safari"]);
		expect(BLOCKER_STORES.every((store) => store.href.startsWith("https://"))).toBe(true);
	});
});
