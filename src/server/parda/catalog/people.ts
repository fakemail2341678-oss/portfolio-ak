import "@tanstack/react-start/server-only";
import type { PardaHub } from "@/features/parda/search";
import type {
	CollectionPageData,
	CuratedPageData,
	FilmographyEntry,
	PersonPageData,
	SurpriseTarget,
} from "@/features/parda/title/types";
import { AppError } from "@/lib/errors";
import { localizedValue } from "@/lib/i18n/localized";
import type { PersonCredit } from "../tmdb/pages";
import { curatedTitles, toHubTitle } from "./hubs";
import { PAGE_LAYOUTS, railContext } from "./rails";
import { type CatalogScope, type CatalogServices, collectionDetails, listTitles, personDetails } from "./service";

/**
 * A person's page, a collection's page, and "Surprise me" (PLAN Task 63, decision 0235).
 * Takedowns are already gone from what the service returns.
 */

/** "Known for": a person's most-voted titles, each once, talk shows and news left out. */
const KNOWN_FOR = 12;
/** A department's filmography stops here: a prolific actor has hundreds of credits. */
const FILMOGRAPHY_MAX = 200;

const entryOf = (credit: PersonCredit): FilmographyEntry => ({
	...toHubTitle(credit),
	role: credit.role,
	date: credit.date,
	...(credit.episodes === undefined ? {} : { episodes: credit.episodes }),
});

/** Newest first, with titles not out yet (no date) at the top, as a filmography reads. */
const byDateDescending = (a: PersonCredit, b: PersonCredit) => (b.date ?? "9999").localeCompare(a.date ?? "9999");

export async function personPage(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
): Promise<Extract<PersonPageData, { configured: true }>> {
	const person = await personDetails(services, scope, id);
	const seen = new Set<string>();
	const knownFor = [...person.credits]
		.filter((credit) => !credit.appearance)
		.sort((a, b) => b.votes - a.votes)
		.filter((credit) => {
			const key = `${credit.media}:${credit.id}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, KNOWN_FOR);
	const departments = new Map<string, PersonCredit[]>();
	for (const credit of person.credits) {
		const list = departments.get(credit.department) ?? [];
		// A title is listed once per department, its roles joined ("Producer, Writer").
		const same = list.find((each) => each.media === credit.media && each.id === credit.id);
		if (same) {
			if (credit.role && !same.role.split(", ").includes(credit.role))
				same.role = same.role ? `${same.role}, ${credit.role}` : credit.role;
			continue;
		}
		list.push({ ...credit });
		departments.set(credit.department, list);
	}
	// The department they're known for first, then the biggest.
	const filmography = [...departments.entries()]
		.map(([department, credits]) => ({
			department,
			entries: credits.sort(byDateDescending).slice(0, FILMOGRAPHY_MAX).map(entryOf),
		}))
		.sort(
			(a, b) =>
				Number(b.department === person.knownFor) - Number(a.department === person.knownFor) ||
				b.entries.length - a.entries.length,
		);
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		person: {
			id: person.id,
			name: person.name,
			biography: person.biography,
			profile: person.profile,
			knownFor: person.knownFor,
			birthday: person.birthday,
			deathday: person.deathday,
			placeOfBirth: person.placeOfBirth,
			links: person.links,
		},
		knownFor: knownFor.map(toHubTitle),
		filmography,
	};
}

export async function collectionPage(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
): Promise<Extract<CollectionPageData, { configured: true }>> {
	const collection = await collectionDetails(services, scope, id);
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		collection: {
			id: collection.id,
			name: collection.name,
			overview: collection.overview,
			poster: collection.poster,
			backdrop: collection.backdrop,
		},
		parts: collection.parts.map(({ date: _date, ...part }) => toHubTitle(part)),
	};
}

/** A curated collection's page, by its slug: a 404 unless it's published and has a title to show here (decision 0242). */
export async function curatedPage(
	services: CatalogServices,
	scope: CatalogScope,
	slug: string,
): Promise<Extract<CuratedPageData, { configured: true }>> {
	const { collections } = await services.controls.curation();
	const collection = collections.find((each) => each.published && each.slug === slug);
	if (!collection) throw new AppError("NOT_FOUND", `Parda: no collection "${slug}"`);
	const titles = await curatedTitles(services, scope, collection);
	if (titles.length === 0) throw new AppError("NOT_FOUND", `Parda: nothing to show in "${slug}"`);
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		collection: {
			slug: collection.slug,
			name: localizedValue(collection.name, scope.locale),
			description: collection.description ? localizedValue(collection.description, scope.locale) : "",
			backdrop: titles.find((title) => title.backdrop)?.backdrop ?? null,
		},
		parts: titles.map(toHubTitle),
	};
}

/** The rails "Surprise me" draws from, per page: its popular and top rated lists, cached for an hour. */
const SURPRISE_RAILS: Readonly<Record<"home" | PardaHub, ReadonlyArray<{ page: "home" | PardaHub; rail: string }>>> = {
	home: [
		{ page: "movies", rail: "popular" },
		{ page: "series", rail: "popular" },
		{ page: "movies", rail: "top-rated" },
		{ page: "series", rail: "top-rated" },
	],
	movies: [
		{ page: "movies", rail: "popular" },
		{ page: "movies", rail: "top-rated" },
	],
	series: [
		{ page: "series", rail: "popular" },
		{ page: "series", rail: "top-rated" },
	],
	anime: [
		{ page: "anime", rail: "popular" },
		{ page: "anime", rail: "top-rated" },
	],
};

/** A random title from good lists, never a blocked one; null when TMDB has nothing to offer. */
export async function surprise(
	services: CatalogServices,
	scope: CatalogScope,
	from: "home" | PardaHub,
	random: () => number = Math.random,
): Promise<SurpriseTarget> {
	const context = railContext(scope.region);
	const lists = await Promise.all(
		SURPRISE_RAILS[from].map(async ({ page, rail }) => {
			const spec = PAGE_LAYOUTS[page].rails.find((each) => each.id === rail);
			if (!spec) throw new Error(`Parda: "Surprise me" names an unknown rail ${page}/${rail}`);
			return (await listTitles(services, scope, spec.request(context))).results;
		}),
	);
	const pool = lists.flat().filter((title) => title.backdrop && title.overview);
	const pick = pool[Math.floor(random() * pool.length)];
	return pick ? { media: pick.media, id: pick.id, slug: pick.slug } : null;
}
