import { describe, expect, it } from "vitest";
import { allowedRatings, isKidsCap, withinCap } from "@/features/parda/kids";
import { isTmdbRegion, TMDB_REGIONS } from "@/features/parda/profiles/options";
import { cappedRequest } from "@/server/parda/catalog/kids-requests";
import { PAGE_LAYOUTS, railContext } from "@/server/parda/catalog/rails";
import { playerLanguage } from "@/server/parda/player/sources";

/** The kids' cap's pure parts (decision 0240): the ladder, the capped requests, regions, the players' language. */
describe("the kids' ladder", () => {
	it("allows a movie certificate and every milder one, never NR", () => {
		expect(allowedRatings("G", "movie")).toEqual(["G"]);
		expect(allowedRatings("PG", "movie")).toEqual(["G", "PG"]);
		expect(allowedRatings("PG-13", "movie")).toEqual(["G", "PG", "PG-13"]);
		expect(allowedRatings("R", "movie")).toEqual(["G", "PG", "PG-13", "R"]);
		for (const cap of ["G", "PG", "PG-13", "R"]) expect(allowedRatings(cap, "movie")).not.toContain("NR");
	});

	it("names each cap's TV counterparts", () => {
		expect(allowedRatings("G", "tv")).toEqual(["TV-Y", "TV-Y7", "TV-G"]);
		expect(allowedRatings("PG", "tv")).toContain("TV-PG");
		expect(allowedRatings("PG", "tv")).not.toContain("TV-14");
		expect(allowedRatings("PG-13", "tv")).toContain("TV-14");
		expect(allowedRatings("R", "tv")).toContain("TV-MA");
	});

	it("fails closed: no certificate, an unknown one or an unknown cap", () => {
		expect(withinCap("PG", "movie", "PG")).toBe(true);
		expect(withinCap("PG", "movie", "PG-13")).toBe(false);
		expect(withinCap("PG", "movie", null)).toBe(false);
		expect(withinCap("PG", "movie", "NR")).toBe(false);
		expect(withinCap("PG", "tv", "TV-PG")).toBe(true);
		expect(withinCap("PG", "tv", "PG")).toBe(false);
		expect(isKidsCap("NC-17")).toBe(false);
		expect(allowedRatings("NC-17", "movie")).toEqual(["G"]);
	});
});

describe("capped requests", () => {
	const PG = "PG";
	it("adds the exact certificates to a discover query", () => {
		expect(cappedRequest({ media: "movie", path: "discover/movie", params: { with_genres: 28, page: 2 } }, PG)).toEqual(
			{
				media: "movie",
				path: "discover/movie",
				params: { with_genres: 28, page: 2, certification_country: "US", certification: "G|PG" },
			},
		);
		expect(cappedRequest({ media: "tv", path: "discover/tv", params: {} }, PG)?.params).toMatchObject({
			certification: "TV-Y|TV-Y7|TV-G|TV-PG",
		});
	});

	it("asks popular, trending and top rated lists of one type as discover queries", () => {
		expect(cappedRequest({ media: "movie", path: "movie/popular", params: { page: 3 } }, PG)).toEqual({
			media: "movie",
			path: "discover/movie",
			params: {
				sort_by: "popularity.desc",
				"vote_count.gte": 50,
				certification_country: "US",
				certification: "G|PG",
				page: 3,
			},
		});
		expect(cappedRequest({ media: "tv", path: "trending/tv/week", params: {} }, PG)?.path).toBe("discover/tv");
		expect(cappedRequest({ media: "tv", path: "tv/top_rated", params: {} }, PG)?.params).toMatchObject({
			sort_by: "vote_average.desc",
			"vote_count.gte": 200,
		});
	});

	it("leaves lists TMDB can't filter to the catalogue's own filter", () => {
		expect(cappedRequest({ media: "mixed", path: "trending/all/day", params: {} }, PG)).toBeNull();
		expect(cappedRequest({ media: "movie", path: "movie/upcoming", params: { region: "US" } }, PG)).toBeNull();
		expect(cappedRequest({ media: "tv", path: "tv/on_the_air", params: {} }, PG)).toBeNull();
	});

	it("caps every rail of the home that TMDB can filter", () => {
		const context = railContext("US", new Date("2026-11-05T00:00:00Z"));
		const capped = PAGE_LAYOUTS.home.rails.map((spec) => cappedRequest(spec.request(context), PG));
		for (const request of capped) {
			if (request) expect(request.params.certification_country).toBe("US");
		}
		// Top 10, trending (both media types) and upcoming are filtered by `pd_title` instead.
		expect(capped.filter((request) => request === null)).toHaveLength(3);
	});
});

describe("profile options", () => {
	it("knows TMDB's regions, without Nepal", () => {
		expect(TMDB_REGIONS).toHaveLength(139);
		expect(isTmdbRegion("IN")).toBe(true);
		expect(isTmdbRegion("NP")).toBe(false);
		expect(isTmdbRegion(undefined)).toBe(false);
	});

	it("asks players for the profile's language when the admin lists it", () => {
		expect(playerLanguage("en", ["en", "ne"], "ne")).toBe("ne");
		expect(playerLanguage("ne", ["en"], "ne")).toBe("en");
		expect(playerLanguage("en", ["en"], null)).toBe("en");
		expect(playerLanguage("ne", [], "ne")).toBe("ne");
	});
});
