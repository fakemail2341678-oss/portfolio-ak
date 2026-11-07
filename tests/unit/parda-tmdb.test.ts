import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { GENRE_LABELS } from "@/features/parda/genres";
import { tmdbImage } from "@/features/parda/kit/image";
import { isAppError } from "@/lib/errors";
import { PAGE_LAYOUTS, railContext } from "@/server/parda/catalog/rails";
import { createTmdbCache, TMDB_TTL, tmdbCacheKey } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fillIn, fillInList, mapDetails, mapList, nepaliName } from "@/server/parda/tmdb/mappers";
import { fixtureName } from "../../e2e/harness/tmdb";

const fixture = (name: string): unknown =>
	JSON.parse(readFileSync(new URL(`../fixtures/tmdb/${name}.json`, import.meta.url), "utf8"));
const firstId = (media: string) =>
	(fixture(`${media}_popular.en-US`) as { results: Array<{ id: number }> }).results[0]?.id;

const config = { token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test/t/p" };
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const clientWith = (...responses: Array<Response | Error>) => {
	const fetcher = vi.fn<typeof fetch>(async () => {
		const next = responses.shift();
		if (!next) throw new Error("no more responses");
		if (next instanceof Error) throw next;
		return next;
	});
	const sleep = vi.fn(async (_ms: number) => {});
	return { fetcher, sleep, tmdb: createTmdb(config, fetcher, sleep) };
};
const codeOf = async (promise: Promise<unknown>) => {
	const error = await promise.catch((caught: unknown) => caught);
	return isAppError(error) ? error.code : error;
};

describe("the TMDB client", () => {
	it("sends the bearer token, the parameters and include_adult=false", async () => {
		const { tmdb, fetcher } = clientWith(json({ ok: true }));
		expect(await tmdb.get("/movie/popular", { page: 2 })).toEqual({ ok: true });
		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://tmdb.test/3/movie/popular?page=2&include_adult=false");
		expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${config.token}`);
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("retries a 5xx once, then gives up as unavailable", async () => {
		const recovered = clientWith(new Response("", { status: 502 }), json({ ok: true }));
		expect(await recovered.tmdb.get("x")).toEqual({ ok: true });
		const down = clientWith(new Response("", { status: 502 }), new Response("", { status: 503 }));
		expect(await codeOf(down.tmdb.get("x"))).toBe("UPSTREAM_UNAVAILABLE");
		expect(down.fetcher).toHaveBeenCalledTimes(2);
	});

	it("waits Retry-After once on a 429, capped, and gives up on the second", async () => {
		const { tmdb, sleep } = clientWith(
			new Response("", { status: 429, headers: { "retry-after": "2" } }),
			json({ ok: 1 }),
		);
		expect(await tmdb.get("x")).toEqual({ ok: 1 });
		expect(sleep).toHaveBeenCalledWith(2000);
		const capped = clientWith(new Response("", { status: 429, headers: { "retry-after": "900" } }), json({}));
		await capped.tmdb.get("x");
		expect(capped.sleep).toHaveBeenCalledWith(10_000);
		const twice = clientWith(new Response("", { status: 429 }), new Response("", { status: 429 }));
		expect(await codeOf(twice.tmdb.get("x"))).toBe("UPSTREAM_UNAVAILABLE");
	});

	it("maps a 404 to NOT_FOUND, and a timeout or network failure to unavailable without a retry", async () => {
		expect(await codeOf(clientWith(new Response("", { status: 404 })).tmdb.get("x"))).toBe("NOT_FOUND");
		const timedOut = clientWith(new DOMException("timed out", "TimeoutError"));
		expect(await codeOf(timedOut.tmdb.get("x"))).toBe("UPSTREAM_UNAVAILABLE");
		expect(timedOut.fetcher).toHaveBeenCalledTimes(1);
	});
});

describe("the TMDB cache", () => {
	const key = { path: "movie/popular", locale: "en", region: "US", cap: null, epoch: 0 };
	const setup = (max?: number) => {
		let time = 0;
		const cache = createTmdbCache({ now: () => time, ...(max ? { max } : {}) });
		return { cache, advance: (ms: number) => (time += ms) };
	};

	it("serves from the cache within the TTL", async () => {
		const { cache, advance } = setup();
		const load = vi.fn(async () => "value");
		await cache.read(key, "list", load);
		advance(TMDB_TTL.list - 1);
		expect(await cache.read(key, "list", load)).toBe("value");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("serves stale while refreshing, then loads afresh once too old", async () => {
		const { cache, advance } = setup();
		const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce("old").mockResolvedValue("new");
		await cache.read(key, "list", load);
		advance(TMDB_TTL.list);
		expect(await cache.read(key, "list", load)).toBe("old");
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		await new Promise((resolve) => setTimeout(resolve));
		expect(await cache.read(key, "list", load)).toBe("new");
		advance(TMDB_TTL.list * 2);
		await cache.read(key, "list", load);
		expect(load).toHaveBeenCalledTimes(3);
	});

	it("keeps a stale value when the background refresh fails", async () => {
		const { cache, advance } = setup();
		await cache.read(key, "list", async () => "old");
		advance(TMDB_TTL.list);
		expect(await cache.read(key, "list", () => Promise.reject(new Error("down")))).toBe("old");
		await new Promise((resolve) => setTimeout(resolve));
		expect(await cache.read(key, "list", async () => "unused")).toBe("old");
	});

	it("coalesces concurrent reads into one call", async () => {
		const { cache } = setup();
		const load = vi.fn(async () => "value");
		await Promise.all([cache.read(key, "list", load), cache.read(key, "list", load)]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("doesn't keep a failed load", async () => {
		const { cache } = setup();
		await expect(cache.read(key, "list", () => Promise.reject(new Error("down")))).rejects.toThrow("down");
		expect(await cache.read(key, "list", async () => "value")).toBe("value");
	});

	it("drops the least recently used entry", async () => {
		const { cache } = setup(2);
		const at = (path: string) => ({ ...key, path });
		await cache.read(at("a"), "list", async () => 1);
		await cache.read(at("b"), "list", async () => 2);
		await cache.read(at("a"), "list", async () => 1);
		await cache.read(at("c"), "list", async () => 3);
		expect(cache.size()).toBe(2);
		const reloadA = vi.fn(async () => 1);
		const reloadB = vi.fn(async () => 2);
		await cache.read(at("a"), "list", reloadA);
		await cache.read(at("b"), "list", reloadB);
		expect(reloadA).not.toHaveBeenCalled();
		expect(reloadB).toHaveBeenCalled();
	});

	it("keys on everything an answer depends on, whatever the parameters' order", () => {
		expect(tmdbCacheKey({ ...key, epoch: 1 })).not.toBe(tmdbCacheKey(key));
		expect(tmdbCacheKey({ ...key, locale: "ne" })).not.toBe(tmdbCacheKey(key));
		expect(tmdbCacheKey({ ...key, region: "IN" })).not.toBe(tmdbCacheKey(key));
		expect(tmdbCacheKey({ ...key, cap: "PG" })).not.toBe(tmdbCacheKey(key));
		expect(tmdbCacheKey({ ...key, params: { a: 1, b: 2 } })).toBe(tmdbCacheKey({ ...key, params: { b: 2, a: 1 } }));
	});
});

describe("the mappers", () => {
	it("maps both media types' lists", () => {
		const movies = mapList("movie", fixture("movie_popular.en-US"));
		expect(movies.results[0]).toMatchObject({ media: "movie", title: expect.any(String), genres: expect.any(Array) });
		const shows = mapList("tv", fixture("tv_popular.en-US"));
		expect(shows.results[0]).toMatchObject({ media: "tv", title: expect.any(String) });
	});

	it("keeps only what pages use", () => {
		const [item] = mapList("movie", fixture("movie_popular.en-US")).results;
		expect(Object.keys(item ?? {}).sort()).toEqual(
			["backdrop", "genres", "id", "media", "overview", "poster", "rating", "slug", "title", "year"].sort(),
		);
	});

	it("maps details with a certification by region", () => {
		const details = mapDetails("movie", fixture(`movie_${firstId("movie")}.en-US`), "US");
		expect(details.id).toBe(firstId("movie"));
		expect(details.genres.length).toBeGreaterThan(0);
		const series = mapDetails("tv", fixture(`tv_${firstId("tv")}.en-US`), "US");
		expect(series.seasons).toBeGreaterThan(0);
		expect(mapDetails("movie", { id: 1, title: "x" }, "US")).toMatchObject({ certification: null, year: null });
		expect(
			mapDetails("tv", { id: 1, content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-14" }] } }, "US")
				.certification,
		).toBe("TV-14");
		expect(
			mapDetails(
				"movie",
				{
					id: 1,
					release_dates: {
						results: [{ iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "R" }] }],
					},
				},
				"US",
			).certification,
		).toBe("R");
	});

	it("keeps movies and series from a mixed list, and nothing adult", () => {
		const item = { overview: "", poster_path: null, backdrop_path: null };
		const list = mapList("mixed", {
			page: 1,
			total_pages: 1,
			results: [
				{ ...item, id: 1, title: "A film", media_type: "movie" },
				{ ...item, id: 1, name: "A series", media_type: "tv" },
				{ ...item, id: 2, name: "A person", media_type: "person" },
				{ ...item, id: 3, title: "Adult", media_type: "movie", adult: true },
				{ ...item, id: 4, title: "Softcore", media_type: "movie", softcore: true },
			],
		});
		expect(list.results.map((row) => [row.media, row.id, row.title])).toEqual([
			["movie", 1, "A film"],
			["tv", 1, "A series"],
		]);
		const nepali = { ...list, results: list.results.map((row) => ({ ...row, title: "" })) };
		expect(fillInList(nepali, list).results.map((row) => row.title)).toEqual(["A film", "A series"]);
	});

	it("refuses an unexpected shape as unavailable", () => {
		expect(() => mapList("movie", { results: "nope" })).toThrowError(/unexpected list/);
	});

	it("fills blank Nepali text from English", () => {
		const nepali = mapList("movie", fixture("movie_popular.ne-NP"));
		const english = mapList("movie", fixture("movie_popular.en-US"));
		for (const item of fillInList(nepali, english).results) {
			expect(item.title).not.toBe("");
			const source = english.results.find((row) => row.id === item.id);
			if (source?.overview) expect(item.overview).toBe(source.overview);
		}
		const base = {
			media: "movie" as const,
			id: 1,
			slug: "title",
			year: null,
			poster: null,
			backdrop: null,
			genres: [],
			rating: 0,
		};
		expect(
			fillIn({ ...base, title: "शीर्षक", overview: "  " }, { ...base, title: "Title", overview: "Text" }),
		).toMatchObject({
			title: "शीर्षक",
			overview: "Text",
		});
		// Without a Nepali translation TMDB answers in the original language: English is better then (0244).
		expect(
			fillIn({ ...base, title: "モブサイコ100", overview: "" }, { ...base, title: "Mob Psycho 100", overview: "" })
				.title,
		).toBe("Mob Psycho 100");
		expect(
			fillIn(
				{ ...base, title: "Socias por accidente", overview: "" },
				{ ...base, title: "Accidental Partners", overview: "" },
			).title,
		).toBe("Accidental Partners");
		expect(nepaliName("  ", "Title")).toBe("Title");
		expect(nepaliName("기생충", "")).toBe("기생충");
	});

	it("builds images with fixed aspects and no image without a path", () => {
		expect(tmdbImage("https://img.test/t/p/", "/a.jpg", "poster")).toEqual({
			src: "https://img.test/t/p/w342/a.jpg",
			srcSet:
				"https://img.test/t/p/w154/a.jpg 154w, https://img.test/t/p/w342/a.jpg 342w, https://img.test/t/p/w500/a.jpg 500w, https://img.test/t/p/w780/a.jpg 780w",
			width: 2,
			height: 3,
		});
		expect(tmdbImage("https://img.test/t/p", "/a.jpg", "backdrop")).toMatchObject({ width: 16, height: 9 });
		expect(tmdbImage("https://img.test/t/p", null, "poster")).toBeNull();
	});

	it("names all of TMDB's 27 genres", () => {
		expect(Object.keys(GENRE_LABELS)).toHaveLength(27);
		for (const label of Object.values(GENRE_LABELS)) expect(label()).not.toBe("");
	});
});

describe("the rails", () => {
	it("give anime its Tokyo date and season", () => {
		// 23:30 in Kathmandu on 31 March is already 1 April in Tokyo: spring's first day.
		expect(railContext("US", new Date("2026-03-31T17:45:00Z"))).toEqual({
			today: "2026-04-01",
			seasonStart: "2026-04-01",
			seasonEnd: "2026-06-30",
			region: "US",
		});
		expect(railContext("IN", new Date("2026-11-04T00:00:00Z"))).toMatchObject({
			seasonStart: "2026-10-01",
			seasonEnd: "2026-12-31",
		});
		expect(railContext("US", new Date("2028-02-10T00:00:00Z")).seasonEnd).toBe("2028-03-31");
	});

	it("are unique within each page, with the billboard's among them", () => {
		for (const layout of Object.values(PAGE_LAYOUTS)) {
			const ids = layout.rails.map((rail) => rail.id);
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids).toContain(layout.billboardFrom);
			for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
		}
	});

	it("name a recording by what picks the answer, without dates", () => {
		expect(
			fixtureName(
				"discover/tv",
				[
					["with_genres", "16"],
					["air_date.gte", "2026-11-04"],
					["page", "1"],
					["language", "ne-NP"],
				],
				"ne-NP",
			),
		).toBe("discover_tv+air_date.gte+with_genres=16.ne-NP.json");
		expect(fixtureName("movie/550", [["append_to_response", "credits"]], "en-US")).toBe("movie_550.en-US.json");
	});
});
