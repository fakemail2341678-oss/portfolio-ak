import { describe, expect, it } from "vitest";
import { ADAPTERS, acceptMessage } from "@/features/parda/player/adapters";
import { createStallDetector, SEEK_GRACE_MS, STALL_AFTER_MS } from "@/features/parda/player/stall";
import { fillTemplate, sourceProblems } from "@/features/parda/player/templates";
import { buildCsp } from "@/lib/http/csp";
import { parsePlaceholderUrl, placeholderCsp, renderPlaceholder } from "@/server/parda/player/placeholder";
import { embedOrigins, playerUrl, TRAILER_ORIGIN } from "@/server/parda/player/sources";

const MOVIE = "/1/movie/{id}?start={start}&lang={lang}";
const TV = "/1/tv/{id}/{season}/{episode}?start={start}&lang={lang}";

describe("source templates", () => {
	it("fills tokens, encoded, and refuses a missing value", () => {
		expect(fillTemplate("/a/{id}?l={lang}", { id: 5, lang: "n e" })).toBe("/a/5?l=n%20e");
		expect(fillTemplate("/a/{imdb}", { id: 5 })).toBeNull();
	});

	it("accepts a path, or https on a listed origin", () => {
		expect(sourceProblems({ movieTemplate: MOVIE, tvTemplate: TV, origins: [] })).toEqual([]);
		const absolute = "https://player.example.com/m/{id}";
		expect(
			sourceProblems({ movieTemplate: absolute, tvTemplate: absolute, origins: ["https://player.example.com"] }),
		).toEqual([]);
	});

	it("refuses http, an unlisted host, an unknown token and a bad origin", () => {
		const check = (template: string, origins: string[] = []) =>
			sourceProblems({ movieTemplate: template, tvTemplate: MOVIE, origins });
		expect(check("http://player.example.com/{id}", ["https://player.example.com"])).toContain("not-https");
		expect(check("//player.example.com/{id}")).toContain("not-https");
		expect(check("https://player.example.com/{id}")).toContain("origin-not-listed");
		expect(check("/a/{secret}")).toContain("unknown-token");
		expect(check(MOVIE, ["http://player.example.com"])).toContain("invalid-origin");
		expect(check(MOVIE, ["https://player.example.com/path"])).toContain("invalid-origin");
	});
});

describe("playerUrl", () => {
	const source = { movieTemplate: MOVIE, tvTemplate: TV };

	it("picks the media's template, and a resume is optional", () => {
		expect(playerUrl(source, { media: "movie", id: 7 }, { lang: "en" })).toBe("/parda/api/1/movie/7?start=0&lang=en");
		expect(playerUrl(source, { media: "tv", id: 7, season: 2, episode: 3 }, { lang: "ne", start: 90.7 })).toBe(
			"/parda/api/1/tv/7/2/3?start=90&lang=ne",
		);
	});

	it("puts a path on the base, and leaves an absolute template alone", () => {
		const base = "https://player.example.com/parda/api/";
		expect(playerUrl(source, { media: "movie", id: 7 }, { lang: "en", base })).toBe(
			"https://player.example.com/parda/api/1/movie/7?start=0&lang=en",
		);
		const absolute = { movieTemplate: "https://other.example.com/{id}", tvTemplate: TV };
		expect(playerUrl(absolute, { media: "movie", id: 7 }, { lang: "en", base })).toBe("https://other.example.com/7");
	});

	it("is null when the source needs a value the title lacks", () => {
		const byImdb = { movieTemplate: "/m/{imdb}", tvTemplate: TV };
		expect(playerUrl(byImdb, { media: "movie", id: 7 }, { lang: "en" })).toBeNull();
		expect(playerUrl(byImdb, { media: "movie", id: 7, imdb: "tt1" }, { lang: "en" })).toBe("/parda/api/m/tt1");
	});
});

