/**
 * The home's and the hubs' rails (PLAN Task 62, decision 0234): which rails each page
 * has, their first order, and the TMDB request behind each. The admin reorders and hides
 * them (`pd_rail`, `mergedRails` in ../curation.ts, decision 0242).
 *
 * This module imports nothing at runtime, so `pnpm tmdb:record` (a plain Node script)
 * records exactly these requests, and the fixtures can't drift from the pages.
 */
import type { AnimeKeyword, RailLabel } from "@/features/parda/home/types";
import type { PardaPage } from "@/features/parda/search";
import type { ListMedia } from "../tmdb/mappers";

/** What a rail's request depends on besides its path: the date in Tokyo, the anime season, the admin's region. */
export type RailContext = { today: string; seasonStart: string; seasonEnd: string; region: string };

export type RailRequest = { media: ListMedia; path: string; params: Readonly<Record<string, string | number>> };

export type RailSpec = {
	/** Stable within its page: the client asks for a streamed rail by it, and `pd_rail` stores layouts by it. */
	id: string;
	kind: "top10" | "poster";
	/** Named by the client in the page's language (`railLabel`). */
	label: RailLabel;
	request: (context: RailContext) => RailRequest;
};

export type PageLayout = {
	/** The rail whose first titles with a backdrop fill the billboard. */
	billboardFrom: string;
	rails: ReadonlyArray<RailSpec>;
};

/** How many titles a billboard shows, and the rails awaited before the page is sent (the rest stream). */
export const BILLBOARD_SIZE = 5;
export const AWAITED_RAILS = 2;

/** Anime is TMDB's animation genre in Japanese (PLAN 12.4). */
const ANIME = { with_genres: 16, with_original_language: "ja" } as const;
/** Enough votes that a "top rated" or genre rail isn't led by a title three people rated. */
const RATED = { "vote_count.gte": 200 } as const;
const BY_POPULARITY = { sort_by: "popularity.desc" } as const;
const BY_RATING = { sort_by: "vote_average.desc", ...RATED } as const;

/** TMDB keyword ids (search/keyword, checked 2026-11-04). */
const KEYWORDS: Readonly<Record<AnimeKeyword, number>> = {
	isekai: 237451,
	shounen: 207826,
	mecha: 10046,
	sliceOfLife: 9914,
};

const fixed =
	(media: ListMedia, path: string, params: RailRequest["params"] = {}) =>
	(): RailRequest => ({ media, path, params });

const genreRail = (media: "movie" | "tv", genre: number, of?: "movies" | "series"): RailSpec => ({
	id: `${media}-genre-${genre}`,
	kind: "poster",
	label: of ? { genre, of } : { genre },
	request: fixed(media, `discover/${media}`, { with_genres: genre, ...BY_POPULARITY, "vote_count.gte": 100 }),
});

