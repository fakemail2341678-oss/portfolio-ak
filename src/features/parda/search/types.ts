import type { HubTitle } from "../home/types";
import type { DiscoverSearch, SearchTab } from "../search";

/**
 * What the search page, the search overlay and Discover receive (Task 66, decision
 * 0239). Lean, like the rails: TMDB paths with one `imageBase`, genres as ids.
 */

export type PersonHit = {
	media: "person";
	id: number;
	name: string;
	profile: string | null;
	/** TMDB's English department ("Acting"), named by the page. */
	department: string | null;
	/** The titles they're known for, by name. */
	knownFor: string[];
};

export type SearchHit = HubTitle | PersonHit;

export type SearchPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			q: string;
			tab: SearchTab;
			page: number;
			/** At most TMDB's 500. */
			pageCount: number;
			total: number;
			/** Null: TMDB couldn't answer. Empty for no query. */
			hits: SearchHit[] | null;
			/** Trending titles, when there's no query or nothing was found; null otherwise or when TMDB failed. */
			suggestions: HubTitle[] | null;
			/** Over the per-IP limit for searches without a session: nothing was asked. */
			limited?: true;
	  };

/** The overlay's answer: the first hits of TMDB's multi search. */
export type SearchSuggestData = { imageBase: string; hits: SearchHit[] };

export type DiscoverPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			/** The filters that apply to the type (the rest of the URL is ignored). */
			filters: DiscoverSearch;
			/** Null: TMDB couldn't answer. */
			titles: HubTitle[] | null;
			page: number;
			/** At most TMDB's 500. */
			pageCount: number;
			/** The original languages offered, named in the page's language on the server. */
			languages: Array<{ code: string; name: string }>;
			/** `?keyword=`'s name, null when TMDB doesn't know it. */
			keyword: string | null;
	  };