describe("the CSP's embed origins", () => {
	const row = (enabled: boolean, origins: string[], template = "https://player.example.com/{id}") => ({
		enabled,
		origins,
		movieTemplate: template,
		tvTemplate: template,
	});

	it("lists enabled rows and trailers; the lab also lists disabled rows", () => {
		const rows = [row(true, ["https://a.example.com"]), row(false, ["https://b.example.com"])];
		expect(embedOrigins(rows, { includeDisabled: false })).toEqual([TRAILER_ORIGIN, "https://a.example.com"]);
		expect(embedOrigins(rows, { includeDisabled: true })).toContain("https://b.example.com");
	});

	it("frames this app, or the base, for a relative template", () => {
		const rows = [row(true, [], MOVIE)];
		expect(embedOrigins(rows, { includeDisabled: false })).toContain("'self'");
		expect(embedOrigins(rows, { includeDisabled: false, base: "https://player.example.com" })).toEqual([
			TRAILER_ORIGIN,
			"https://player.example.com",
		]);
	});

	it("reaches frame-src only: never script-src or connect-src", () => {
		const csp = buildCsp({ nonce: "n", embedOrigins: ["https://a.example.com"] });
		const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `));
		expect(directive("frame-src")).toContain("https://a.example.com");
		expect(directive("script-src")).not.toContain("https://a.example.com");
		expect(directive("connect-src")).not.toContain("https://a.example.com");
		expect(buildCsp({ nonce: "n" })).not.toContain("frame-src");
	});
});

describe("adapters", () => {
	const message = (name: string, extra: object = {}) => ({ type: "parda.player", event: { name, ...extra } });
	const { parda, none } = ADAPTERS;

	it("turns each parda message into its event", () => {
		expect(parda.parse(message("ready", { duration: 100 }), null)).toEqual({ kind: "ready", duration: 100 });
		expect(parda.parse(message("position", { position: 5, duration: 100 }), null)).toEqual({
			kind: "position",
			position: 5,
			duration: 100,
		});
		expect(parda.parse(message("play"), null)).toEqual({ kind: "play" });
		expect(parda.parse(message("pause"), null)).toEqual({ kind: "pause" });
		expect(parda.parse(message("seeked", { position: 9 }), null)).toEqual({ kind: "seeked", position: 9 });
		expect(parda.parse(message("ended"), null)).toEqual({ kind: "ended" });
		expect(parda.parse(message("failed", { reason: "x" }), null)).toEqual({ kind: "failed", reason: "x" });
	});

	it("ignores foreign and malformed messages", () => {
		expect(parda.parse("__yminfo", null)).toBeNull();
		expect(parda.parse(null, null)).toBeNull();
		expect(parda.parse({ type: "other" }, null)).toBeNull();
		expect(parda.parse(message("explode"), null)).toBeNull();
		expect(parda.parse(message("position", { position: -1 }), null)).toBeNull();
	});

	it("builds parda's commands; none reports and obeys nothing", () => {
		expect(parda.command?.({ action: "seek", position: 4 })).toEqual({
			type: "parda.command",
			action: "seek",
			position: 4,
		});
		expect(none.command).toBeNull();
		expect(none.parse(message("play"), null)).toBeNull();
	});

	it("accepts only the source's own frame and origin", () => {
		const frame = {} as MessageEventSource;
		const player = { adapter: parda, origins: ["https://p.example.com"], frame, target: null };
		const data = message("play");
		expect(acceptMessage({ origin: "https://p.example.com", source: frame, data }, player)).toEqual({ kind: "play" });
		expect(acceptMessage({ origin: "https://evil.example.com", source: frame, data }, player)).toBeNull();
		expect(
			acceptMessage({ origin: "https://p.example.com", source: {} as MessageEventSource, data }, player),
		).toBeNull();
		expect(
			acceptMessage({ origin: "https://p.example.com", source: null, data }, { ...player, frame: null }),
		).toBeNull();
	});
});

describe("the viduki adapter (decision 0248)", () => {
	const { viduki } = ADAPTERS;
	const movie = { media: "movie", id: 597 } as const;
	const episode = { media: "tv", id: 1399, season: 1, episode: 2 } as const;
	const movieData = {
		type: "MEDIA_DATA",
		data: {
			"597": { id: "597", type: "movie", title: "Titanic", progress: { watched: 3706.9, duration: 11689.7 } },
			"603": { id: "603", type: "movie", progress: { watched: 10, duration: 8000 } },
		},
	};
	const tvData = {
		type: "MEDIA_DATA",
		data: {
			"1399": {
				id: "1399",
				type: "tv",
				last_season_watched: "1",
				last_episode_watched: "2",
				show_progress: {
					s1e1: { season: "1", episode: "1", progress: { watched: 3000, duration: 3696.1 } },
					s1e2: { season: "1", episode: "2", progress: { watched: 0.58, duration: 3600 } },
				},
			},
		},
	};

	it("reads this title's progress from MEDIA_DATA, among every title it remembers", () => {
		expect(viduki.parse(movieData, movie)).toEqual({ kind: "position", position: 3706.9, duration: 11689.7 });
		expect(viduki.parse(tvData, episode)).toEqual({ kind: "position", position: 0.58, duration: 3600 });
	});

	it("ignores progress for another title or episode, without a target, or with bad numbers", () => {
		expect(viduki.parse(movieData, { media: "movie", id: 1 })).toBeNull();
		expect(viduki.parse(movieData, { media: "tv", id: 597, season: 1, episode: 1 })).toBeNull();
		expect(viduki.parse(tvData, { ...episode, episode: 9 })).toBeNull();
		expect(viduki.parse(movieData, null)).toBeNull();
		const bad = (watched: unknown) => ({
			type: "MEDIA_DATA",
			data: { "597": { type: "movie", progress: { watched, duration: 10 } } },
		});
		for (const watched of [-1, "5", Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(viduki.parse(bad(watched), movie)).toBeNull();
		}
	});

	it("turns all-servers-failed into a failure with its stage and status", () => {
		const failure = {
			type: "viduki:all-servers-failed",
			source: "viduki-api-1",
			stage: "initial",
			status: 404,
			message: "content not found 404",
			media: { type: "tv", tmdbid: "1399", season: "1", episode: "1" },
		};
		expect(viduki.parse(failure, episode)).toEqual({ kind: "failed", reason: "initial:404" });
		expect(viduki.parse({ type: "viduki:all-servers-failed", stage: "playback-error" }, null)).toEqual({
			kind: "failed",
			reason: "playback-error",
		});
	});

	it("obeys no command, resumes from its own memory, and isn't read for stalls", () => {
		expect(viduki.command).toBeNull();
		expect(viduki.startPosition).toBe("self");
		expect(viduki.infersStalls).toBe(false);
		expect(viduki.parse({ type: "parda.player", event: { name: "play" } }, movie)).toBeNull();
		expect(viduki.parse("MEDIA_DATA", movie)).toBeNull();
	});
});

describe("stall detection", () => {
	const position = (value: number) => ({ kind: "position", position: value, duration: 100 }) as const;

	it("counts a stall when the position stops while playing, and ends it when it moves", () => {
		const detector = createStallDetector();
		detector.observe({ kind: "play" }, 0);
		detector.observe(position(1), 100);
		detector.tick(100 + STALL_AFTER_MS - 1);
		expect(detector.summary(100 + STALL_AFTER_MS - 1).stalled).toBe(false);
		detector.tick(100 + STALL_AFTER_MS);
		expect(detector.summary(100 + STALL_AFTER_MS)).toEqual({ stalled: true, count: 1, ms: 0 });
		detector.observe(position(2), 100 + STALL_AFTER_MS + 500);
		expect(detector.summary(100 + STALL_AFTER_MS + 500)).toEqual({ stalled: false, count: 1, ms: 500 });
	});

	it("a repeated position doesn't count as moving", () => {
		const detector = createStallDetector();
		detector.observe(position(1), 0);
		detector.observe(position(1), STALL_AFTER_MS);
		detector.tick(STALL_AFTER_MS);
		expect(detector.summary(STALL_AFTER_MS).count).toBe(1);
	});

	it("a pause isn't a stall", () => {
		const detector = createStallDetector();
		detector.observe({ kind: "play" }, 0);
		detector.observe({ kind: "pause" }, 100);
		detector.tick(10_000);
		expect(detector.summary(10_000).count).toBe(0);
	});

	it("ignores the time after a seek or a command", () => {
		const detector = createStallDetector();
		detector.observe({ kind: "play" }, 0);
		detector.observe({ kind: "seeked", position: 50 }, 100);
		detector.tick(100 + SEEK_GRACE_MS);
		expect(detector.summary(100 + SEEK_GRACE_MS).stalled).toBe(false);
		detector.tick(100 + SEEK_GRACE_MS + STALL_AFTER_MS);
		expect(detector.summary(100 + SEEK_GRACE_MS + STALL_AFTER_MS).count).toBe(1);
	});
});

describe("the placeholder player", () => {
	const parse = (path: string) => parsePlaceholderUrl(new URL(path, "http://localhost"));

	it("serves the owner's four routes", () => {
		for (const server of [1, 2, 3, 4]) {
			expect(parse(`/parda/api/${server}/movie/550`)).toMatchObject({ server, media: "movie", id: 550 });
			expect(parse(`/parda/api/${server}/tv/1396/1/2`)).toMatchObject({
				server,
				media: "tv",
				id: 1396,
				season: 1,
				episode: 2,
			});
		}
	});

	it("is a 404 for anything else", () => {
		for (const path of [
			"/parda/api/5/movie/550",
			"/parda/api/1/movie/abc",
			"/parda/api/1/tv/1396",
			"/parda/api/1/movie/550/extra",
			"/parda/api/1/book/1",
		]) {
			expect(parse(path)).toBeNull();
		}
	});

	it("speaks Viduki unless asked for the parda protocol", () => {
		expect(parse("/parda/api/1/movie/1?color=f6d743")).toMatchObject({ protocol: "viduki" });
		expect(parse("/parda/api/1/movie/1?protocol=parda")).toMatchObject({ protocol: "parda" });
		expect(parse("/parda/api/1/movie/1?protocol=other")).toMatchObject({ protocol: "viduki" });
	});

	it("takes only known values from the query", () => {
		expect(parse("/parda/api/1/movie/1?start=90&cue=stall&lang=ne")).toMatchObject({
			start: 90,
			cue: "stall",
			lang: "ne",
		});
		expect(parse("/parda/api/1/movie/1?start=-4&cue=<script>&lang=xx")).toMatchObject({
			start: 0,
			cue: null,
			lang: "en",
		});
	});

	it("renders a whole document whose scripts carry the nonce", () => {
		const request = parse("/parda/api/2/tv/9/1/3?lang=ne");
		if (!request) throw new Error("no request");
		const html = renderPlaceholder(request, "abc");
		expect(html).toContain('<html lang="ne">');
		expect(html).toContain("<h1>");
		expect(html.match(/<script /g)).toHaveLength(2);
		expect(html.match(/<script nonce="abc">|<script id="config" type="application\/json" nonce="abc">/g)).toHaveLength(
			2,
		);
		expect(placeholderCsp("abc")).toContain("frame-ancestors 'self'");
		expect(placeholderCsp("abc")).toContain("default-src 'none'");
	});
});
