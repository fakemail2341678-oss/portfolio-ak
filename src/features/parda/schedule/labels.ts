import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

/**
 * An alert's episodes (decision 0241), in the bell, the New episodes rail and the digest:
 * "S2 · E5", or "S2 · E1–8" when a season arrived at once. `locale` for an email, whose
 * language is the account's, not the request's.
 */
export function episodeRangeLabel(
	range: { season: number; episode: number; lastEpisode: number },
	locale?: Locale,
): string {
	const options = locale ? { locale } : {};
	const number = (value: number) => formatNumber(value, {}, locale);
	return range.lastEpisode > range.episode
		? m.pd_episode_range(
				{ season: number(range.season), first: number(range.episode), last: number(range.lastEpisode) },
				options,
			)
		: m.pd_episode_code({ season: number(range.season), episode: number(range.episode) }, options);
}
