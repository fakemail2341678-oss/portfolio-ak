import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { CreditPerson, ExternalLinks } from "@/features/parda/title/types";
import type { PardaMedia } from "@/server/db/schema";
import {
	castOf,
	castSchema,
	creditsSchema,
	crewOf,
	crewSchema,
	dateOf,
	fillIn,
	itemSchema,
	linksOf,
	nepaliName,
	parse,
	summaries,
	type TitleSummary,
} from "./mappers";

/**
 * The answers behind a title's other pages (PLAN Task 63, decision 0235): a season's
 * episodes, the full credits, a person and a collection, each with its Nepali fill-in.
 */

const text = z
	.string()
	.nullish()
	.transform((value) => value ?? "");

// --- A season --------------------------------------------------------------

export type SeasonDetails = {
	number: number;
	name: string;
	overview: string;
	episodes: Array<{
		number: number;
		name: string;
		overview: string;
		still: string | null;
		runtime: number | null;
		airDate: string | null;
		rating: number;
		guests: CreditPerson[];
		directors: Array<{ id: number; name: string }>;
		writers: Array<{ id: number; name: string }>;
	}>;
};

/** Guest stars kept per episode: the sheet shows a few. */
const GUESTS = 8;

const seasonSchema = z.object({
	season_number: z.number(),
	name: text,
	overview: text,
	episodes: z
		.array(
			z.object({
				episode_number: z.number(),
				name: text,
				overview: text,
				still_path: z.string().nullish(),
				runtime: z.number().nullish(),
				air_date: z.string().nullish(),
				vote_average: z.number().nullish(),
				guest_stars: z.array(castSchema).default([]),
				crew: z.array(crewSchema).default([]),
			}),
		)
		.default([]),
});

export const mapSeason = (raw: unknown): SeasonDetails => {
	const season = parse(seasonSchema, raw, "season");
	const people = (crew: ReadonlyArray<z.output<typeof crewSchema>>, job: string) =>
		crew.filter((person) => person.job === job).map((person) => ({ id: person.id, name: person.name }));
	return {
		number: season.season_number,
		name: season.name,
		overview: season.overview,
		episodes: season.episodes.map((episode) => ({
			number: episode.episode_number,
			name: episode.name,
			overview: episode.overview,
			still: episode.still_path ?? null,
			runtime: episode.runtime ?? null,
			airDate: dateOf(episode.air_date),
			rating: Math.round((episode.vote_average ?? 0) * 10) / 10,
			guests: castOf(episode.guest_stars).slice(0, GUESTS),
			directors: people(episode.crew, "Director"),
			writers: people(episode.crew, "Writer"),
		})),
	};
};

/** TMDB names an episode it has no Nepali name for "एपिसोड 3" or leaves it blank: the English one is better then. */
const PLACEHOLDER_NAME = /^(episode|एपिसोड|भाग)\s*[\d०-९]+$/i;

export const fillInSeason = (nepali: SeasonDetails, english: SeasonDetails): SeasonDetails => {
	const byNumber = new Map(english.episodes.map((episode) => [episode.number, episode]));
	return {
		...nepali,
		name: nepali.name.trim() || english.name,
		overview: nepali.overview.trim() || english.overview,
		episodes: nepali.episodes.map((episode) => {
			const fallback = byNumber.get(episode.number);
			if (!fallback) return episode;
			const name = episode.name.trim();
			return {
				...episode,
				name: !name || (PLACEHOLDER_NAME.test(name) && !PLACEHOLDER_NAME.test(fallback.name)) ? fallback.name : name,
				overview: episode.overview.trim() || fallback.overview,
			};
		}),
	};
};

// --- Full credits ----------------------------------------------------------

export type TitleCredits = { cast: CreditPerson[]; crew: Array<{ department: string; people: CreditPerson[] }> };

export const mapCredits = (raw: unknown): TitleCredits => {
	const credits = parse(creditsSchema, raw, "credits");
	const departments = new Map<string, CreditPerson[]>();
	for (const { jobs: _jobs, department, ...person } of crewOf(credits.crew)) {
		const list = departments.get(department) ?? [];
		list.push(person);
		departments.set(department, list);
	}
	return {
		cast: castOf(credits.cast),
		// The biggest departments first; Directing and Writing lead, as credits do.
		crew: [...departments.entries()]
			.map(([department, people]) => ({ department, people }))
			.sort((a, b) => leads(a.department) - leads(b.department) || b.people.length - a.people.length),
	};
};

const LEADING = ["Directing", "Writing", "Production", "Creator"];
const leads = (department: string) => (LEADING.includes(department) ? LEADING.indexOf(department) : LEADING.length);

// --- A person --------------------------------------------------------------

export type PersonCredit = TitleSummary & {
	department: string;
	role: string;
	date: string | null;
	votes: number;
	episodes?: number;
	/** Talk shows and news: they stay in the filmography, never in "Known for". */
	appearance: boolean;
};

