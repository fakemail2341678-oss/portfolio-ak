#!/usr/bin/env node
/**
 * pnpm tmdb:record: writes tests/fixtures/tmdb/ from TMDB's real answers (decisions 0229,
 * 0234 and 0235), with TMDB_READ_TOKEN from .env. Tests and the e2e stand-in read these
 * files, and neither ever calls TMDB. It records:
 * - every rail of the home and the hubs (src/server/parda/catalog/rails.ts, the same
 *   requests the pages make), and the details of each billboard's titles;
 * - for each of those titles, its full credits and, for a series, its first season;
 * - the popular lists and the first title of each, which the catalogue tests use;
 * - the first actor of the review's title and of each popular first, and the collection
 *   of every recorded movie that belongs to one (person and collection pages);
 * - search and Discover (Task 66): each sample query in every tab, each sample of
 *   Discover's filters, and the popular movie's first keyword with its Discover page;
 * - a kids' profile's home (Task 67, decision 0240): each rail TMDB can filter by
 *   certificate, asked with the admin's default cap. `--kids` records only these, beside
 *   the files already there.
 *
 * Files are named by `fixtureName` (e2e/harness/tmdb.ts). Tests pick their ids from the
 * recorded lists, so recording again changes no test.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixtureName } from "../e2e/harness/tmdb.ts";
import {
	DISCOVER_SAMPLES,
	discoverFilters,
	discoverRequest,
	SEARCH_SAMPLES,
} from "../src/server/parda/catalog/discover-requests.ts";
import { cappedRequest } from "../src/server/parda/catalog/kids-requests.ts";
import { BILLBOARD_SIZE, PAGE_LAYOUTS, railContext } from "../src/server/parda/catalog/rails.ts";
import {
	creditsPath,
	DETAILS_PARAMS,
	KEY_JOBS,
	PERSON_PARAMS,
	seasonPath,
} from "../src/server/parda/catalog/requests.ts";

process.loadEnvFile?.(".env");
const token = process.env.TMDB_READ_TOKEN;
if (!token) {
	console.error("record-tmdb-fixtures: set TMDB_READ_TOKEN in .env first.");
	process.exit(1);
}

const API = process.env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
const OUT = path.resolve(import.meta.dirname, "../tests/fixtures/tmdb");
const LANGUAGES = ["en-US", "ne-NP"];

type Item = {
	id: number;
	media_type?: string;
	backdrop_path?: string | null;
	adult?: boolean;
	softcore?: boolean;
};
type Answer = Record<string, unknown> & { results?: Item[] };
type Params = Record<string, string | number>;

const get = async (pathname: string, params: Params) => {
	const url = new URL(`${API}/${pathname}`);
	for (const [key, value] of Object.entries({ ...params, include_adult: "false" }))
		url.searchParams.set(key, String(value));
	const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
	if (!response.ok) throw new Error(`${pathname}: ${response.status}`);
	return (await response.json()) as Answer;
};

/** How many entries of the long lists are kept: pages read the first few, and the repo stays small. */
const KEEP = {
	cast: 20,
	crew: 12,
	images: 6,
	videos: 6,
	titles: 8,
	reviews: 3,
	alternative: 8,
	keywords: 12,
	/** The credits page and a person's filmography. */
	fullCast: 40,
	fullCrew: 40,
	/** Per episode in a season. */
	guests: 6,
	/** Per season: two of the page's pages. */
	episodes: 60,
} as const;
/** The certificate and provider regions kept: the admin's default (US), and neighbours a region may fall back to. */
const REGIONS = new Set(["US", "IN", "GB"]);
const KEY_JOB_SET = new Set<string>(KEY_JOBS);

