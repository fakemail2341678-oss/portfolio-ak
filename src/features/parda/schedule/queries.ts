import { queryOptions } from "@tanstack/react-query";
import { getPardaFollowing, getPardaInbox } from "@/functions/parda/alerts";
import { getPardaAnimeWeek } from "@/functions/parda/schedule";
import type { Locale } from "@/paraglide/runtime";
import { pardaKeys, pardaLibraryKeys } from "../keys";

/**
 * The alerts' and the schedule's reads (decision 0241). The layout loads the bell's for a
 * session; the schedule page loads anime for everyone and the followed series for a session.
 */

export const pardaInboxQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaLibraryKeys.inbox(locale),
		queryFn: () => getPardaInbox({ data: { locale } }),
		staleTime: 60_000,
	});

export const pardaFollowingQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaLibraryKeys.following(locale),
		queryFn: () => getPardaFollowing({ data: { locale } }),
		staleTime: 60_000,
	});

export const pardaAnimeWeekQueryOptions = (locale: Locale) =>
	queryOptions({
		queryKey: pardaKeys.animeWeek(locale),
		queryFn: () => getPardaAnimeWeek({ data: { locale } }),
		staleTime: 60_000,
	});