const keywordRail = (keyword: AnimeKeyword): RailSpec => ({
	id: `keyword-${keyword.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
	kind: "poster",
	label: { keyword },
	request: fixed("tv", "discover/tv", { ...ANIME, with_keywords: KEYWORDS[keyword], ...BY_POPULARITY }),
});

export const PAGE_LAYOUTS: Readonly<Record<PardaPage, PageLayout>> = {
	home: {
		billboardFrom: "trending",
		rails: [
			{ id: "top10", kind: "top10", label: { key: "top10" }, request: fixed("mixed", "trending/all/day") },
			{ id: "trending", kind: "poster", label: { key: "trending" }, request: fixed("mixed", "trending/all/week") },
			{
				id: "popular-movies",
				kind: "poster",
				label: { key: "popularMovies" },
				request: fixed("movie", "movie/popular"),
			},
			{ id: "popular-series", kind: "poster", label: { key: "popularSeries" }, request: fixed("tv", "tv/popular") },
			{
				id: "popular-anime",
				kind: "poster",
				label: { key: "popularAnime" },
				request: fixed("tv", "discover/tv", { ...ANIME, ...BY_POPULARITY }),
			},
			{
				id: "top-rated-movies",
				kind: "poster",
				label: { key: "topRatedMovies" },
				request: fixed("movie", "movie/top_rated"),
			},
			{
				id: "top-rated-series",
				kind: "poster",
				label: { key: "topRatedSeries" },
				request: fixed("tv", "tv/top_rated"),
			},
			{
				id: "upcoming",
				kind: "poster",
				label: { key: "upcoming" },
				request: ({ region }) => ({ media: "movie", path: "movie/upcoming", params: { region } }),
			},
			genreRail("movie", 28, "movies"),
			genreRail("movie", 35, "movies"),
			genreRail("tv", 80, "series"),
		],
	},
	movies: {
		billboardFrom: "trending",
		rails: [
			{ id: "top10", kind: "top10", label: { key: "top10" }, request: fixed("movie", "trending/movie/day") },
			{ id: "trending", kind: "poster", label: { key: "trending" }, request: fixed("movie", "trending/movie/week") },
			{ id: "popular", kind: "poster", label: { key: "popular" }, request: fixed("movie", "movie/popular") },
			{ id: "top-rated", kind: "poster", label: { key: "topRated" }, request: fixed("movie", "movie/top_rated") },
			{
				id: "upcoming",
				kind: "poster",
				label: { key: "upcoming" },
				request: ({ region }) => ({ media: "movie", path: "movie/upcoming", params: { region } }),
			},
			genreRail("movie", 28),
			genreRail("movie", 35),
			genreRail("movie", 18),
			genreRail("movie", 27),
			genreRail("movie", 878),
		],
	},
	series: {
		billboardFrom: "trending",
		rails: [
			{ id: "top10", kind: "top10", label: { key: "top10" }, request: fixed("tv", "trending/tv/day") },
			{ id: "trending", kind: "poster", label: { key: "trending" }, request: fixed("tv", "trending/tv/week") },
			{ id: "popular", kind: "poster", label: { key: "popular" }, request: fixed("tv", "tv/popular") },
			{ id: "top-rated", kind: "poster", label: { key: "topRated" }, request: fixed("tv", "tv/top_rated") },
			{ id: "on-the-air", kind: "poster", label: { key: "onTheAir" }, request: fixed("tv", "tv/on_the_air") },
			genreRail("tv", 18),
			genreRail("tv", 80),
			genreRail("tv", 35),
			genreRail("tv", 10765),
			genreRail("tv", 9648),
		],
	},
	anime: {
		billboardFrom: "popular",
		rails: [
			{
				id: "airing-today",
				kind: "poster",
				label: { key: "airingToday" },
				request: ({ today }) => ({
					media: "tv",
					path: "discover/tv",
					params: { ...ANIME, ...BY_POPULARITY, "air_date.gte": today, "air_date.lte": today },
				}),
			},
			{
				id: "this-season",
				kind: "poster",
				label: { key: "thisSeason" },
				request: ({ seasonStart, seasonEnd }) => ({
					media: "tv",
					path: "discover/tv",
					params: { ...ANIME, ...BY_POPULARITY, "first_air_date.gte": seasonStart, "first_air_date.lte": seasonEnd },
				}),
			},
			{
				id: "popular",
				kind: "poster",
				label: { key: "popular" },
				request: fixed("tv", "discover/tv", { ...ANIME, ...BY_POPULARITY }),
			},
			{
				id: "top-rated",
				kind: "poster",
				label: { key: "topRated" },
				request: fixed("tv", "discover/tv", { ...ANIME, ...BY_RATING }),
			},
			{
				id: "films",
				kind: "poster",
				label: { key: "animeFilms" },
				request: fixed("movie", "discover/movie", { ...ANIME, ...BY_POPULARITY }),
			},
			keywordRail("isekai"),
			keywordRail("shounen"),
			keywordRail("mecha"),
			keywordRail("sliceOfLife"),
		],
	},
};

/** Anime airs on Japanese dates, so "today" and "this season" are Tokyo's. */
const ANIME_ZONE = "Asia/Tokyo";

const isoDate = (date: Date, timeZone: string) =>
	new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** The context for `now`: today in Tokyo, and the anime season (January, April, July, October) it falls in. */
export function railContext(region: string, now: Date = new Date()): RailContext {
	const today = isoDate(now, ANIME_ZONE);
	const year = Number(today.slice(0, 4));
	const first = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
	const last = first + 2;
	const pad = (month: number) => String(month).padStart(2, "0");
	const lastDay = new Date(Date.UTC(year, last, 0)).getUTCDate();
	return { today, seasonStart: `${year}-${pad(first)}-01`, seasonEnd: `${year}-${pad(last)}-${lastDay}`, region };
}
