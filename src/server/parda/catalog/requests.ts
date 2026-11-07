/**
 * The TMDB requests behind a title's pages (PLAN Task 63, decision 0235), shared by the
 * catalogue service and `pnpm tmdb:record`, so the recorder asks for exactly what pages
 * read. Like `rails.ts`, it imports nothing at runtime.
 */

/**
 * One details call holds a title page (PLAN 12.4). `credits` is a movie's,
 * `aggregate_credits` a series' (every season's cast, with episode counts); TMDB
 * ignores the one that doesn't apply, as it does `release_dates` and `content_ratings`.
 */
export const DETAILS_APPEND = [
	"credits",
	"aggregate_credits",
	"videos",
	"images",
	"recommendations",
	"similar",
	"content_ratings",
	"release_dates",
	"keywords",
	"external_ids",
	"watch/providers",
	"alternative_titles",
	"reviews",
].join(",");

/**
 * Images in every language would be dozens of files; English and language-free ones are
 * the logos and stills a page shows (TMDB has almost no Nepali artwork).
 */
export const DETAILS_PARAMS = { append_to_response: DETAILS_APPEND, include_image_language: "en,null" } as const;

/** The full cast and crew, for the credits page. */
export const creditsPath = (media: "movie" | "tv", id: number) =>
	media === "movie" ? `movie/${id}/credits` : `tv/${id}/aggregate_credits`;

export const seasonPath = (id: number, season: number) => `tv/${id}/season/${season}`;

export const PERSON_PARAMS = { append_to_response: "combined_credits,external_ids" } as const;

/** The jobs a title page names as its key crew, in the order it names them. */
export const KEY_JOBS = [
	"Director",
	"Creator",
	"Screenplay",
	"Writer",
	"Story",
	"Novel",
	"Characters",
	"Original Music Composer",
	"Director of Photography",
	"Editor",
	"Producer",
] as const;

/**
 * Anime with an episode airing from `from` to `to` (Task 68's schedule, decision 0241),
 * the most popular first: TMDB's animation genre in Japanese, as the anime hub's rails.
 */
export const animeAiringRequest = (from: string, to: string) =>
	({
		media: "tv",
		path: "discover/tv",
		params: {
			with_genres: 16,
			with_original_language: "ja",
			sort_by: "popularity.desc",
			"air_date.gte": from,
			"air_date.lte": to,
		},
	}) as const;
