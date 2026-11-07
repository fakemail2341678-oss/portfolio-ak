import "@tanstack/react-start/server-only";
import { z } from "zod";
import { fillIn, itemSchema, parse, summaries, type TitleSummary } from "./mappers";

/**
 * TMDB's search answers (Task 66, decision 0239) as lean DTOs: `search/multi` mixes
 * movies, series and people; `search/movie`, `search/tv` and `search/person` hold one.
 */

export type SearchKind = "multi" | "movie" | "tv" | "person";

export type PersonSummary = {
	media: "person";
	id: number;
	name: string;
	profile: string | null;
	/** TMDB's English department ("Acting"), named by the page. */
	department: string | null;
	/** The titles TMDB says they're known for, by name. */
	knownFor: Array<Pick<TitleSummary, "media" | "id" | "title">>;
};

export type SearchHit = TitleSummary | PersonSummary;
export type SearchResults = { page: number; totalPages: number; totalResults: number; hits: SearchHit[] };

const personSchema = z.object({
	id: z.number().int().positive(),
	name: z
		.string()
		.nullish()
		.transform((value) => value ?? ""),
	profile_path: z.string().nullish(),
	known_for_department: z.string().nullish(),
	known_for: z.array(itemSchema).optional(),
	adult: z.boolean().optional(),
});

const searchSchema = z.object({
	page: z.number(),
	total_pages: z.number(),
	total_results: z.number(),
	results: z.array(z.unknown()),
});

const toPerson = (person: z.output<typeof personSchema>): PersonSummary => ({
	media: "person",
	id: person.id,
	name: person.name,
	profile: person.profile_path ?? null,
	department: person.known_for_department ?? null,
	knownFor: summaries("mixed", person.known_for ?? []).map(({ media, id, title }) => ({ media, id, title })),
});

const hitOf = (kind: SearchKind, raw: unknown): SearchHit[] => {
	const type = kind === "multi" ? (raw as { media_type?: unknown } | null)?.media_type : kind;
	if (type === "person") {
		const person = personSchema.safeParse(raw);
		return person.success && !person.data.adult ? [toPerson(person.data)] : [];
	}
	if (type !== "movie" && type !== "tv") return [];
	const item = itemSchema.safeParse(raw);
	return item.success ? summaries(type, [item.data]) : [];
};

export const mapSearch = (kind: SearchKind, raw: unknown): SearchResults => {
	const answer = parse(searchSchema, raw, "search");
	return {
		page: answer.page,
		totalPages: answer.total_pages,
		totalResults: answer.total_results,
		hits: answer.results.flatMap((item) => hitOf(kind, item)),
	};
};

const hitKey = (hit: SearchHit) => `${hit.media}:${hit.id}`;

/** Nepali hits with English names and overviews where TMDB has none. */
export const fillInSearch = (nepali: SearchResults, english: SearchResults): SearchResults => {
	const byKey = new Map(english.hits.map((hit) => [hitKey(hit), hit]));
	return {
		...nepali,
		hits: nepali.hits.map((hit) => {
			const fallback = byKey.get(hitKey(hit));
			if (!fallback) return hit;
			if (hit.media === "person" || fallback.media === "person") {
				return hit.media === "person" && fallback.media === "person"
					? { ...hit, name: hit.name.trim() || fallback.name }
					: hit;
			}
			return fillIn(hit, fallback);
		}),
	};
};
