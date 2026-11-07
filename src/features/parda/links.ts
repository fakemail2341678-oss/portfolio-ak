import { linkOptions } from "@tanstack/react-router";
import {
	type DiscoverSearch,
	type LibraryQuery,
	type LibraryTab,
	PARDA_HUBS,
	type PardaHub,
	type PardaPage,
	type SearchTab,
	typeOfMedia,
} from "./search";
import { titleParam } from "./slug";

/**
 * Every link into Parda (PLAN 12.5, "Paths"): pages link through these, so moving the
 * product is a move of `src/routes/_parda/app/parda` and this file. Links arrive with
 * their routes (PLAN 12.3).
 */

type Media = "movie" | "tv";

export const pardaLinks = {
	home: () => linkOptions({ to: "/app/parda" }),
	hub: (hub: PardaHub) => linkOptions({ to: "/app/parda/$hub", params: { hub } }),
	/** A title's page, by TMDB's media type and id, with its slug (decision 0235). */
	title: (media: Media, id: number, slug: string) =>
		linkOptions({ to: "/app/parda/$type/$id", params: { type: typeOfMedia(media), id: titleParam(id, slug) } }),
	credits: (media: Media, id: number, slug: string) =>
		linkOptions({
			to: "/app/parda/$type/$id/credits",
			params: { type: typeOfMedia(media), id: titleParam(id, slug) },
		}),
	/** The watch page (noindex): a movie, or a series' episode (none: where the viewer is, else the first). */
	watch: (media: Media, id: number, slug: string, episode?: { season: number; episode: number } | null) =>
		linkOptions({
			to: "/app/parda/watch/$type/$id",
			params: { type: typeOfMedia(media), id: titleParam(id, slug) },
			search: episode ? { s: episode.season, e: episode.episode } : {},
		}),
	/** A watch party (noindex, decision 0243): the link its host shares. */
	party: (code: string) => linkOptions({ to: "/app/parda/party/$code", params: { code } }),
	person: (id: number) => linkOptions({ to: "/app/parda/person/$id", params: { id: String(id) } }),
	collection: (id: number) => linkOptions({ to: "/app/parda/collection/$id", params: { id: String(id) } }),
	/** A collection the admin put together (decision 0242). */
	curated: (slug: string) => linkOptions({ to: "/app/parda/c/$slug", params: { slug } }),
	/** A random title from the page's good lists: a redirect, so it works without JavaScript. */
	surprise: (from: PardaPage) => linkOptions({ to: "/app/parda/surprise", search: { from } }),
	/** The search page (noindex): a query, a tab and a page; without a query, the page asks for one. */
	search: (q?: string, tab?: SearchTab) => linkOptions({ to: "/app/parda/search", search: { q, tab } }),
	/** Discover (indexable), with any of its filters (decision 0239). */
	discover: (filters: Partial<DiscoverSearch> = {}) => linkOptions({ to: "/app/parda/discover", search: filters }),
	/** The library (noindex, decision 0240): My List, ♥, Continue watching, History. */
	library: (tab: LibraryTab = "list", query: Partial<LibraryQuery> = {}) =>
		linkOptions({ to: "/app/parda/library/$tab", params: { tab }, search: query }),
	/** Who's watching: the picker, and managing profiles (noindex). */
	profiles: () => linkOptions({ to: "/app/parda/profiles" }),
	/** The schedule (noindex, decision 0241): followed series for 14 days, anime this week. */
	schedule: () => linkOptions({ to: "/app/parda/schedule" }),
	/** The account (noindex, decision 0249): the shared account sections in Parda's look. */
	account: () => linkOptions({ to: "/app/parda/account" }),
	about: (hash?: string) => linkOptions({ to: "/app/parda/about", ...(hash ? { hash } : {}) }),
	signIn: (redirect?: string) => linkOptions({ to: "/app/parda/sign-in", search: { redirect } }),
	signUp: (redirect?: string) => linkOptions({ to: "/app/parda/sign-up", search: { redirect } }),
};

/** De-localized paths for redirects, `?redirect=` targets, heads and the sitemap. */
export const PARDA_PATHS = {
	home: "/app/parda",
	about: "/app/parda/about",
	discover: "/app/parda/discover",
	search: "/app/parda/search",
	library: (tab: LibraryTab = "list") => `/app/parda/library/${tab}`,
	profiles: "/app/parda/profiles",
	schedule: "/app/parda/schedule",
	account: "/app/parda/account",
	hub: (hub: PardaHub) => `/app/parda/${hub}`,
	title: (media: Media, id: number, slug: string) => `/app/parda/${typeOfMedia(media)}/${titleParam(id, slug)}`,
	credits: (media: Media, id: number, slug: string) => `${PARDA_PATHS.title(media, id, slug)}/credits`,
	person: (id: number) => `/app/parda/person/${id}`,
	collection: (id: number) => `/app/parda/collection/${id}`,
	curated: (slug: string) => `/app/parda/c/${slug}`,
} as const;

/** Parda's indexable pages without parameters (PLAN 12.5, "SEO"); titles come from `pd_title` (sitemap.ts). */
export const PARDA_SITEMAP: ReadonlyArray<string> = [
	PARDA_PATHS.home,
	...PARDA_HUBS.map(PARDA_PATHS.hub),
	PARDA_PATHS.discover,
	PARDA_PATHS.about,
];
