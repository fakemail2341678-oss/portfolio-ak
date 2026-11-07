import type { QueryClient } from "@tanstack/react-query";
import { loadDetailOr404 } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import { pardaWatchQueryOptions } from "../library/queries";
import type { PardaType } from "../search";
import { episodeCode } from "../title/title-hero";

/**
 * The watch page's loader (the route imports it with `await import()`, 0194): the page's
 * data, and only the title the head needs.
 */
export async function loadWatchPage(
	queryClient: QueryClient,
	locale: Locale,
	params: { type: PardaType; id: number },
	search: { s?: number | undefined; e?: number | undefined },
): Promise<{ title: string } | undefined> {
	const data = await loadDetailOr404(
		queryClient,
		pardaWatchQueryOptions(locale, params.type, params.id, search.s, search.e),
	);
	if (!data.configured) return undefined;
	const { title, episode } = data;
	return {
		title: m.pd_watch_title({
			title: episode ? `${title.title} ${episodeCode(episode.season, episode.episode)}` : title.title,
		}),
	};
}
