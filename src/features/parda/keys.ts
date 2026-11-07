import type { Locale } from "@/paraglide/runtime";
import type { DiscoverSearch, LibraryQuery, PardaPage, PardaType, SearchTab } from "./search";

/** Parda's query keys: the catalogue's answers depend on the language (TMDB's text, the Nepali fill-in). */
export const pardaKeys = {
	all: ["parda"] as const,
	catalog: (locale: Locale) => [...pardaKeys.all, "catalog", locale] as const,
	banner: () => [...pardaKeys.all, "banner"] as const,
	page: (locale: Locale, page: PardaPage) => [...pardaKeys.catalog(locale), "page", page] as const,
	rail: (locale: Locale, page: PardaPage, rail: string) => [...pardaKeys.page(locale, page), "rail", rail] as const,
	title: (locale: Locale, type: PardaType, id: number) => [...pardaKeys.catalog(locale), "title", type, id] as const,
	season: (locale: Locale, id: number, season: number | undefined, page: number | undefined) =>
		[...pardaKeys.title(locale, "series", id), "season", season ?? "first", page ?? 1] as const,
	credits: (locale: Locale, type: PardaType, id: number) => [...pardaKeys.title(locale, type, id), "credits"] as const,
	person: (locale: Locale, id: number) => [...pardaKeys.catalog(locale), "person", id] as const,
	collection: (locale: Locale, id: number) => [...pardaKeys.catalog(locale), "collection", id] as const,
	curated: (locale: Locale, slug: string) => [...pardaKeys.catalog(locale), "curated", slug] as const,
	search: (locale: Locale, q: string, tab: SearchTab, page: number) =>
		[...pardaKeys.catalog(locale), "search", q, tab, page] as const,
	suggest: (locale: Locale, q: string) => [...pardaKeys.catalog(locale), "suggest", q] as const,
	discover: (locale: Locale, filters: DiscoverSearch) => [...pardaKeys.catalog(locale), "discover", filters] as const,
	/** Anime airing this week (Task 68): the day is the viewer's, so it's read again after a minute. */
	animeWeek: (locale: Locale) => [...pardaKeys.catalog(locale), "anime-week"] as const,
};

/**
 * The viewer's own reads (decision 0236): not per language for progress, but the rail's
 * titles are; all under `library`, so a save invalidates them together.
 */
export const pardaLibraryKeys = {
	all: [...pardaKeys.all, "library"] as const,
	viewer: () => [...pardaLibraryKeys.all, "viewer"] as const,
	continue: (locale: Locale) => [...pardaLibraryKeys.all, "continue", locale] as const,
	title: (locale: Locale, media: "movie" | "tv", id: number) =>
		[...pardaLibraryKeys.all, "title", locale, media, id] as const,
	watch: (locale: Locale, type: PardaType, id: number, season?: number, episode?: number) =>
		[...pardaLibraryKeys.all, "watch", locale, type, id, season ?? null, episode ?? null] as const,
	/** A watch party's page: this viewer's resume and cap are in it. */
	party: (locale: Locale, code: string) => [...pardaLibraryKeys.all, "party", locale, code] as const,
	/** What the profile saved: every page's My List, ♥ and Like buttons (decision 0240). */
	saved: () => [...pardaLibraryKeys.all, "saved"] as const,
	shelf: (locale: Locale, tab: "list" | "favourites", query: LibraryQuery) =>
		[...pardaLibraryKeys.all, "shelf", locale, tab, query] as const,
	history: (locale: Locale, page: number) => [...pardaLibraryKeys.all, "history", locale, page] as const,
	forYou: (locale: Locale) => [...pardaLibraryKeys.all, "for-you", locale] as const,
	profiles: (locale: Locale) => [...pardaLibraryKeys.all, "profiles", locale] as const,
	/** The bell (decision 0241): the profile's alerts and how many are unread. */
	inbox: (locale: Locale) => [...pardaLibraryKeys.all, "inbox", locale] as const,
	/** The followed series' half of the schedule. */
	following: (locale: Locale) => [...pardaLibraryKeys.all, "following", locale] as const,
};
