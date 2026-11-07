/**
 * Discover's choices (Task 66, decision 0239), shared by the page, the server and
 * `pnpm tmdb:record`, so this module imports nothing. Ids are TMDB's (checked against
 * its API on 2026-11-05); names of networks and studios are brands, not messages.
 */

/** TMDB's genres for each type, in its own order. */
export const DISCOVER_GENRES = {
	movie: [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37],
	series: [10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37],
} as const;

/** Original languages offered: TMDB's ISO 639-1 codes, named on the server in the page's language. */
export const DISCOVER_LANGUAGES = [
	"en",
	"hi",
	"ne",
	"ja",
	"ko",
	"zh",
	"es",
	"fr",
	"de",
	"it",
	"pt",
	"ta",
	"te",
	"ml",
	"tr",
	"th",
] as const;

export type DiscoverCompany = { id: number; name: string };

/** Series filter by network, movies by studio: the best known of each. */
export const DISCOVER_COMPANIES: { movie: ReadonlyArray<DiscoverCompany>; series: ReadonlyArray<DiscoverCompany> } = {
	series: [
		{ id: 213, name: "Netflix" },
		{ id: 49, name: "HBO" },
		{ id: 3186, name: "HBO Max" },
		{ id: 1024, name: "Prime Video" },
		{ id: 2739, name: "Disney+" },
		{ id: 2552, name: "Apple TV" },
		{ id: 453, name: "Hulu" },
		{ id: 4, name: "BBC One" },
		{ id: 174, name: "AMC" },
		{ id: 88, name: "FX" },
		{ id: 1112, name: "Crunchyroll" },
		{ id: 614, name: "TOKYO MX" },
		{ id: 1, name: "Fuji TV" },
		{ id: 866, name: "tvN" },
		{ id: 885, name: "JTBC" },
	],
	movie: [
		{ id: 420, name: "Marvel Studios" },
		{ id: 2, name: "Walt Disney Pictures" },
		{ id: 3, name: "Pixar" },
		{ id: 1, name: "Lucasfilm" },
		{ id: 174, name: "Warner Bros. Pictures" },
		{ id: 33, name: "Universal Pictures" },
		{ id: 4, name: "Paramount Pictures" },
		{ id: 5, name: "Columbia Pictures" },
		{ id: 127928, name: "20th Century Studios" },
		{ id: 25, name: "20th Century Fox" },
		{ id: 923, name: "Legendary Pictures" },
		{ id: 521, name: "DreamWorks Animation" },
		{ id: 41077, name: "A24" },
		{ id: 10342, name: "Studio Ghibli" },
		{ id: 882, name: "TOHO" },
		{ id: 1569, name: "Yash Raj Films" },
	],
};

/** The lowest score a "Rated at least" choice offers, and the highest. */
export const DISCOVER_RATINGS = [5, 6, 7, 8] as const;