export type PersonDetails = {
	id: number;
	name: string;
	biography: string;
	profile: string | null;
	knownFor: string | null;
	birthday: string | null;
	deathday: string | null;
	placeOfBirth: string | null;
	links: ExternalLinks;
	credits: PersonCredit[];
};

/** TMDB's Talk and News genres. */
const APPEARANCE_GENRES = new Set([10767, 10763]);

const personCreditSchema = itemSchema.extend({
	character: text,
	job: text,
	department: text,
	episode_count: z.number().optional(),
});

const personDetailsSchema = z.object({
	id: z.number(),
	name: text,
	biography: text,
	profile_path: z.string().nullish(),
	known_for_department: z.string().nullish(),
	birthday: z.string().nullish(),
	deathday: z.string().nullish(),
	place_of_birth: z.string().nullish(),
	homepage: z.string().nullish(),
	external_ids: z
		.object({
			imdb_id: z.string().nullish(),
			wikidata_id: z.string().nullish(),
			facebook_id: z.string().nullish(),
			instagram_id: z.string().nullish(),
			twitter_id: z.string().nullish(),
		})
		.optional(),
	combined_credits: z
		.object({ cast: z.array(personCreditSchema).default([]), crew: z.array(personCreditSchema).default([]) })
		.optional(),
});

const creditOf = (item: z.output<typeof personCreditSchema>, department: string, role: string): PersonCredit | null => {
	const [summary] = summaries("mixed", [item]);
	if (!summary) return null;
	const media: PardaMedia = summary.media;
	return {
		...summary,
		department,
		role,
		date: dateOf(media === "movie" ? item.release_date : item.first_air_date),
		votes: item.vote_count,
		...(item.episode_count === undefined ? {} : { episodes: item.episode_count }),
		appearance: (item.genre_ids ?? []).some((genre) => APPEARANCE_GENRES.has(genre)),
	};
};

export const mapPerson = (raw: unknown): PersonDetails => {
	const person = parse(personDetailsSchema, raw, "person");
	const cast = person.combined_credits?.cast ?? [];
	const crew = person.combined_credits?.crew ?? [];
	return {
		id: person.id,
		name: person.name,
		biography: person.biography,
		profile: person.profile_path ?? null,
		knownFor: person.known_for_department ?? null,
		birthday: dateOf(person.birthday),
		deathday: dateOf(person.deathday),
		placeOfBirth: person.place_of_birth ?? null,
		links: linksOf(person.external_ids, person.homepage, "name"),
		credits: [
			...cast.map((item) => creditOf(item, "Acting", item.character)),
			...crew.map((item) => creditOf(item, item.department || "Crew", item.job)),
		].filter((credit) => credit !== null),
	};
};

export const fillInPerson = (nepali: PersonDetails, english: PersonDetails): PersonDetails => {
	const byKey = new Map(english.credits.map((credit) => [`${credit.media}:${credit.id}`, credit]));
	return {
		...nepali,
		name: nepali.name.trim() || english.name,
		biography: nepali.biography.trim() || english.biography,
		credits: nepali.credits.map((credit) => {
			const fallback = byKey.get(`${credit.media}:${credit.id}`);
			return fallback ? fillIn(credit, fallback) : credit;
		}),
	};
};

// --- A collection ----------------------------------------------------------

export type CollectionDetails = {
	id: number;
	name: string;
	overview: string;
	poster: string | null;
	backdrop: string | null;
	parts: Array<TitleSummary & { date: string | null }>;
};

const collectionSchema = z.object({
	id: z.number(),
	name: text,
	overview: text,
	poster_path: z.string().nullish(),
	backdrop_path: z.string().nullish(),
	parts: z.array(itemSchema).default([]),
});

export const mapCollection = (raw: unknown): CollectionDetails => {
	const collection = parse(collectionSchema, raw, "collection");
	const dates = new Map(collection.parts.map((part) => [part.id, dateOf(part.release_date)]));
	return {
		id: collection.id,
		name: collection.name,
		overview: collection.overview,
		poster: collection.poster_path ?? null,
		backdrop: collection.backdrop_path ?? null,
		parts: summaries("movie", collection.parts)
			.map((part) => ({ ...part, date: dates.get(part.id) ?? null }))
			// In release order; an unreleased part (no date) last.
			.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
	};
};

export const fillInCollection = (nepali: CollectionDetails, english: CollectionDetails): CollectionDetails => {
	const byId = new Map(english.parts.map((part) => [part.id, part]));
	return {
		...nepali,
		name: nepaliName(nepali.name, english.name),
		overview: nepali.overview.trim() || english.overview,
		parts: nepali.parts.map((part) => {
			const fallback = byId.get(part.id);
			return fallback ? fillIn(part, fallback) : part;
		}),
	};
};
