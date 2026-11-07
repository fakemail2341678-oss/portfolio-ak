/**
 * Discover's and search's TMDB requests (Task 66, decision 0239). Like rails.ts, this
 * module imports nothing through the app's aliases at runtime, so `pnpm tmdb:record`
 * records exactly the requests the pages make.
 */
import type { DiscoverSearch } from "@/features/parda/search";
import { DISCOVER_COMPANIES, DISCOVER_GENRES } from "../../../features/parda/discover/options.ts";
import type { RailRequest } from "./rails";

/** TMDB's `with_status` codes for series. */
const STATUS_CODES = { returning: 0, production: 2, ended: 3, canceled: 4 } as const;

/** Runtime bands in minutes: a movie's length, or a series' episode. */
const RUNTIMES = {
	movie: { short: [undefined, 89], medium: [90, 150], long: [151, undefined] },
	series: { short: [undefined, 30], medium: [31, 60], long: [61, undefined] },
} as const;

/** Enough votes that a sort by score or by date isn't led by titles nobody has seen. */
const SORT_FLOORS = { rating: 200, newest: 10, oldest: 50, title: 50 } as const;

/** What Discover keeps of a search: only what applies to its type. */
export function applicableFilters(search: DiscoverSearch): DiscoverSearch {
	const genres: ReadonlyArray<number> = DISCOVER_GENRES[search.type];
	const companies = DISCOVER_COMPANIES[search.type];
	const [from, to] =
		search.from !== undefined && search.to !== undefined && search.from > search.to
			? [search.to, search.from]
			: [search.from, search.to];
	return {
		...search,
		genres: search.genres.filter((genre) => genres.includes(genre)),
		from,
		to,
		status: search.type === "series" ? search.status : undefined,
		company: companies.some((company) => company.id === search.company) ? search.company : undefined,
	};
}

/**
 * The discover request for a page of filters. `today` (YYYY-MM-DD) keeps "newest" to
 * what has come out.
 */
export function discoverRequest(search: DiscoverSearch, today: string): RailRequest {
	const filters = applicableFilters(search);
	const movie = filters.type === "movie";
	const date = movie ? "primary_release_date" : "first_air_date";
	const params: Record<string, string | number> = { page: filters.page };
	const floor = filters.sort === "popular" ? 0 : SORT_FLOORS[filters.sort];
	params.sort_by = {
		popular: "popularity.desc",
		rating: "vote_average.desc",
		newest: `${date}.desc`,
		oldest: `${date}.asc`,
		title: movie ? "title.asc" : "name.asc",
	}[filters.sort];
	if (filters.sort === "newest") params[`${date}.lte`] = today;
	if (filters.genres.length) params.with_genres = filters.genres.join(",");
	if (filters.from !== undefined) params[`${date}.gte`] = `${filters.from}-01-01`;
	if (filters.to !== undefined) params[`${date}.lte`] = `${filters.to}-12-31`;
	// A minimum score means little over a handful of votes.
	const votes = Math.max(floor, filters.rating === undefined ? 0 : 50);
	if (filters.rating !== undefined) params["vote_average.gte"] = filters.rating;
	if (votes) params["vote_count.gte"] = votes;
	if (filters.runtime) {
		const [min, max] = RUNTIMES[filters.type][filters.runtime];
		if (min !== undefined) params["with_runtime.gte"] = min;
		if (max !== undefined) params["with_runtime.lte"] = max;
	}
	if (filters.language) params.with_original_language = filters.language;
	if (filters.status) params.with_status = STATUS_CODES[filters.status];
	if (filters.company !== undefined) params[movie ? "with_companies" : "with_networks"] = filters.company;
	if (filters.keyword !== undefined) params.with_keywords = filters.keyword;
	return { media: movie ? "movie" : "tv", path: movie ? "discover/movie" : "discover/tv", params };
}

/** The filters Discover would need to show a rail's titles, or null when it can't (dates, other lists). */
export function discoverOfRail(request: RailRequest): Partial<DiscoverSearch> | null {
	const type = request.path === "discover/movie" ? "movie" : request.path === "discover/tv" ? "series" : null;
	if (!type) return null;
	const filters: Partial<DiscoverSearch> = { type };
	for (const [key, value] of Object.entries(request.params)) {
		if (key === "page" || key === "vote_count.gte") continue;
		if (key === "sort_by" && value === "popularity.desc") continue;
		if (key === "sort_by" && value === "vote_average.desc") filters.sort = "rating";
		else if (key === "with_genres") filters.genres = String(value).split(",").map(Number);
		else if (key === "with_original_language") filters.language = String(value);
		else if (key === "with_keywords" && /^\d+$/.test(String(value))) filters.keyword = Number(value);
		else return null;
	}
	return filters;
}

/** The discover pages `pnpm tmdb:record` records: Discover as it opens, and the flows' filters. */
export const DISCOVER_SAMPLES: ReadonlyArray<Partial<DiscoverSearch>> = [
	{},
	{ type: "series" },
	{ genres: [28] },
	{ type: "series", sort: "rating" },
];

/** The queries `pnpm tmdb:record` records for search: one that finds things, one that finds nothing. */
export const SEARCH_SAMPLES = { found: "star", nothing: "qzxv no such title" } as const;

/** A full set of filters from some of them, with the URL contract's defaults. */
export const discoverFilters = (filters: Partial<DiscoverSearch> = {}): DiscoverSearch => ({
	type: "movie",
	genres: [],
	sort: "popular",
	page: 1,
	...filters,
});
