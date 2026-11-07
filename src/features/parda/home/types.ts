import type { DiscoverSearch, PardaPage } from "../search";

/**
 * What the home and the hubs receive (decision 0234). Lean: the dehydrated query state
 * is in the page's HTML, so pictures travel as TMDB paths with one `imageBase` per
 * answer, overviews are cut to what the preview shows, and genres are ids (named by
 * our own messages on the client).
 */

export type HubTitle = {
	media: "movie" | "tv";
	id: number;
	/** The address's slug, from the English title (decision 0235). */
	slug: string;
	title: string;
	year: number | null;
	poster: string | null;
	backdrop: string | null;
	overview: string;
	genres: number[];
	/** Out of 10; 0 when nobody has voted (the badge then shows nothing). */
	rating: number;
};

/** A billboard slide: a title with the facts its lower mask shows. */
export type HubSlide = HubTitle & {
	tagline: string;
	runtime: number | null;
	seasons: number | null;
	certification: string | null;
};

/** On the billboard, whether Play has a source to start (as on the title page); Details otherwise (0244). */
export type BillboardSlide = HubSlide & { playable: boolean };

/** A rail's name, rendered by the client in the page's language (`railLabel`). */
export type RailLabel =
	| { key: RailLabelKey }
	| { genre: number; of?: "movies" | "series" }
	| { keyword: AnimeKeyword }
	/** A curated collection's name, already in the page's language. */
	| { text: string };

export type RailLabelKey =
	| "top10"
	| "trending"
	| "popular"
	| "popularMovies"
	| "popularSeries"
	| "popularAnime"
	| "topRated"
	| "topRatedMovies"
	| "topRatedSeries"
	| "upcoming"
	| "onTheAir"
	| "airingToday"
	| "thisSeason"
	| "animeFilms";

export type AnimeKeyword = "isekai" | "shounen" | "mecha" | "sliceOfLife";

export type HubRailHead = {
	id: string;
	kind: "top10" | "poster";
	label: RailLabel;
	/** Discover's filters for the same titles (Task 66): the heading links there. */
	more?: Partial<DiscoverSearch>;
	/** A curated collection's slug: the heading links to its page instead. */
	collection?: string;
};

/** `titles` null: the rail couldn't load (TMDB failed), and says so in place. */
export type HubRailTitles = HubTitle[] | null;

/**
 * A page of rails. The first rails come with their titles (awaited before the page is
 * sent); the rest have none and stream in, each through `getPardaRail`.
 */
export type HubPageData =
	| { configured: false }
	| {
			configured: true;
			page: PardaPage;
			imageBase: string;
			billboard: BillboardSlide[];
			rails: Array<HubRailHead & { titles?: HubRailTitles }>;
	  };

export type HubRailData = { imageBase: string; titles: HubRailTitles };
