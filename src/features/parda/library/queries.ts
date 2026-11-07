import { type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	getPardaContinue,
	getPardaForYou,
	getPardaHistory,
	getPardaLibrary,
	getPardaSaved,
	getPardaTitleProgress,
	getPardaViewer,
} from "@/functions/parda/library";
import { getPardaProfiles } from "@/functions/parda/profiles";
import { getPardaWatch } from "@/functions/parda/watch";
import type { Locale } from "@/paraglide/runtime";
import { pardaLibraryKeys } from "../keys";
import type { LibraryQuery, PardaType } from "../search";

/**
 * The viewer's reads (decision 0236). Loaders import this with `await import()` (0194)
 * and ask only when there's a session; without one, the page reads the browser's own
 * progress after it mounts.
 */

export const pardaViewerQueryOptions = () =>
	queryOptions({ queryKey: pardaLibraryKeys.viewer(), queryFn: () => getPardaViewer(), staleTime: 5 * 60_000 });

export const pardaContinueQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaLibraryKeys.continue(locale),
		queryFn: () => getPardaContinue({ data: { locale } }),
		staleTime: 30_000,
	});

export const pardaTitleProgressQueryOptions = (locale: Locale, media: "movie" | "tv", id: number) =>
	queryOptions({
		queryKey: pardaLibraryKeys.title(locale, media, id),
		queryFn: () => getPardaTitleProgress({ data: { locale, media, id } }),
		staleTime: 30_000,
	});

/** The watch page: catalogue data plus this viewer's resume, so never shared between viewers. */
export const pardaWatchQueryOptions = (
	locale: Locale,
	type: PardaType,
	id: number,
	season: number | undefined,
	episode: number | undefined,
) =>
	queryOptions({
		queryKey: pardaLibraryKeys.watch(locale, type, id, season, episode),
		queryFn: () =>
			getPardaWatch({
				data: {
					type,
					id,
					locale,
					...(season === undefined ? {} : { season }),
					...(episode === undefined ? {} : { episode }),
				},
			}),
		// A resume read once is enough: the page itself moves on from there.
		staleTime: 0,
		gcTime: 60_000,
	});

/** What the profile saved: the layout reads it for a session, and every button reads it from there. */
export const pardaSavedQueryOptions = () =>
	queryOptions({ queryKey: pardaLibraryKeys.saved(), queryFn: () => getPardaSaved(), staleTime: 60_000 });

export const pardaShelfQueryOptions = (locale: Locale, tab: "list" | "favourites", query: LibraryQuery) =>
	queryOptions({
		queryKey: pardaLibraryKeys.shelf(locale, tab, query),
		queryFn: () => getPardaLibrary({ data: { tab, locale, ...query } }),
		staleTime: 30_000,
	});

export const pardaHistoryQueryOptions = (locale: Locale, page: number) =>
	queryOptions({
		queryKey: pardaLibraryKeys.history(locale, page),
		queryFn: () => getPardaHistory({ data: { locale, page } }),
		staleTime: 30_000,
	});

export const pardaForYouQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaLibraryKeys.forYou(locale),
		queryFn: () => getPardaForYou({ data: { locale } }),
		staleTime: 5 * 60_000,
	});

export const pardaProfilesQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaLibraryKeys.profiles(locale),
		queryFn: () => getPardaProfiles({ data: { locale } }),
		staleTime: 30_000,
	});

/** After a save, a mark or a Remove: the rail and the title's progress read again. */
export const refreshLibrary = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: pardaLibraryKeys.all, refetchType: "active" });
