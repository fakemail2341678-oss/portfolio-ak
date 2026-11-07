import { Link } from "@tanstack/react-router";
import { formatNumber } from "@/lib/i18n/intl";
import { type Localized, localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaLinks } from "../links";
import { MEDIA_LABELS } from "./labels";
import type { PardaAdminMedia } from "./schema";

/** A title in an admin list: TMDB's name when Parda's snapshot has it, else its type and id. */
export const titleText = (row: { media: PardaAdminMedia; tmdbId: number; title: Localized | null }) =>
	row.title
		? localizedValue(row.title)
		: m.pd_admin_title_unknown({ media: MEDIA_LABELS[row.media](), id: row.tmdbId });

/**
 * The title's name, and under it its type, its TMDB id and a link to its Parda page (a
 * blocked title's page is a 404: that's the point). The slug is left out: the page
 * answers with a 301 to the right one.
 */
export function TitleCell({
	row,
	episode,
}: {
	row: { media: PardaAdminMedia; tmdbId: number; title: Localized | null };
	episode?: { season: number | null; episode: number | null };
}) {
	return (
		<div className="flex min-w-0 flex-col">
			<Link {...pardaLinks.title(row.media, row.tmdbId, "")} className="truncate font-medium hover:underline">
				{titleText(row)}
			</Link>
			<span className="text-muted-foreground text-xs">
				{MEDIA_LABELS[row.media]()} · TMDB {row.tmdbId}
				{episode?.season != null && episode.episode != null
					? ` · ${m.pd_admin_episode({ season: formatNumber(episode.season), episode: formatNumber(episode.episode) })}`
					: ""}
			</span>
		</div>
	);
}
