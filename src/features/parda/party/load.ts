import type { QueryClient } from "@tanstack/react-query";
import { loadDetailOr404 } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import { episodeCode } from "../title/title-hero";
import { pardaPartyQueryOptions } from "./queries";

/** The party page's loader (the route imports it with `await import()`, 0194): its data, and the title for the head. */
export async function loadPartyPage(
	queryClient: QueryClient,
	locale: Locale,
	code: string,
): Promise<{ title: string } | undefined> {
	const data = await loadDetailOr404(queryClient, pardaPartyQueryOptions(locale, code));
	if (!data.configured) return undefined;
	const { title, episode } = data.watch;
	return {
		title: m.pd_party_title({
			title: episode ? `${title.title} ${episodeCode(episode.season, episode.episode)}` : title.title,
		}),
	};
}
