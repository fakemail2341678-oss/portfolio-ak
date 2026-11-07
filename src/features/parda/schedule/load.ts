import type { QueryClient } from "@tanstack/react-query";
import { ensureQuery } from "@/lib/query";
import type { Locale } from "@/paraglide/runtime";
import { pardaAnimeWeekQueryOptions, pardaFollowingQueryOptions } from "./queries";

/**
 * The schedule's loader (routes import it with `await import()`, 0194): anime for
 * everyone, and with a session the followed series, so the page renders whole. A
 * failure of the followed half only leaves it out.
 */
export async function loadSchedulePage(queryClient: QueryClient, locale: Locale, signedIn: boolean): Promise<void> {
	await Promise.all([
		ensureQuery(queryClient, pardaAnimeWeekQueryOptions(locale)),
		signedIn ? ensureQuery(queryClient, pardaFollowingQueryOptions(locale)).catch(() => undefined) : undefined,
	]);
}
