import type { HubSlide, HubTitle } from "../home/types";

/**
 * What a title's pages receive (PLAN Task 63, decision 0235). Lean, like the hubs':
 * pictures are TMDB paths with one `imageBase` per answer, lists are cut to what the
 * page shows, and names of countries and languages are already in the page's language.
 */

/** A plain date as TMDB gives it, "YYYY-MM-DD". */
export type TmdbDate = string;

export type EpisodeRef = { season: number; episode: number; name: string; airDate: TmdbDate | null };

/** Someone in the cast (`role` is the part) or the crew (`role` is the jobs). `episodes` on a series. */
export type CreditPerson = { id: number; name: string; profile: string | null; role: string; episodes?: number };

/** Key crew: a person and their jobs, in TMDB's English (the page names the ones it knows). */
export type KeyCrewMember = { id: number; name: string; jobs: string[] };

export type TitleVideo = { key: string; name: string; type: string };

export type Provider = { id: number; name: string; logo: string | null };
export type ProviderKind = "stream" | "free" | "ads" | "rent" | "buy";
/** Where to watch legally in the admin's region (JustWatch's data, through TMDB). */
export type WatchProviders = { link: string | null } & Record<ProviderKind, Provider[]>;

export type TitleReview = {
	id: string;
	author: string;
	/** Out of 10; null when the review gave none. */
	rating: number | null;
	content: string;
	/** True when `content` was cut: the rest is on TMDB. */
	cut: boolean;
	date: string;
	url: string;
};

export type SeasonSummary = {
	number: number;
	name: string;
	poster: string | null;
	year: number | null;
	episodes: number;
};

export type ExternalLinks = {
	imdb: string | null;
	wikidata: string | null;
	facebook: string | null;
	instagram: string | null;
	twitter: string | null;
	homepage: string | null;
};

/** A title on a list of the page (More like this, a collection, a filmography): a hub title with its slug. */
export type ListTitle = HubTitle;

export type TitleFacts = HubSlide & {
	slug: string;
	originalTitle: string;
	/** Already named in the page's language ("Japanese", "जापानी"). */
	originalLanguage: string | null;
	logo: string | null;
	votes: number;
	/** TMDB's status, in English ("Released", "Returning Series"); the page names the ones it knows. */
	status: string | null;
	releaseDate: TmdbDate | null;
	lastAirDate: TmdbDate | null;
	episodes: number | null;
	next: EpisodeRef | null;
	latest: EpisodeRef | null;
	spokenLanguages: string[];
	networks: Provider[];
	companies: string[];
	countries: string[];
	budget: number;
	revenue: number;
	ratings: Array<{ country: string; rating: string }>;
	alternativeTitles: Array<{ country: string; title: string }>;
	keywords: Array<{ id: number; name: string }>;
	links: ExternalLinks;
	collection: { id: number; name: string; backdrop: string | null; poster: string | null } | null;
};

export type TitlePageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			title: TitleFacts;
			seasons: SeasonSummary[];
			cast: CreditPerson[];
			crew: KeyCrewMember[];
			providers: WatchProviders | null;
			videos: TitleVideo[];
			gallery: { backdrops: string[]; posters: string[] };
			recommendations: ListTitle[];
			similar: ListTitle[];
			reviews: TitleReview[];
			/** False when playback is off or no source can play it: no Play. */
			playable: boolean;
			/** The server's date (UTC), so "new" and "upcoming" read the same in the HTML and in the browser. */
			today: TmdbDate;
	  };

export type SeasonEpisode = {
	number: number;
	name: string;
	overview: string;
	still: string | null;
	runtime: number | null;
	airDate: TmdbDate | null;
	rating: number;
	guests: CreditPerson[];
	directors: Array<{ id: number; name: string }>;
	writers: Array<{ id: number; name: string }>;
};

/** One page of a season's episodes. `null` episodes: TMDB couldn't answer, and the list says so. */
export type SeasonData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			number: number;
			name: string;
			overview: string;
			total: number;
			page: number;
			pageCount: number;
			episodes: SeasonEpisode[] | null;
			today: TmdbDate;
	  };

export type CreditsPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			title: Pick<TitleFacts, "media" | "id" | "slug" | "title" | "year" | "poster" | "backdrop">;
			cast: CreditPerson[];
			/** By department, in TMDB's English ("Directing"); the page names the ones it knows. */
			crew: Array<{ department: string; people: CreditPerson[] }>;
	  };

export type FilmographyEntry = ListTitle & { role: string; date: TmdbDate | null; episodes?: number };

export type PersonPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			person: {
				id: number;
				name: string;
				biography: string;
				profile: string | null;
				knownFor: string | null;
				birthday: TmdbDate | null;
				deathday: TmdbDate | null;
				placeOfBirth: string | null;
				links: ExternalLinks;
			};
			knownFor: ListTitle[];
			/** By department ("Acting" for the cast), most credits first; each newest first. */
			filmography: Array<{ department: string; entries: FilmographyEntry[] }>;
	  };

export type CollectionPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			collection: { id: number; name: string; overview: string; poster: string | null; backdrop: string | null };
			/** In release order, unreleased ones last. */
			parts: ListTitle[];
	  };

/** Where "Surprise me" lands. */
export type SurpriseTarget = { media: "movie" | "tv"; id: number; slug: string } | null;

/** A collection the admin put together, at /app/parda/c/{slug} (decision 0242). */
export type CuratedPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			collection: { slug: string; name: string; description: string; backdrop: string | null };
			parts: HubTitle[];
	  };