type Person = { job?: string; jobs?: Array<{ job?: string }> };
type List = { results?: unknown[] };
type Details = Record<string, unknown> & {
	credits?: { cast?: unknown[]; crew?: Person[] };
	aggregate_credits?: { cast?: unknown[]; crew?: Person[] };
	images?: Record<string, unknown[] | undefined>;
	videos?: List;
	recommendations?: List;
	similar?: List;
	reviews?: { results?: Array<{ content?: string }> };
	keywords?: { keywords?: unknown[]; results?: unknown[] };
	alternative_titles?: { titles?: unknown[]; results?: unknown[] };
	release_dates?: { results?: Array<{ iso_3166_1: string }> };
	content_ratings?: { results?: Array<{ iso_3166_1: string }> };
	"watch/providers"?: { results?: Record<string, unknown> };
};

const isTrailer = (video: unknown) => /^(Trailer|Teaser)$/.test((video as { type?: string }).type ?? "");

const isKeyCrew = (person: Person) =>
	KEY_JOB_SET.has(person.job ?? "") || (person.jobs ?? []).some((job) => KEY_JOB_SET.has(job.job ?? ""));

/** Key crew first, so a cut list still names the director. */
const crewOf = (crew: Person[] | undefined, keep: number) =>
	crew && [...crew.filter(isKeyCrew), ...crew.filter((person) => !isKeyCrew(person))].slice(0, keep);

const credits = (list: { cast?: unknown[]; crew?: Person[] } | undefined, cast: number, crew: number) =>
	list && { ...list, cast: list.cast?.slice(0, cast), crew: crewOf(list.crew, crew) };

const cutList = <T extends List>(list: T | undefined, keep: number) =>
	list && { ...list, results: list.results?.slice(0, keep) };

const inRegions = <T extends { results?: Array<{ iso_3166_1: string }> }>(list: T | undefined) =>
	list && { results: list.results?.filter((row) => REGIONS.has(row.iso_3166_1)) };

/** A details answer with its long lists cut (decision 0234); every field a mapper reads is kept. */
const trimDetails = (details: Details): Details => ({
	...details,
	credits: credits(details.credits, KEEP.cast, KEEP.crew),
	aggregate_credits: credits(details.aggregate_credits, KEEP.cast, KEEP.crew),
	...(details.images && {
		images: Object.fromEntries(
			Object.entries(details.images).map(([kind, list]) => [kind, list?.slice(0, KEEP.images)]),
		),
	}),
	// Trailers and teasers first, so a cut list still has what the Trailer button opens.
	videos: details.videos && {
		results: [...(details.videos.results ?? [])]
			.sort((a, b) => Number(isTrailer(b)) - Number(isTrailer(a)))
			.slice(0, KEEP.videos),
	},
	recommendations: cutList(details.recommendations, KEEP.titles),
	similar: cutList(details.similar, KEEP.titles),
	reviews: details.reviews && {
		...details.reviews,
		results: details.reviews.results
			?.slice(0, KEEP.reviews)
			.map((review) => ({ ...review, content: review.content?.slice(0, 1600) })),
	},
	keywords: details.keywords && {
		...(details.keywords.keywords && { keywords: details.keywords.keywords.slice(0, KEEP.keywords) }),
		...(details.keywords.results && { results: details.keywords.results.slice(0, KEEP.keywords) }),
	},
	alternative_titles: details.alternative_titles && {
		...(details.alternative_titles.titles && { titles: details.alternative_titles.titles.slice(0, KEEP.alternative) }),
		...(details.alternative_titles.results && {
			results: details.alternative_titles.results.slice(0, KEEP.alternative),
		}),
	},
	release_dates: inRegions(details.release_dates),
	content_ratings: inRegions(details.content_ratings),
	...(details["watch/providers"] && {
		"watch/providers": {
			results: Object.fromEntries(
				Object.entries(details["watch/providers"].results ?? {}).filter(([region]) => REGIONS.has(region)),
			),
		},
	}),
});

