import { describe, expect, it } from "vitest";
import { DISCOVER_DEFAULTS, discoverSearchSchema } from "@/features/parda/search";
import {
	applicableFilters,
	discoverFilters,
	discoverOfRail,
	discoverRequest,
} from "@/server/parda/catalog/discover-requests";

/** Discover's URL contract and its TMDB requests (Task 66, decision 0239). */
const TODAY = "2026-11-05";
const request = (raw: Record<string, unknown>) => discoverRequest(discoverSearchSchema.parse(raw), TODAY);

describe("discover's URL contract", () => {
	it("defaults to popular movies, page 1, and survives a hand-edited address", () => {
		expect(discoverSearchSchema.parse({})).toEqual({ ...DISCOVER_DEFAULTS });
		expect(
			discoverSearchSchema.parse({ type: "film", genres: "x", rating: "11", page: "501", language: "eng", sort: "?" }),
		).toEqual({ ...DISCOVER_DEFAULTS });
	});

	it("reads repeated genres as a list of at most five, and blank fields as unset", () => {
		expect(discoverSearchSchema.parse({ genres: ["28", "12"] }).genres).toEqual([28, 12]);
		expect(discoverSearchSchema.parse({ genres: "35" }).genres).toEqual([35]);
		expect(discoverSearchSchema.parse({ genres: ["1", "2", "3", "4", "5", "6"] }).genres).toEqual([]);
		expect(discoverSearchSchema.parse({ from: "", rating: "", runtime: "" })).toEqual({ ...DISCOVER_DEFAULTS });
	});
});

describe("discover's request", () => {
	it("asks TMDB for popular movies by default", () => {
		expect(request({})).toEqual({
			media: "movie",
			path: "discover/movie",
			params: { page: 1, sort_by: "popularity.desc" },
		});
	});

	it("maps every filter to TMDB's parameters for movies", () => {
		expect(
			request({
				genres: ["28", "12"],
				from: "1990",
				to: "1999",
				rating: "7",
				runtime: "long",
				language: "en",
				company: "420",
			}).params,
		).toEqual({
			page: 1,
			sort_by: "popularity.desc",
			with_genres: "28,12",
			"primary_release_date.gte": "1990-01-01",
			"primary_release_date.lte": "1999-12-31",
			"vote_average.gte": 7,
			"vote_count.gte": 50,
			"with_runtime.gte": 151,
			with_original_language: "en",
			with_companies: 420,
		});
	});

	it("maps a series' status, network and episode runtime", () => {
		expect(request({ type: "series", status: "ended", company: "213", runtime: "short" })).toEqual({
			media: "tv",
			path: "discover/tv",
			params: { page: 1, sort_by: "popularity.desc", with_status: 3, with_networks: 213, "with_runtime.lte": 30 },
		});
	});

	it("keeps sorts by score and date to titles people have seen, and newest to what's out", () => {
		expect(request({ sort: "rating" }).params).toMatchObject({ sort_by: "vote_average.desc", "vote_count.gte": 200 });
		expect(request({ sort: "newest" }).params).toMatchObject({
			sort_by: "primary_release_date.desc",
			"primary_release_date.lte": TODAY,
			"vote_count.gte": 10,
		});
		expect(request({ type: "series", sort: "title" }).params).toMatchObject({ sort_by: "name.asc" });
	});

	it("drops what doesn't apply to the type, and swaps years the wrong way round", () => {
		const filters = applicableFilters(
			discoverSearchSchema.parse({
				genres: ["10765", "28"],
				status: "ended",
				company: "213",
				from: "2020",
				to: "2010",
			}),
		);
		expect(filters).toMatchObject({ genres: [28], status: undefined, company: undefined, from: 2010, to: 2020 });
	});
});

describe("a rail's Discover", () => {
	it("follows genre, language and keyword rails, and nothing with dates or other lists", () => {
		expect(
			discoverOfRail({
				media: "movie",
				path: "discover/movie",
				params: { sort_by: "popularity.desc", "vote_count.gte": 100, with_genres: 28 },
			}),
		).toEqual({ type: "movie", genres: [28] });
		expect(
			discoverOfRail({
				media: "tv",
				path: "discover/tv",
				params: { sort_by: "vote_average.desc", with_genres: 16, with_original_language: "ja", with_keywords: 9914 },
			}),
		).toEqual({ type: "series", sort: "rating", genres: [16], language: "ja", keyword: 9914 });
		expect(
			discoverOfRail({ media: "tv", path: "discover/tv", params: { "air_date.gte": TODAY, with_genres: 16 } }),
		).toBeNull();
		expect(discoverOfRail({ media: "mixed", path: "trending/all/week", params: {} })).toBeNull();
	});

	it("round-trips: a rail's filters ask TMDB for the same list", () => {
		const rail = {
			media: "tv" as const,
			path: "discover/tv",
			params: { sort_by: "popularity.desc", with_genres: 16, with_original_language: "ja" },
		};
		const more = discoverOfRail(rail);
		expect(more && discoverRequest(discoverFilters(more), TODAY).params).toEqual({
			page: 1,
			...rail.params,
			with_genres: "16",
		});
	});
});
