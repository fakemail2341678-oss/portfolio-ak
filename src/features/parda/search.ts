import { z } from "zod";
import { SLUG_MAX, SLUG_PATTERN } from "@/lib/slug";
import { parseTitleParam } from "./slug";

/**
 * Parda's URL contract (PLAN 12.5): route files import this, never a form schema (0194).
 */

/** The hubs at /app/parda/$hub. */
export const PARDA_HUBS = ["movies", "series", "anime"] as const;
export type PardaHub = (typeof PARDA_HUBS)[number];
/** A page of rails: the home or a hub. */
export type PardaPage = "home" | PardaHub;

export const isPardaHub = (value: string): value is PardaHub => (PARDA_HUBS as ReadonlyArray<string>).includes(value);

/** A title's type in its URL (/app/parda/movie/550, /app/parda/series/1396), and TMDB's name for it. */
export const PARDA_TYPES = { movie: "movie", series: "tv" } as const;
export type PardaType = keyof typeof PARDA_TYPES;
export const typeOfMedia = (media: "movie" | "tv"): PardaType => (media === "movie" ? "movie" : "series");

const tmdbId = z.coerce.number().int().positive().max(2_147_483_647);

/** A title as the catalogue functions take it: a known type and a positive TMDB id. */
export const titleParamsSchema = z.object({ type: z.enum(["movie", "series"]), id: tmdbId });

/** A person's or a collection's `$id`. */
export const idParamSchema = z.object({ id: tmdbId });

/** A curated collection's `$slug` (/app/parda/c/best-of-2024). */
export const curatedParamSchema = z.object({ slug: z.string().max(SLUG_MAX).regex(SLUG_PATTERN) });

/**
 * `$type/$id` as a title's pages read them: a known type, and an id with its slug
 * ("550-fight-club"), or nothing (a 404). A wrong slug is the loader's 301.
 */
export function titleRouteParams(params: {
	type: string;
	id: string;
}): { type: PardaType; id: number; slug: string } | null {
	const type: PardaType | null = params.type === "movie" || params.type === "series" ? params.type : null;
	const parsed = parseTitleParam(params.id);
	return type && parsed ? { type, ...parsed } : null;
}

const optionalNumber = (max: number, min = 0) => z.coerce.number().int().min(min).max(max).optional().catch(undefined);

/**
 * A title page's search (never strict: links carry utm tags): the season shown, a page
 * of its episodes (some seasons hold over a thousand), and the episode whose sheet is open.
 */
export const titleSearchSchema = z.object({
	season: optionalNumber(9_999),
	page: optionalNumber(999, 1),
	episode: optionalNumber(99_999, 1),
});

/** A season's episodes a page at a time. */
export const EPISODES_PER_PAGE = 30;

/** "Surprise me": the page it was pressed on picks the lists it draws from. */
export const surpriseSearchSchema = z.object({
	from: z
		.enum(["home", ...PARDA_HUBS])
		.default("home")
		.catch("home"),
});

/** The search page's tabs (Task 66): TMDB's multi search, or one kind. */
export const SEARCH_TABS = ["all", "movies", "series", "people"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];
/** TMDB answers at most 500 pages of any search or discover query. */
export const TMDB_MAX_PAGE = 500;
/** The longest query kept: the box's maxlength, the URL's and the statistics'. */
export const QUERY_MAX = 100;

const pageNumber = z.coerce.number().int().min(1).max(TMDB_MAX_PAGE).default(1).catch(1);

/** `/app/parda/search?q=dune&tab=movies&page=2` (decision 0239). */
export const searchPageSchema = z.object({
	q: z.string().trim().max(QUERY_MAX).default("").catch(""),
	tab: z.enum(SEARCH_TABS).default("all").catch("all"),
	page: pageNumber,
});
export type SearchPageSearch = z.output<typeof searchPageSchema>;

export const DISCOVER_SORTS = ["popular", "rating", "newest", "oldest", "title"] as const;
export const DISCOVER_RUNTIMES = ["short", "medium", "long"] as const;
export const DISCOVER_STATUSES = ["returning", "production", "ended", "canceled"] as const;

const optional = <T extends z.ZodType>(schema: T) =>
	z.preprocess((value) => (value === "" ? undefined : value), schema.optional()).catch(undefined);
const year = optional(z.coerce.number().int().min(1874).max(2100));

/**
 * Discover's URL contract (decision 0239): what `FilterBar`'s GET form writes, so the
 * same address works with and without JavaScript. `company` is a network for series and
 * a studio for movies; `status` applies to series only. The server drops what doesn't
 * apply to the type.
 */
export const discoverSearchSchema = z.object({
	type: z.enum(["movie", "series"]).default("movie").catch("movie"),
	genres: z
		.preprocess(
			(value) => (value === undefined || value === "" ? [] : Array.isArray(value) ? value : [value]),
			z.array(z.coerce.number().int().positive().max(99_999)).max(5),
		)
		.default(() => [])
		.catch(() => []),
	from: year,
	to: year,
	rating: optional(z.coerce.number().int().min(1).max(9)),
	runtime: optional(z.enum(DISCOVER_RUNTIMES)),
	language: optional(z.string().regex(/^[a-z]{2}$/)),
	status: optional(z.enum(DISCOVER_STATUSES)),
	company: optional(z.coerce.number().int().positive().max(9_999_999)),
	keyword: optional(z.coerce.number().int().positive().max(99_999_999)),
	sort: z.enum(DISCOVER_SORTS).default("popular").catch("popular"),
	page: pageNumber,
});
export type DiscoverSearch = z.output<typeof discoverSearchSchema>;
/** Discover's defaults, left out of its URLs. */
export const DISCOVER_DEFAULTS: Pick<DiscoverSearch, "type" | "genres" | "sort" | "page"> = {
	type: "movie",
	genres: [],
	sort: "popular",
	page: 1,
};

/** The watch page's search: a series' season and episode (`?s=2&e=5`); a movie has neither. */
export const watchSearchSchema = z.object({
	s: optionalNumber(9_999),
	e: optionalNumber(99_999, 1),
});

/** The library's tabs at /app/parda/library/$tab (decision 0240). */
export const LIBRARY_TABS = ["list", "favourites", "continue", "history"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];
export const isLibraryTab = (value: string): value is LibraryTab =>
	(LIBRARY_TABS as ReadonlyArray<string>).includes(value);

/** My List's and ♥'s filters and order; History's page. Defaults are left out of the URL. */
export const librarySearchSchema = z.object({
	type: z.enum(["all", "movie", "tv"]).default("all").catch("all"),
	sort: z.enum(["added", "title", "year"]).default("added").catch("added"),
	page: pageNumber,
});
export type LibraryQuery = z.output<typeof librarySearchSchema>;
export const LIBRARY_DEFAULTS: LibraryQuery = { type: "all", sort: "added", page: 1 };
