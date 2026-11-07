import type { QueryClient } from "@tanstack/react-query";
import { ensureQuery, prefetch } from "@/lib/query";
import type { Locale } from "@/paraglide/runtime";
import { pardaPageQueryOptions, pardaRailQueryOptions } from "../queries";
import type { PardaPage } from "../search";

/**
 * The home's and the hubs' loader (routes import it with `await import()`, 0194):
 * awaits the billboard and the first rails, starts every later rail without waiting
 * (they stream into the same response). It returns nothing: the head needs no data,
 * and the billboard preloads its own first picture (decision 0245).
 */
export async function loadPardaPage(
	queryClient: QueryClient,
	locale: Locale,
	page: PardaPage,
	signedIn = false,
): Promise<void> {
	const data = await ensureQuery(queryClient, pardaPageQueryOptions(locale, page));
	// The home's Continue watching (decision 0236) and personal rails (decision 0240) render on the server
	// for a session; a failure only leaves one out.
	if (signedIn && page === "home" && data.configured) {
		const { pardaContinueQueryOptions, pardaForYouQueryOptions } = await import("../library/queries");
		await Promise.all([
			ensureQuery(queryClient, pardaContinueQueryOptions(locale)).catch(() => undefined),
			ensureQuery(queryClient, pardaForYouQueryOptions(locale)).catch(() => undefined),
		]);
	}
	if (!data.configured) return;
	for (const rail of data.rails) {
		if (rail.titles === undefined) prefetch(queryClient, pardaRailQueryOptions(locale, page, rail.id));
	}
}
