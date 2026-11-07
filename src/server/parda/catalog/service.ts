import "@tanstack/react-start/server-only";
import { z } from "zod";
import { withinCap } from "@/features/parda/kids";
import { AppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import { type PardaControls, titleKey } from "../controls";
import type { TmdbCache, TmdbCacheClass } from "../tmdb/cache";
import type { Tmdb, TmdbParams } from "../tmdb/client";
import {
	fillInDetails,
	fillInList,
	type ListMedia,
	mapDetails,
	mapList,
	parse,
	type TitleDetails,
	type TitleList,
	type TitleSummary,
} from "../tmdb/mappers";
import {
	type CollectionDetails,
	fillInCollection,
	fillInPerson,
	fillInSeason,
	mapCollection,
	mapCredits,
	mapPerson,
	mapSeason,
	type PersonDetails,
	type SeasonDetails,
	type TitleCredits,
} from "../tmdb/pages";
import { fillInSearch, mapSearch, type SearchKind, type SearchResults } from "../tmdb/search";
import { cappedRequest } from "./kids-requests";
import { creditsPath, DETAILS_PARAMS, PERSON_PARAMS, seasonPath } from "./requests";

/**
 * Every catalogue read goes through here (PLAN 12.6): the one place that applies
 * takedowns, the kids' cap (decision 0240) and the cache epoch, so no page can show a
 * blocked title, or a kids' profile one over its cap.
 */

export type CatalogServices = { tmdb: Tmdb; cache: TmdbCache; controls: PardaControls };
/**
 * What an answer depends on, beside its path. `cap` is a kids' profile's certificate:
 * it changes which requests are made and what passes, never TMDB's answer to one, so it
 * isn't part of the cache key (a kids' page shares the cache with everyone else's).
 */
export type CatalogScope = { locale: "en" | "ne"; region: string; cap: string | null };

const TMDB_LOCALE = { en: "en-US", ne: "ne-NP" } as const;

async function read<T>(
	services: CatalogServices,
	scope: CatalogScope,
	cacheClass: TmdbCacheClass,
	path: string,
	params: TmdbParams,
	map: (raw: unknown) => T,
	fill: (nepali: T, english: T) => T,
): Promise<T> {
	const { cacheEpoch: epoch } = await services.controls.settings();
	const inLocale = (locale: CatalogScope["locale"]) =>
		services.cache.read({ path, params, locale, region: scope.region, cap: null, epoch }, cacheClass, async () =>
			map(await services.tmdb.get(path, { ...params, language: TMDB_LOCALE[locale] })),
		);
	if (scope.locale === "en") return inLocale("en");
	const [nepali, english] = await Promise.all([inLocale("ne"), inLocale("en")]);
	return fill(nepali, english);
}

/**
 * Titles minus takedowns, and under a cap minus every title whose US certificate
 * `pd_title` doesn't know to be within it: every list a page shows passes through here.
 * `capped` says TMDB already filtered the list by certificate (`cappedRequest`).
 */
const visible = async <T extends Pick<TitleSummary, "media" | "id">>(
	services: CatalogServices,
	scope: CatalogScope,
	titles: ReadonlyArray<T>,
	capped = false,
): Promise<T[]> => {
	const blocked = await services.controls.blocked();
	const cap = capped ? null : scope.cap;
	const certificates = cap ? await services.controls.certifications() : null;
	return titles.filter((item) => {
		const key = titleKey(item.media, item.id);
		if (blocked.has(key)) return false;
		return !cap || withinCap(cap, item.media, certificates?.get(key));
	});
};

/** A blocked title is a 404, the same as one that doesn't exist, and TMDB is never asked. */
const refuseBlocked = async (services: CatalogServices, media: PardaMedia, id: number) => {
	const blocked = await services.controls.blocked();
	if (blocked.has(titleKey(media, id))) throw new AppError("NOT_FOUND", `Blocked title ${media}/${id}`);
};

/** A title's US certificate, from its details (every country's are there). */
export const usCertificate = (details: Pick<TitleDetails, "ratings">): string | null =>
	details.ratings.find((row) => row.country === "US")?.rating ?? null;

/** Over a kids' profile's cap, a title is a 404 like a blocked one; without a US certificate too. */
const refuseOverCap = (scope: CatalogScope, details: Pick<TitleDetails, "media" | "id" | "ratings">) => {
	if (scope.cap && !withinCap(scope.cap, details.media, usCertificate(details))) {
		throw new AppError("NOT_FOUND", `Over the cap: ${details.media}/${details.id}`);
	}
};

export async function popularTitles(
	services: CatalogServices,
	scope: CatalogScope,
	media: PardaMedia,
	page = 1,
): Promise<TitleList> {
	return listTitles(services, scope, { media, path: `${media}/popular`, params: { page } });
}

/**
 * Any list a rail shows (`catalog/rails.ts`): trending, a TMDB list or a discover query,
 * minus takedowns. Under a cap, asked as its capped discover query when TMDB can filter
 * it, else filtered through `pd_title`'s certificates.
 */
export async function listTitles(
	services: CatalogServices,
	scope: CatalogScope,
	request: { media: ListMedia; path: string; params: TmdbParams },
): Promise<TitleList> {
	const capped = scope.cap ? cappedRequest(request, scope.cap) : null;
	const asked = capped ?? request;
	const list = await read(
		services,
		scope,
		"list",
		asked.path,
		{ page: 1, ...asked.params },
		(raw) => mapList(asked.media, raw),
		fillInList,
	);
	return { ...list, results: await visible(services, scope, list.results, capped !== null) };
}

/**
 * A search (Task 66): TMDB's multi search or one kind, a page at a time, minus takedowns
 * (a blocked title also leaves a person's "known for"). Cached as searches, 10 minutes.
 */
export async function searchCatalog(
	services: CatalogServices,
	scope: CatalogScope,
	kind: SearchKind,
	query: string,
	page = 1,
): Promise<SearchResults> {
	const results = await read(
		services,
		scope,
		"search",
		`search/${kind}`,
		{ query, page },
		(raw) => mapSearch(kind, raw),
		fillInSearch,
	);
	const titles = results.hits.flatMap((hit) => (hit.media === "person" ? hit.knownFor : [hit]));
	const shown = new Set(
		(await visible(services, scope, titles as ReadonlyArray<{ media: PardaMedia; id: number }>)).map((item) =>
			titleKey(item.media, item.id),
		),
	);
	const allowed = (item: { media: string; id: number }) =>
		item.media === "person" || shown.has(titleKey(item.media, item.id));
	return {
		...results,
		hits: results.hits
			.filter(allowed)
			.map((hit) => (hit.media === "person" ? { ...hit, knownFor: hit.knownFor.filter(allowed) } : hit)),
	};
}

/** A keyword's name (Discover's heading for `?keyword=`). */
export async function keywordName(services: CatalogServices, scope: CatalogScope, id: number): Promise<string> {
	return read(
		services,
		{ ...scope, locale: "en" },
		"details",
		`keyword/${id}`,
		{},
		(raw) => parse(z.object({ name: z.string() }), raw, "keyword").name,
		(name) => name,
	);
}

/** A title's details, with its recommendations and similar titles minus takedowns (and over the cap). */
export async function titleDetails(
	services: CatalogServices,
	scope: CatalogScope,
	media: PardaMedia,
	id: number,
): Promise<TitleDetails> {
	await refuseBlocked(services, media, id);
	const details = await read(
		services,
		scope,
		"details",
		`${media}/${id}`,
		DETAILS_PARAMS,
		(raw) => mapDetails(media, raw, scope.region),
		fillInDetails,
	);
	refuseOverCap(scope, details);
	return {
		...details,
		recommendations: await visible(services, scope, details.recommendations),
		similar: await visible(services, scope, details.similar),
	};
}

/** One season of a series, every episode (the page shows them a page at a time). */
export async function titleSeason(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
	season: number,
): Promise<SeasonDetails> {
	await refuseBlocked(services, "tv", id);
	if (scope.cap) await titleDetails(services, scope, "tv", id);
	return read(services, scope, "details", seasonPath(id, season), {}, mapSeason, fillInSeason);
}

/** The full cast and crew. */
export async function titleCredits(
	services: CatalogServices,
	scope: CatalogScope,
	media: PardaMedia,
	id: number,
): Promise<TitleCredits> {
	await refuseBlocked(services, media, id);
	if (scope.cap) await titleDetails(services, scope, media, id);
	// Names and jobs don't change with the language: one answer serves both.
	return read(services, { ...scope, locale: "en" }, "details", creditsPath(media, id), {}, mapCredits, (ne) => ne);
}

/** A person, with their filmography minus takedowns. */
export async function personDetails(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
): Promise<PersonDetails> {
	const person = await read(services, scope, "details", `person/${id}`, PERSON_PARAMS, mapPerson, fillInPerson);
	return { ...person, credits: await visible(services, scope, person.credits) };
}

/** A collection, its parts in release order minus takedowns. */
export async function collectionDetails(
	services: CatalogServices,
	scope: CatalogScope,
	id: number,
): Promise<CollectionDetails> {
	const collection = await read(services, scope, "details", `collection/${id}`, {}, mapCollection, fillInCollection);
	return { ...collection, parts: await visible(services, scope, collection.parts) };
}
