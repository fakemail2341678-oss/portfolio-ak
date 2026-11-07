import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { ensureQuery } from "@/lib/query";
import type { Locale } from "@/paraglide/runtime";
import { isLibraryTab, type LibraryQuery } from "../search";

/**
 * The library's loader (routes import it with `await import()`, 0194): an unknown tab is
 * Parda's 404; with a session it awaits the tab's data, so the page renders whole.
 * Without one there's nothing to read: the page says how the library starts.
 */
export async function loadLibraryPage(
	queryClient: QueryClient,
	locale: Locale,
	tab: string,
	query: LibraryQuery,
	signedIn: boolean,
): Promise<void> {
	if (!isLibraryTab(tab)) throw notFound();
	if (!signedIn) return;
	const queries = await import("./queries");
	switch (tab) {
		case "list":
		case "favourites":
			await ensureQuery(queryClient, queries.pardaShelfQueryOptions(locale, tab, query));
			return;
		case "continue":
			await ensureQuery(queryClient, queries.pardaContinueQueryOptions(locale));
			return;
		case "history":
			await ensureQuery(queryClient, queries.pardaHistoryQueryOptions(locale, query.page));
			return;
	}
}
