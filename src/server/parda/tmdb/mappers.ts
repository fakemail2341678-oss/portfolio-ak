import "@tanstack/react-start/server-only";
import { z } from "zod";
import { titleSlug } from "@/features/parda/slug";
import type {
	CreditPerson,
	EpisodeRef,
	ExternalLinks,
	KeyCrewMember,
	Provider,
	ProviderKind,
	TitleReview,
	TitleVideo,
	WatchProviders,
} from "@/features/parda/title/types";
import { AppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import { KEY_JOBS } from "../catalog/requests";

/**
 * TMDB's answers turned into lean DTOs (decision 0229): only what pages use, because
 * the dehydrated query state is in every page's HTML. Codes (countries, languages) stay
 * codes here: the cache holds one answer per language, and the page names them.
 */

export type TitleSummary = {
	media: PardaMedia;
	id: number;
	/** From the English title (decision 0235); the Nepali answer takes the English one. */
	slug: string;
	title: string;
	overview: string;
	year: number | null;
	poster: string | null;
	backdrop: string | null;
	genres: number[];
	/** TMDB's average vote out of 10, to one decimal; 0 when nobody has voted. */
	rating: number;
};

export type TitleDetails = TitleSummary & {
	/** Often empty, and rarely in Nepali: then there's no subtitle, never the English one (the direction contract). */
	tagline: string;
	runtime: number | null;
	imdbId: string | null;
	certification: string | null;
	seasons: number | null;
	originalTitle: string;
	originalLanguage: string | null;
	logo: string | null;
	votes: number;
	status: string | null;
	releaseDate: string | null;
	lastAirDate: string | null;
	episodes: number | null;
	next: EpisodeRef | null;
	latest: EpisodeRef | null;
	seasonList: Array<{ number: number; name: string; poster: string | null; year: number | null; episodes: number }>;
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
	cast: CreditPerson[];
	crew: KeyCrewMember[];
	videos: TitleVideo[];
	gallery: { backdrops: string[]; posters: string[] };
	providers: WatchProviders | null;
	recommendations: TitleSummary[];
	similar: TitleSummary[];
	reviews: TitleReview[];
};
export type TitleList = { page: number; totalPages: number; results: TitleSummary[] };

/** How much of each list a title page shows. */
const LIMITS = { cast: 20, crew: 8, videos: 12, gallery: 12, titles: 12, reviews: 5, alternative: 12, keywords: 20 };
/** A review is shown collapsed, with its first lines; the rest is a link to TMDB. */
const REVIEW_MAX = 1_200;

const text = z
	.string()
	.nullish()
	.transform((value) => value ?? "");
const path = z.string().nullish();
const count = z
	.number()
	.nullish()
	.transform((value) => value ?? 0);

const itemSchema = z.object({
	id: z.number().int().positive(),
	title: text,
	name: text,
	overview: text,
	poster_path: path,
	backdrop_path: path,
	release_date: z.string().nullish(),
	first_air_date: z.string().nullish(),
	genre_ids: z.array(z.number()).optional(),
	genres: z.array(z.object({ id: z.number() })).optional(),
	vote_average: z.number().nullish(),
	vote_count: count,
	/** Trending answers mix movies, series and people; other lists leave it out. */
	media_type: z.string().optional(),
	/** `include_adult=false` doesn't reach trending, so adult titles are dropped here too. */
	adult: z.boolean().optional(),
	softcore: z.boolean().optional(),
});

const listSchema = z.object({
	page: z.number(),
	total_pages: z.number(),
	results: z.array(itemSchema),
});

const episodeRefSchema = z
	.object({ season_number: z.number(), episode_number: z.number(), name: text, air_date: z.string().nullish() })
	.nullish();

const personSchema = z.object({ id: z.number(), name: text, profile_path: path });
const castSchema = personSchema.extend({
	character: text,
	roles: z.array(z.object({ character: text, episode_count: count })).optional(),
	total_episode_count: z.number().optional(),
});
const crewSchema = personSchema.extend({
	job: text,
	department: text,
	jobs: z.array(z.object({ job: text, episode_count: count })).optional(),
	total_episode_count: z.number().optional(),
});
const creditsSchema = z.object({ cast: z.array(castSchema).default([]), crew: z.array(crewSchema).default([]) });

const providerSchema = z.object({ provider_id: z.number(), provider_name: text, logo_path: path });
const providerList = z.array(providerSchema).optional();
const regionProvidersSchema = z.object({
	link: z.string().nullish(),
	flatrate: providerList,
	free: providerList,
	ads: providerList,
	rent: providerList,
	buy: providerList,
});

const imageSchema = z.object({ file_path: z.string(), iso_639_1: z.string().nullish() });

const detailsSchema = itemSchema.extend({
	tagline: text,
	runtime: z.number().nullish(),
	episode_run_time: z.array(z.number()).optional(),
	imdb_id: z.string().nullish(),
	original_title: text,
	original_name: text,
	original_language: z.string().nullish(),
	status: z.string().nullish(),
	homepage: z.string().nullish(),
	budget: count,
	revenue: count,
	last_air_date: z.string().nullish(),
	number_of_seasons: z.number().nullish(),
	number_of_episodes: z.number().nullish(),
	next_episode_to_air: episodeRefSchema,
	last_episode_to_air: episodeRefSchema,
	seasons: z
		.array(
			z.object({
				season_number: z.number(),
				name: text,
				poster_path: path,
				air_date: z.string().nullish(),
				episode_count: count,
			}),
		)
		.optional(),
	spoken_languages: z.array(z.object({ iso_639_1: z.string() })).optional(),
	networks: z.array(z.object({ id: z.number(), name: text, logo_path: path })).optional(),
	production_companies: z.array(z.object({ name: text })).optional(),
	production_countries: z.array(z.object({ iso_3166_1: z.string() })).optional(),
	origin_country: z.array(z.string()).optional(),
	belongs_to_collection: z.object({ id: z.number(), name: text, poster_path: path, backdrop_path: path }).nullish(),
	created_by: z.array(personSchema).optional(),
	external_ids: z
		.object({
			imdb_id: z.string().nullish(),
			wikidata_id: z.string().nullish(),
			facebook_id: z.string().nullish(),
			instagram_id: z.string().nullish(),
			twitter_id: z.string().nullish(),
		})
		.optional(),
	content_ratings: z.object({ results: z.array(z.object({ iso_3166_1: z.string(), rating: text })) }).optional(),
	release_dates: z
		.object({
			results: z.array(z.object({ iso_3166_1: z.string(), release_dates: z.array(z.object({ certification: text })) })),
		})
		.optional(),
	credits: creditsSchema.optional(),
	aggregate_credits: creditsSchema.optional(),
	videos: z
		.object({
			results: z.array(
				z.object({ key: z.string(), name: text, site: text, type: text, official: z.boolean().optional() }),
			),
		})
		.optional(),
	images: z
		.object({
			backdrops: z.array(imageSchema).default([]),
			posters: z.array(imageSchema).default([]),
			logos: z.array(imageSchema).default([]),
		})
		.optional(),
	keywords: z
		.object({
			keywords: z.array(z.object({ id: z.number(), name: text })).optional(),
			results: z.array(z.object({ id: z.number(), name: text })).optional(),
		})
		.optional(),
	alternative_titles: z
		.object({
			titles: z.array(z.object({ iso_3166_1: z.string(), title: text })).optional(),
			results: z.array(z.object({ iso_3166_1: z.string(), title: text })).optional(),
		})
		.optional(),
	"watch/providers": z.object({ results: z.record(z.string(), regionProvidersSchema) }).optional(),
	recommendations: listSchema.optional(),
	similar: listSchema.optional(),
	reviews: z
		.object({
			results: z.array(
				z.object({
					id: z.string(),
					author: text,
					author_details: z.object({ rating: z.number().nullish() }).optional(),
					content: text,
					created_at: text,
					url: text,
				}),
			),
		})
		.optional(),
});

export const parse = <S extends z.ZodType>(schema: S, raw: unknown, what: string): z.output<S> => {
	const result = schema.safeParse(raw);
	if (!result.success) throw new AppError("UPSTREAM_UNAVAILABLE", `TMDB: unexpected ${what}`, { cause: result.error });
	return result.data;
};

export const yearOf = (date: string | null | undefined) => {
	const year = Number(date?.slice(0, 4));
	return year > 0 ? year : null;
};

/** TMDB sends "" for an unknown date. */
export const dateOf = (date: string | null | undefined) => (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null);

const toSummary = (media: PardaMedia, item: z.output<typeof itemSchema>): TitleSummary => {
	const title = media === "movie" ? item.title : item.name;
	return {
		media,
		id: item.id,
		slug: titleSlug(title),
		title,
		overview: item.overview,
		year: yearOf(media === "movie" ? item.release_date : item.first_air_date),
		poster: item.poster_path ?? null,
		backdrop: item.backdrop_path ?? null,
		genres: item.genre_ids ?? item.genres?.map((genre) => genre.id) ?? [],
		rating: Math.round((item.vote_average ?? 0) * 10) / 10,
	};
};

/** What a list holds: one media type, or `mixed` (trending/all), where each item says which it is. */
export type ListMedia = PardaMedia | "mixed";

const mediaOf = (media: ListMedia, item: z.output<typeof itemSchema>): PardaMedia | null => {
	if (media !== "mixed") return media;
	return item.media_type === "movie" || item.media_type === "tv" ? item.media_type : null;
};

const summaries = (media: ListMedia, items: ReadonlyArray<z.output<typeof itemSchema>>) =>
	items.flatMap((item) => {
		const itemMedia = mediaOf(media, item);
		// People in trending/all, and adult titles where TMDB's own filter doesn't apply.
		if (!itemMedia || item.adult || item.softcore) return [];
		return [toSummary(itemMedia, item)];
	});

export const mapList = (media: ListMedia, raw: unknown): TitleList => {
	const list = parse(listSchema, raw, "list");
	return { page: list.page, totalPages: list.total_pages, results: summaries(media, list.results) };
};

type Details = z.output<typeof detailsSchema>;

const certificationOf = (details: Details, region: string) => {
	const rating = details.content_ratings?.results.find((row) => row.iso_3166_1 === region)?.rating;
	if (rating) return rating;
	const release = details.release_dates?.results.find((row) => row.iso_3166_1 === region);
	return release?.release_dates.find((date) => date.certification)?.certification ?? null;
};

/** Every country's certificate, one each. */
const ratingsOf = (details: Details) => {
	const rows = details.content_ratings
		? details.content_ratings.results.map((row) => ({ country: row.iso_3166_1, rating: row.rating }))
		: (details.release_dates?.results ?? []).map((row) => ({
				country: row.iso_3166_1,
				rating: row.release_dates.find((date) => date.certification)?.certification ?? "",
			}));
	return rows.filter((row) => row.rating.trim() !== "");
};

const episodeRef = (ref: z.output<typeof episodeRefSchema>): EpisodeRef | null =>
	ref
		? { season: ref.season_number, episode: ref.episode_number, name: ref.name, airDate: dateOf(ref.air_date) }
		: null;

/** A cast list as a page shows it: a series' parts are its characters, with the episodes they're in. */
export const castOf = (cast: ReadonlyArray<z.output<typeof castSchema>>): CreditPerson[] =>
	cast.map((person) => {
		const roles = person.roles?.map((role) => role.character).filter(Boolean);
		return {
			id: person.id,
			name: person.name,
			profile: person.profile_path ?? null,
			role: roles ? roles.join(" / ") : person.character,
			...(person.total_episode_count === undefined ? {} : { episodes: person.total_episode_count }),
		};
	});

/** A crew list's people, each once, with every job they had. */
export const crewOf = (
	crew: ReadonlyArray<z.output<typeof crewSchema>>,
): Array<CreditPerson & { jobs: string[]; department: string }> => {
	const byPerson = new Map<string, CreditPerson & { jobs: string[]; department: string }>();
	for (const person of crew) {
		const jobs = person.jobs?.map((job) => job.job).filter(Boolean) ?? (person.job ? [person.job] : []);
		const key = `${person.department}:${person.id}`;
		const known = byPerson.get(key);
		if (known) {
			known.jobs.push(...jobs.filter((job) => !known.jobs.includes(job)));
			known.role = known.jobs.join(", ");
			continue;
		}
		byPerson.set(key, {
			id: person.id,
			name: person.name,
			profile: person.profile_path ?? null,
			role: jobs.join(", "),
			jobs,
			department: person.department,
			...(person.total_episode_count === undefined ? {} : { episodes: person.total_episode_count }),
		});
	}
	return [...byPerson.values()];
};

const KEY_JOB_ORDER = new Map<string, number>(KEY_JOBS.map((job, index) => [job, index]));

/** Key crew: a series' creators first, then the people in KEY_JOBS, in that order. */
const keyCrewOf = (details: Details): KeyCrewMember[] => {
	const people = new Map<number, KeyCrewMember & { rank: number }>();
	for (const creator of details.created_by ?? []) {
		people.set(creator.id, {
			id: creator.id,
			name: creator.name,
			jobs: ["Creator"],
			rank: KEY_JOB_ORDER.get("Creator") ?? 0,
		});
	}
	const credits = details.credits?.crew.length ? details.credits.crew : (details.aggregate_credits?.crew ?? []);
	for (const person of credits) {
		const jobs = (person.jobs?.map((job) => job.job) ?? [person.job]).filter((job) => KEY_JOB_ORDER.has(job));
		if (jobs.length === 0) continue;
		const rank = Math.min(...jobs.map((job) => KEY_JOB_ORDER.get(job) ?? 99));
		const known = people.get(person.id);
		if (known) {
			known.jobs.push(...jobs.filter((job) => !known.jobs.includes(job)));
			known.rank = Math.min(known.rank, rank);
		} else people.set(person.id, { id: person.id, name: person.name, jobs, rank });
	}
	// Producers are many on a series: they come last, and the list stops at LIMITS.crew.
	return [...people.values()]
		.sort((a, b) => a.rank - b.rank)
		.slice(0, LIMITS.crew)
		.map(({ rank: _rank, ...member }) => member);
};

const VIDEO_ORDER = ["Trailer", "Teaser", "Clip", "Featurette", "Behind the Scenes", "Opening Credits", "Bloopers"];

/** YouTube's videos only (the one embed the CSP allows), official trailers first. */
const videosOf = (details: Details): TitleVideo[] =>
	(details.videos?.results ?? [])
		.filter((video) => video.site === "YouTube" && /^[\w-]{6,20}$/.test(video.key))
		.map((video, index) => ({ video, index }))
		.sort((a, b) => {
			const order = (type: string) => (VIDEO_ORDER.includes(type) ? VIDEO_ORDER.indexOf(type) : VIDEO_ORDER.length);
			return (
				order(a.video.type) - order(b.video.type) ||
				Number(b.video.official ?? false) - Number(a.video.official ?? false) ||
				a.index - b.index
			);
		})
		.slice(0, LIMITS.videos)
		.map(({ video }) => ({ key: video.key, name: video.name, type: video.type }));

const providers = (list: z.output<typeof providerList>): Provider[] =>
	(list ?? []).map((row) => ({ id: row.provider_id, name: row.provider_name, logo: row.logo_path ?? null }));

const providersOf = (details: Details, region: string): WatchProviders | null => {
	const row = details["watch/providers"]?.results[region];
	if (!row) return null;
	const kinds: Record<ProviderKind, Provider[]> = {
		stream: providers(row.flatrate),
		free: providers(row.free),
		ads: providers(row.ads),
		rent: providers(row.rent),
		buy: providers(row.buy),
	};
	return Object.values(kinds).some((list) => list.length) ? { link: row.link ?? null, ...kinds } : null;
};

const reviewsOf = (details: Details): TitleReview[] =>
	(details.reviews?.results ?? []).slice(0, LIMITS.reviews).map((review) => ({
		id: review.id,
		author: review.author,
		rating: review.author_details?.rating ?? null,
		content: review.content.length > REVIEW_MAX ? review.content.slice(0, REVIEW_MAX).trimEnd() : review.content,
		cut: review.content.length > REVIEW_MAX,
		date: review.created_at.slice(0, 10),
		url: review.url,
	}));

/** Links out, as full URLs, only the https ones TMDB's ids make. */
export const linksOf = (
	ids:
		| {
				imdb_id?: string | null | undefined;
				wikidata_id?: string | null | undefined;
				facebook_id?: string | null | undefined;
				instagram_id?: string | null | undefined;
				twitter_id?: string | null | undefined;
		  }
		| undefined,
	homepage: string | null | undefined,
	imdbKind: "title" | "name",
): ExternalLinks => {
	const handle = (value: string | null | undefined) => (value && /^[\w.-]{1,100}$/.test(value) ? value : null);
	const imdb = handle(ids?.imdb_id);
	const wikidata = handle(ids?.wikidata_id);
	const facebook = handle(ids?.facebook_id);
	const instagram = handle(ids?.instagram_id);
	const twitter = handle(ids?.twitter_id);
	return {
		imdb: imdb ? `https://www.imdb.com/${imdbKind}/${imdb}/` : null,
		wikidata: wikidata ? `https://www.wikidata.org/wiki/${wikidata}` : null,
		facebook: facebook ? `https://www.facebook.com/${facebook}` : null,
		instagram: instagram ? `https://www.instagram.com/${instagram}/` : null,
		twitter: twitter ? `https://x.com/${twitter}` : null,
		homepage: homepage && /^https?:\/\//.test(homepage) ? homepage : null,
	};
};

const pickLogo = (logos: ReadonlyArray<z.output<typeof imageSchema>>) =>
	(logos.find((logo) => logo.iso_639_1 === "en") ?? logos[0])?.file_path ?? null;

export const mapDetails = (media: PardaMedia, raw: unknown, region: string): TitleDetails => {
	const details = parse(detailsSchema, raw, "details");
	const imdbId = details.imdb_id ?? details.external_ids?.imdb_id ?? null;
	const credits =
		media === "tv" && details.aggregate_credits?.cast.length ? details.aggregate_credits : details.credits;
	return {
		...toSummary(media, details),
		tagline: details.tagline,
		runtime: details.runtime ?? details.episode_run_time?.[0] ?? null,
		imdbId,
		certification: certificationOf(details, region),
		seasons: details.number_of_seasons ?? null,
		originalTitle: media === "movie" ? details.original_title : details.original_name,
		originalLanguage: details.original_language ?? null,
		logo: pickLogo(details.images?.logos ?? []),
		votes: details.vote_count,
		status: details.status ?? null,
		releaseDate: dateOf(media === "movie" ? details.release_date : details.first_air_date),
		lastAirDate: dateOf(details.last_air_date),
		episodes: details.number_of_episodes ?? null,
		next: episodeRef(details.next_episode_to_air),
		latest: episodeRef(details.last_episode_to_air),
		// Specials (season 0) last, as the page lists them.
		seasonList: (details.seasons ?? [])
			.map((season) => ({
				number: season.season_number,
				name: season.name,
				poster: season.poster_path ?? null,
				year: yearOf(season.air_date),
				episodes: season.episode_count,
			}))
			.sort((a, b) => (a.number === 0 ? 1 : b.number === 0 ? -1 : a.number - b.number)),
		spokenLanguages: (details.spoken_languages ?? []).map((language) => language.iso_639_1),
		networks: (details.networks ?? []).map((network) => ({
			id: network.id,
			name: network.name,
			logo: network.logo_path ?? null,
		})),
		companies: (details.production_companies ?? []).map((company) => company.name).filter(Boolean),
		countries: details.production_countries?.map((country) => country.iso_3166_1) ?? details.origin_country ?? [],
		budget: details.budget,
		revenue: details.revenue,
		ratings: ratingsOf(details),
		alternativeTitles: (details.alternative_titles?.titles ?? details.alternative_titles?.results ?? [])
			.filter((row) => row.title.trim() !== "")
			.slice(0, LIMITS.alternative)
			.map((row) => ({ country: row.iso_3166_1, title: row.title })),
		keywords: (details.keywords?.keywords ?? details.keywords?.results ?? []).slice(0, LIMITS.keywords),
		links: linksOf({ ...details.external_ids, imdb_id: imdbId }, details.homepage, "title"),
		collection: details.belongs_to_collection
			? {
					id: details.belongs_to_collection.id,
					name: details.belongs_to_collection.name,
					backdrop: details.belongs_to_collection.backdrop_path ?? null,
					poster: details.belongs_to_collection.poster_path ?? null,
				}
			: null,
		cast: castOf(credits?.cast ?? []).slice(0, LIMITS.cast),
		crew: keyCrewOf(details),
		videos: videosOf(details),
		gallery: {
			backdrops: (details.images?.backdrops ?? []).slice(0, LIMITS.gallery).map((image) => image.file_path),
			posters: (details.images?.posters ?? []).slice(0, LIMITS.gallery).map((image) => image.file_path),
		},
		providers: providersOf(details, region),
		recommendations: summaries(media, details.recommendations?.results ?? []).slice(0, LIMITS.titles),
		similar: summaries(media, details.similar?.results ?? []).slice(0, LIMITS.titles),
		reviews: reviewsOf(details),
	};
};

const DEVANAGARI = /\p{Script=Devanagari}/u;

/**
 * A name from TMDB's Nepali answer, or the English one. Without a Nepali translation TMDB
 * answers a title in its original language (モブサイコ100, Socias por accidente), not blank,
 * so a name counts as Nepali only when it's written in Devanagari (decision 0244).
 */
export const nepaliName = (nepali: string, english: string) => {
	const value = nepali.trim();
	return value && (DEVANAGARI.test(value) || !english.trim()) ? value : english;
};

/** Blank Nepali text filled in from English: TMDB has almost none (PLAN 12.4). The slug is always English's. */
export const fillIn = <T extends TitleSummary>(nepali: T, english: T): T => ({
	...nepali,
	slug: english.slug,
	title: nepaliName(nepali.title, english.title),
	overview: nepali.overview.trim() || english.overview,
});

const fillInTitles = (nepali: TitleSummary[], english: TitleSummary[]) => {
	// Keyed by media type too: a mixed list (trending/all) can hold a movie and a series with one id.
	const byKey = new Map(english.map((item) => [`${item.media}:${item.id}`, item]));
	return nepali.map((item) => {
		const fallback = byKey.get(`${item.media}:${item.id}`);
		return fallback ? fillIn(item, fallback) : item;
	});
};

export const fillInList = (nepali: TitleList, english: TitleList): TitleList => ({
	...nepali,
	results: fillInTitles(nepali.results, english.results),
});

const fillInRef = (nepali: EpisodeRef | null, english: EpisodeRef | null) =>
	nepali && english ? { ...nepali, name: nepali.name.trim() || english.name } : nepali;

/**
 * A title's Nepali details with English where TMDB has nothing: names, overview, the
 * season names, videos and reviews (TMDB filters both by language, and has almost no
 * Nepali ones). Never the tagline: the subtitle line is simply absent then.
 */
export const fillInDetails = (nepali: TitleDetails, english: TitleDetails): TitleDetails => {
	const seasons = new Map(english.seasonList.map((season) => [season.number, season]));
	return {
		...fillIn(nepali, english),
		next: fillInRef(nepali.next, english.next),
		latest: fillInRef(nepali.latest, english.latest),
		seasonList: nepali.seasonList.map((season) => ({
			...season,
			name: season.name.trim() || seasons.get(season.number)?.name || season.name,
		})),
		collection:
			nepali.collection && english.collection
				? { ...nepali.collection, name: nepali.collection.name.trim() || english.collection.name }
				: nepali.collection,
		videos: nepali.videos.length ? nepali.videos : english.videos,
		reviews: nepali.reviews.length ? nepali.reviews : english.reviews,
		recommendations: fillInTitles(nepali.recommendations, english.recommendations),
		similar: fillInTitles(nepali.similar, english.similar),
	};
};

export { castSchema, creditsSchema, crewSchema, itemSchema, personSchema, summaries };