type Season = { episodes?: Array<Record<string, unknown> & { crew?: Person[]; guest_stars?: unknown[] }> };
const trimSeason = (season: Season): Season => ({
	...season,
	// Long-running series hold over a thousand episodes in one season: the page shows them a page at a time.
	episodes: season.episodes?.slice(0, KEEP.episodes).map((episode) => ({
		...episode,
		crew: episode.crew?.filter((person) => person.job === "Director" || person.job === "Writer"),
		guest_stars: episode.guest_stars?.slice(0, KEEP.guests),
	})),
});

type PersonAnswer = Record<string, unknown> & { combined_credits?: { cast?: unknown[]; crew?: unknown[] } };
const byVotes = (list: unknown[] | undefined) =>
	list &&
	[...list].sort(
		(a, b) => ((b as { vote_count?: number }).vote_count ?? 0) - ((a as { vote_count?: number }).vote_count ?? 0),
	);
const trimPerson = (person: PersonAnswer): PersonAnswer => ({
	...person,
	...(person.combined_credits && {
		combined_credits: {
			cast: byVotes(person.combined_credits.cast)?.slice(0, KEEP.fullCast),
			crew: byVotes(person.combined_credits.crew)?.slice(0, KEEP.fullCrew),
		},
	}),
});

const TRIMS: ReadonlyArray<[RegExp, (answer: Answer) => Answer]> = [
	[/^(movie|tv)\/\d+$/, (answer) => trimDetails(answer as Details)],
	[
		/\/(credits|aggregate_credits)$/,
		(answer) => credits(answer as Details["credits"], KEEP.fullCast, KEEP.fullCrew) as Answer,
	],
	[/\/season\/\d+$/, (answer) => trimSeason(answer as Season) as Answer],
	[/^person\/\d+$/, (answer) => trimPerson(answer as PersonAnswer)],
];

const recorded = new Map<string, Answer>();
const record = async (pathname: string, params: Params = {}): Promise<Answer> => {
	const entries = Object.entries(params).map(([key, value]): [string, string] => [key, String(value)]);
	const known = recorded.get(fixtureName(pathname, entries, "any"));
	if (known) return known;
	const answers = await Promise.all(LANGUAGES.map((language) => get(pathname, { ...params, language })));
	const trim = TRIMS.find(([pattern]) => pattern.test(pathname))?.[1] ?? ((answer: Answer) => answer);
	for (const [index, answer] of answers.entries()) {
		const language = LANGUAGES[index] ?? "en-US";
		// One line per file: these are read by code, and indentation was a third of their size.
		writeFileSync(path.join(OUT, fixtureName(pathname, entries, language)), `${JSON.stringify(trim(answer))}\n`);
	}
	const english = answers[0] ?? {};
	recorded.set(fixtureName(pathname, entries, "any"), english);
	return english;
};

type RecordedDetails = {
	belongs_to_collection?: { id: number } | null;
	seasons?: Array<{ season_number: number }>;
	credits?: { cast?: Array<{ id: number }> };
	aggregate_credits?: { cast?: Array<{ id: number }> };
};

/** A title's page: its details, full credits and (a series) the season it opens on, the first that isn't specials. */
const recordTitle = async (media: string, id: number) => {
	const details = (await record(`${media}/${id}`, DETAILS_PARAMS)) as RecordedDetails;
	await record(creditsPath(media === "movie" ? "movie" : "tv", id));
	const first = details.seasons?.map((season) => season.season_number).find((number) => number > 0);
	if (media === "tv" && first !== undefined) await record(seasonPath(id, first));
	return details;
};

const recordFirstActor = async (details: RecordedDetails) => {
	const actor = (details.credits?.cast ?? details.aggregate_credits?.cast)?.[0];
	if (actor) await record(`person/${actor.id}`, PERSON_PARAMS);
};

/** A list's titles as the mapper keeps them (catalog/mappers.ts): movies and series, nothing adult. */
const titlesOf = (answer: Answer, media: string) =>
	(answer.results ?? []).flatMap((item) => {
		const itemMedia = media === "mixed" ? item.media_type : media;
		if ((itemMedia !== "movie" && itemMedia !== "tv") || item.adult || item.softcore) return [];
		return [{ ...item, media: itemMedia }];
	});

