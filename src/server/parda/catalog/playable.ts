import "@tanstack/react-start/server-only";
import { playerUrl } from "../player/sources";
import type { TitleDetails } from "../tmdb/mappers";
import type { CatalogScope, CatalogServices } from "./service";

/** The first season that isn't specials, or the specials when that's all there is. */
export const firstSeason = (details: Pick<TitleDetails, "seasonList">) =>
	details.seasonList.find((season) => season.number > 0)?.number ?? details.seasonList[0]?.number ?? null;

/**
 * Whether Play leads anywhere (decision 0236): playback is on and some enabled source can
 * fill its template for this title. The watch page does the rest. The title page and the
 * billboard ask it (0244).
 */
export async function isPlayable(
	services: CatalogServices,
	details: TitleDetails,
	locale: CatalogScope["locale"],
): Promise<boolean> {
	const settings = await services.controls.settings();
	if (!settings.playbackEnabled) return false;
	const season = details.media === "tv" ? firstSeason(details) : null;
	if (details.media === "tv" && season === null) return false;
	for (const source of await services.controls.sources()) {
		if (!source.enabled) continue;
		const target = {
			media: details.media,
			id: details.id,
			imdb: details.imdbId,
			...(season === null ? {} : { season, episode: 1 }),
		};
		if (playerUrl(source, target, { lang: locale, keepStart: true }) !== null) return true;
	}
	return false;
}
