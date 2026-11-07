import { queryOptions } from "@tanstack/react-query";
import { getPardaParty } from "@/functions/parda/watch";
import type { Locale } from "@/paraglide/runtime";
import { pardaLibraryKeys } from "../keys";

/** A party's page (decision 0243): this viewer's resume and cap are in it, and the room moves on from the first read. */
export const pardaPartyQueryOptions = (locale: Locale, code: string) =>
	queryOptions({
		queryKey: pardaLibraryKeys.party(locale, code),
		queryFn: () => getPardaParty({ data: { code, locale } }),
		staleTime: 0,
		gcTime: 60_000,
	});
