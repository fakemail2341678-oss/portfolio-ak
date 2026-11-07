import { queryOptions } from "@tanstack/react-query";
import {
	getPardaBanner,
	getPardaCollection,
	getPardaCredits,
	getPardaCurated,
	getPardaHub,
	getPardaPerson,
	getPardaRail,
	getPardaSeason,
	getPardaTitle,
} from "@/functions/parda/catalog";
import type { Locale } from "@/paraglide/runtime";
import { pardaKeys } from "./keys";
import type { PardaPage, PardaType } from "./search";

/**
 * Catalogue reads. Route loaders import this module with `await import()` (0194), so
 * the server-function stubs stay out of every page's JavaScript.
 */

/** TMDB's lists change hourly at most (the server caches them for an hour), so a tab never needs them fresher. */
const CATALOG_STALE = 10 * 60_000;

export const pardaPageQueryOptions = (locale: Locale, page: PardaPage) =>
	queryOptions({
		queryKey: pardaKeys.page(locale, page),
		queryFn: () => getPardaHub({ data: { page, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaRailQueryOptions = (locale: Locale, page: PardaPage, rail: string) =>
	queryOptions({
		queryKey: pardaKeys.rail(locale, page, rail),
		queryFn: () => getPardaRail({ data: { page, rail, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaTitleQueryOptions = (locale: Locale, type: PardaType, id: number) =>
	queryOptions({
		queryKey: pardaKeys.title(locale, type, id),
		queryFn: () => getPardaTitle({ data: { type, id, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaSeasonQueryOptions = (
	locale: Locale,
	id: number,
	season: number | undefined,
	page: number | undefined,
) =>
	queryOptions({
		queryKey: pardaKeys.season(locale, id, season, page),
		queryFn: () =>
			getPardaSeason({
				data: { id, locale, ...(season === undefined ? {} : { season }), ...(page === undefined ? {} : { page }) },
			}),
		staleTime: CATALOG_STALE,
	});

export const pardaCreditsQueryOptions = (locale: Locale, type: PardaType, id: number) =>
	queryOptions({
		queryKey: pardaKeys.credits(locale, type, id),
		queryFn: () => getPardaCredits({ data: { type, id, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaPersonQueryOptions = (locale: Locale, id: number) =>
	queryOptions({
		queryKey: pardaKeys.person(locale, id),
		queryFn: () => getPardaPerson({ data: { id, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaCollectionQueryOptions = (locale: Locale, id: number) =>
	queryOptions({
		queryKey: pardaKeys.collection(locale, id),
		queryFn: () => getPardaCollection({ data: { id, locale } }),
		staleTime: CATALOG_STALE,
	});

export const pardaCuratedQueryOptions = (locale: Locale, slug: string) =>
	queryOptions({
		queryKey: pardaKeys.curated(locale, slug),
		queryFn: () => getPardaCurated({ data: { slug, locale } }),
		staleTime: CATALOG_STALE,
	});

/** The admin's banner (decision 0237): the same in every language, so one entry; a change shows within minutes. */
export const pardaBannerQueryOptions = () =>
	queryOptions({ queryKey: pardaKeys.banner(), queryFn: () => getPardaBanner(), staleTime: 5 * 60_000 });