/** The cap a new install's kids' profiles browse under (`pd_settings.kids_cap`'s default). */
const KIDS_CAP = "PG";
const recordKids = async () => {
	for (const spec of PAGE_LAYOUTS.home.rails) {
		const capped = cappedRequest(spec.request(railContext("US")), KIDS_CAP);
		if (capped) await record(capped.path, { page: 1, ...capped.params });
	}
};

mkdirSync(OUT, { recursive: true });
if (process.argv.includes("--kids")) {
	await recordKids();
	console.log("record-tmdb-fixtures: recorded the kids' home rails");
	process.exit(0);
}
for (const file of readdirSync(OUT)) rmSync(path.join(OUT, file));

const collections = new Set<number>();
const remember = (details: RecordedDetails) => {
	if (details.belongs_to_collection) collections.add(details.belongs_to_collection.id);
	return details;
};

const context = railContext("US");
for (const [page, layout] of Object.entries(PAGE_LAYOUTS)) {
	for (const spec of layout.rails) {
		const request = spec.request(context);
		const answer = await record(request.path, { page: 1, ...request.params });
		if (spec.id !== layout.billboardFrom) continue;
		const picks = titlesOf(answer, request.media)
			.filter((item) => item.backdrop_path)
			// Two spare: a takedown of a billboard title brings in the next, and a Nepali answer can lack a
			// backdrop the English one has (tests/server/parda-catalog.test.ts).
			.slice(0, BILLBOARD_SIZE + 2);
		for (const [index, pick] of picks.entries()) {
			const details = remember(await recordTitle(pick.media, pick.id));
			// The e2e review opens the home billboard's first title, and its first actor's page.
			if (page === "home" && index === 0) await recordFirstActor(details);
		}
	}
}

for (const media of ["movie", "tv"]) {
	const popular = await record(`${media}/popular`, { page: 1 });
	const first = popular.results?.[0];
	if (!first) throw new Error(`${media}/popular returned nothing`);
	await recordFirstActor(remember(await recordTitle(media, first.id)));
}
for (const id of collections) await record(`collection/${id}`);

const today = new Date().toISOString().slice(0, 10);
const discover = async (filters: Parameters<typeof discoverFilters>[0]) => {
	const request = discoverRequest(discoverFilters(filters), today);
	await record(request.path, request.params);
};
for (const sample of DISCOVER_SAMPLES) await discover(sample);
for (const kind of ["multi", "movie", "tv", "person"])
	await record(`search/${kind}`, { query: SEARCH_SAMPLES.found, page: 1 });
await record("search/multi", { query: SEARCH_SAMPLES.nothing, page: 1 });
// The flows open the first title the overlay lists.
const firstHit = titlesOf(await record("search/multi", { query: SEARCH_SAMPLES.found, page: 1 }), "mixed")[0];
if (firstHit) await recordTitle(firstHit.media, firstHit.id);
// A title page's keywords link to Discover: the popular movie's first, named and listed.
const popularMovie = (recorded.get(fixtureName("movie/popular", [["page", "1"]], "any"))?.results ?? [])[0];
const keyword = popularMovie
	? (
			recorded.get(
				fixtureName(
					`movie/${popularMovie.id}`,
					Object.entries(DETAILS_PARAMS).map(([key, value]) => [key, String(value)]),
					"any",
				),
			) as { keywords?: { keywords?: Array<{ id: number }> } } | undefined
		)?.keywords?.keywords?.[0]
	: undefined;
if (keyword) {
	await record(`keyword/${keyword.id}`);
	await discover({ keyword: keyword.id });
}
await recordKids();
console.log(`record-tmdb-fixtures: wrote ${readdirSync(OUT).length} files to tests/fixtures/tmdb`);
