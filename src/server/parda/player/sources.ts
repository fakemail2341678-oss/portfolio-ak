import "@tanstack/react-start/server-only";
import { fillTemplate, isRelativeTemplate, type TemplateValues } from "@/features/parda/player/templates";
import { originOf } from "@/lib/http/csp";
import type { PardaMedia } from "@/server/db/schema";
import type { PardaSourceRow } from "../controls";

/** Trailers play in YouTube's privacy-enhanced embed, on every Parda page. */
export const TRAILER_ORIGIN = "https://www.youtube-nocookie.com";

/** Where relative templates point without PARDA_PLAYER_BASE: this app's placeholder routes (decision 0246). */
const PLACEHOLDER_BASE = "/parda/api";

/** `{color}`: the player's accent, hex without `#` (Viduki's `?color=`). Parda's action yellow (decision 0248). */
export const PLAYER_COLOR = "f6d743";

export type PlayerTarget = {
	media: PardaMedia;
	id: number;
	imdb?: string | null;
	season?: number;
	episode?: number;
};

type SourceTemplates = Pick<PardaSourceRow, "movieTemplate" | "tvTemplate">;

/**
 * The language players are asked for (`{lang}`): the profile's audio language when the
 * admin lists it in `pd_settings.languages` (decision 0240), else the page's when listed,
 * else the first they list (decision 0237).
 */
export const playerLanguage = (
	locale: string,
	languages: ReadonlyArray<string> | undefined,
	preferred?: string | null,
): string => {
	const listed = (language: string) => !languages?.length || languages.includes(language);
	if (preferred && listed(preferred)) return preferred;
	return listed(locale) ? locale : (languages?.[0] ?? locale);
};

/** The player URL for one title; null when the source can't play it (a token has no value). */
export function playerUrl(
	source: SourceTemplates,
	target: PlayerTarget,
	options: { lang: string; color?: string; start?: number; base?: string | undefined; keepStart?: boolean },
): string | null {
	const template = target.media === "movie" ? source.movieTemplate : source.tvTemplate;
	const values: TemplateValues = {
		id: target.id,
		lang: options.lang,
		// An empty start is 0: a resume is optional, unlike the title itself.
		start: Math.max(0, Math.floor(options.start ?? 0)),
		...(target.imdb ? { imdb: target.imdb } : {}),
		...(target.season === undefined ? {} : { season: target.season }),
		...(target.episode === undefined ? {} : { episode: target.episode }),
		color: options.color ?? PLAYER_COLOR,
	};
	const filled = fillTemplate(template, values, options.keepStart ? { keep: ["start"] } : {});
	if (filled === null) return null;
	return isRelativeTemplate(filled) ? `${(options.base ?? PLACEHOLDER_BASE).replace(/\/$/, "")}${filled}` : filled;
}

/** What frame-src needs: each usable row's origins, and this app (or the base) for relative templates. */
export function embedOrigins(
	sources: ReadonlyArray<Pick<PardaSourceRow, "enabled" | "origins" | "movieTemplate" | "tvTemplate">>,
	options: { includeDisabled: boolean; base?: string | undefined },
): string[] {
	const origins = new Set<string>([TRAILER_ORIGIN]);
	for (const source of sources) {
		if (!source.enabled && !options.includeDisabled) continue;
		for (const origin of source.origins) origins.add(origin);
		if (isRelativeTemplate(source.movieTemplate) || isRelativeTemplate(source.tvTemplate)) {
			origins.add(originOf(options.base) ?? "'self'");
		}
	}
	return [...origins];
}
