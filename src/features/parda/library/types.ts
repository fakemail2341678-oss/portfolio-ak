import type { HubTitle } from "../home/types";
import type { NewEpisodeItem } from "../schedule/types";

/**
 * What the library functions return (decision 0236): lean, like the catalogue's answers.
 */

export type LibraryMedia = "movie" | "tv";

/** The title page's main action, from the profile's progress. */
export type TitleCta =
	| { kind: "resume"; season: number | null; episode: number | null; left: number | null; share: number }
	| { kind: "next"; season: number; episode: number }
	/** Every aired episode watched; the next one airs later (`season`, `episode`). */
	| { kind: "caughtUp"; season: number; episode: number }
	| { kind: "rewatch" };

export type EpisodeProgress = { season: number; episode: number; share: number; finished: boolean };

export type TitleProgressData = {
	cta: TitleCta | null;
	/** The movie's own bar (a series has none). */
	share: number | null;
	episodes: EpisodeProgress[];
};

export type ContinueItem = {
	media: LibraryMedia;
	id: number;
	slug: string;
	title: string;
	backdrop: string | null;
	poster: string | null;
	/** What its card's action does. */
	cta: Extract<TitleCta, { kind: "resume" | "next" }>;
	/** The bar under the picture: the share of the movie or episode watched. */
	share: number;
};

export type ContinueRailData = { imageBase: string; items: ContinueItem[] };

/** Who's watching, for the frame: the profile, and when a guest's data is deleted. */
export type PardaViewerData = {
	profile: { id: string; name: string; avatar: string | null; kids: boolean; autoplay: boolean };
	/** How many profiles the owner has: the account menu offers to switch from two. */
	profiles: number;
	isGuest: boolean;
	/** ISO time; null for an account. */
	guestDeletesAt: string | null;
};

/** A title in the library's grids and the personal rails: as the rails carry it (decision 0240). */
export type LibraryTitle = HubTitle;

/**
 * What the profile has saved, for the buttons on cards and pages: title keys
 * (`movie:550`) on My List and ♥, favourite people's ids, and likes. The most recent
 * 2,000 of each, which every button on every page reads.
 */
export type SavedState = {
	watchlist: string[];
	favourite: string[];
	people: number[];
	likes: string[];
	dislikes: string[];
};

export type LibraryListSort = "added" | "title" | "year";
export type LibraryListType = "all" | "movie" | "tv";

export type LibraryListData = {
	imageBase: string;
	titles: LibraryTitle[];
	page: number;
	pageCount: number;
	total: number;
};

export type FavouritePerson = { id: number; name: string; portrait: string | null };

export type LibraryFavouritesData = LibraryListData & { people: FavouritePerson[] };

export type HistoryEntry = {
	media: LibraryMedia;
	id: number;
	slug: string;
	title: string;
	poster: string | null;
	backdrop: string | null;
	/** A series' episodes watched that day, latest first; empty for a movie. */
	episodes: Array<{ season: number; episode: number }>;
	/** The latest of them: how far that one got. */
	share: number;
	/** ISO time of the latest. */
	at: string;
};

/** History by day ("YYYY-MM-DD" in Parda's time zone), latest first, a page at a time. */
export type HistoryData = {
	imageBase: string;
	days: Array<{ day: string; entries: HistoryEntry[] }>;
	page: number;
	hasMore: boolean;
};

/** The home's personal rails: "Because you liked …" and "New from people you love". Null when there's nothing to show. */
export type ForYouData = {
	imageBase: string;
	because: { title: string; titles: LibraryTitle[] } | null;
	people: LibraryTitle[] | null;
	/** New episodes of followed series (Task 68, decision 0241); null when there are none. */
	episodes: NewEpisodeItem[] | null;
};
