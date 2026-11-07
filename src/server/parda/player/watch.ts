import "@tanstack/react-start/server-only";
import { continueEntry, isFinished } from "@/features/parda/library/progress";
import type { WatchPageData, WatchSource } from "@/features/parda/player/watch-types";
import { AppError, isAppError } from "@/lib/errors";
import { originOf } from "@/lib/http/csp";
import type { PardaMedia } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { serverEnv } from "@/server/env";
import { errorFields, log } from "@/server/log";
import { catalogScope, type PardaCatalog } from "../catalog/context";
import { firstSeason } from "../catalog/playable";
import { titleDetails, titleSeason } from "../catalog/service";
import type { PardaSourceRow } from "../controls";
import * as library from "../library/repository";
import type { TitleDetails } from "../tmdb/mappers";
import { effectiveAdaptive, effectiveHeight, qualityLabel, RANKING, watchOrders } from "./ranking";
import { playerLanguage, playerUrl } from "./sources";
import { type SourceStanding, skippedSources } from "./stats";

/**
 * The watch page (PLAN 12.5, decisions 0236 and 0238): the title, the episode, its
 * neighbours, and every enabled source filled for it, in two orders: by the latest daily
 * scores (or the admin's order), adaptive sources first for slow connections, sources
 * failing on this title last.
 */

type Locale = "en" | "ne";

/** Until a source has enough plays: 15 s. Then its p90 start + 5 s, kept between 12 and 30. */
export const DEFAULT_DEADLINE_MS = 15_000;
export const deadlineFor = (p90StartMs: number | null) =>
	p90StartMs === null ? DEFAULT_DEADLINE_MS : Math.min(30_000, Math.max(12_000, p90StartMs + 5_000));

type Target = { season: number; episode: number } | null;

/** The episode before and after `at`, across regular seasons; `next` only once it has aired. */
function neighbours(details: TitleDetails, at: { season: number; episode: number }) {
	const seasons = details.seasonList
		.filter((season) => season.episodes > 0 && season.number > 0)
		.sort((a, b) => a.number - b.number);
	const index = seasons.findIndex((season) => season.number === at.season);
	const here = seasons[index];
	let previous: Target = null;
	let next: Target = null;
	if (here) {
		if (at.episode > 1) previous = { season: at.season, episode: at.episode - 1 };
		else if (index > 0) {
			const before = seasons[index - 1];
			if (before) previous = { season: before.number, episode: before.episodes };
		}
		if (at.episode < here.episodes) next = { season: at.season, episode: at.episode + 1 };
		else {
			const after = seasons[index + 1];
			if (after) next = { season: after.number, episode: 1 };
		}
	}
	const latest = details.latest;
	if (
		next &&
		latest &&
		(next.season > latest.season || (next.season === latest.season && next.episode > latest.episode))
	) {
		next = null;
	}
	return { previous, next };
}

/** A series without `?s=&e=` plays where the viewer is, else its first episode. */
async function startingEpisode(
	db: Db,
	profileId: string | null,
	details: TitleDetails,
): Promise<{ season: number; episode: number } | null> {
	const first = firstSeason(details);
	if (first === null) return null;
	if (profileId) {
		const rows = await library.titleRows(db, profileId, "tv", details.id);
		const entry = continueEntry(
			"tv",
			rows.map((row) => ({ ...row, updatedAt: row.updatedAt.getTime() })),
			{
				seasons: details.seasonList.map((season) => ({ number: season.number, episodes: season.episodes })),
				latest: details.latest ? { season: details.latest.season, episode: details.latest.episode } : null,
			},
		);
		if (entry?.kind === "resume" && entry.season !== null && entry.episode !== null) {
			return { season: entry.season, episode: entry.episode };
		}
		if (entry?.kind === "next") return { season: entry.season, episode: entry.episode };
	}
	return { season: first, episode: 1 };
}

export type WatchRequest = { media: PardaMedia; id: number; season?: number | undefined; episode?: number | undefined };

export async function watchPage(
	catalog: PardaCatalog,
	db: Db,
	request: WatchRequest,
	viewer: { profileId: string | null; autoplay: boolean; audioLanguage?: string | null },
	locale: Locale,
	/** Tests pin the dice and the clock; a play rolls them. */
	options: { random?: () => number; now?: Date } = {},
): Promise<Extract<WatchPageData, { configured: true }>> {
	const { services } = catalog;
	const scope = catalogScope(catalog, locale);
	const details = await titleDetails(services, scope, request.media, request.id);
	const at =
		request.media === "movie"
			? null
			: request.season !== undefined
				? { season: request.season, episode: request.episode ?? 1 }
				: await startingEpisode(db, viewer.profileId, details);
	if (request.media === "tv") {
		const known = at && details.seasonList.find((season) => season.number === at.season);
		if (!at || !known || at.episode < 1 || at.episode > Math.max(known.episodes, 1)) {
			throw new AppError("NOT_FOUND", "Episode not found");
		}
	}

	let episode: Extract<WatchPageData, { configured: true }>["episode"] = null;
	if (at) {
		episode = { ...at, name: "", still: null };
		try {
			const season = await titleSeason(services, scope, details.id, at.season);
			const found = season.episodes.find((each) => each.number === at.episode);
			if (found) episode = { ...at, name: found.name, still: found.still };
		} catch (error) {
			// The player still plays; the episode's name is the only loss.
			if (!isAppError(error) || error.code !== "UPSTREAM_UNAVAILABLE") throw error;
			log("warn", "parda watch season unavailable", { id: details.id, season: at.season, ...errorFields(error) });
		}
	}

	const settings = await services.controls.settings();
	const base = serverEnv.PARDA_PLAYER_BASE;
	const baseOrigin = originOf(base);
	const sourceRows = settings.playbackEnabled ? await services.controls.sources() : [];
	const standings: ReadonlyMap<string, SourceStanding> = settings.playbackEnabled
		? await services.controls.standings()
		: new Map();
	const playable: PardaSourceRow[] = [];
	const sources: WatchSource[] = settings.playbackEnabled
		? sourceRows.flatMap((source) => {
				if (!source.enabled) return [];
				const standing = standings.get(source.id);
				const url = playerUrl(
					source,
					{ media: details.media, id: details.id, imdb: details.imdbId, ...(at ?? {}) },
					{
						lang: playerLanguage(
							locale,
							"languages" in settings ? settings.languages : undefined,
							viewer.audioLanguage ?? catalog.audioLanguage,
						),
						base,
						keepStart: true,
					},
				);
				if (url === null) return [];
				playable.push(source);
				const measured = standing && standing.plays >= RANKING.minPlays;
				return [
					{
						id: source.id,
						name: source.name,
						url,
						origins: [...source.origins, ...(baseOrigin && url.startsWith(baseOrigin) ? [baseOrigin] : [])],
						adapter: source.adapter,
						sandbox: source.sandbox,
						adaptive: effectiveAdaptive(source.adaptive, standing?.probeAdaptive),
						needsClick: source.needsClick,
						autoFallback: source.autoFallback,
						cdnGroup: source.cdnGroup,
						deadlineMs: deadlineFor(measured ? (standing.startP90Ms ?? null) : null),
						quality: qualityLabel(effectiveHeight(source.quality, standing?.probeHeight)),
					},
				];
			})
		: [];
	const skipped = await skippedSources(
		db,
		{ media: details.media, tmdbId: details.id },
		sources.map((source) => source.id),
		options.now,
	);
	const order = watchOrders(
		playable.map((source) => {
			const standing = standings.get(source.id);
			return {
				id: source.id,
				position: source.position,
				pinned: source.pinned,
				adaptive: effectiveAdaptive(source.adaptive, standing?.probeAdaptive),
				score: standing?.score ?? null,
				plays: standing?.plays ?? 0,
				measurable: source.adapter !== "none",
			};
		}),
		{
			mode: settings.sourceOrder,
			skipped,
			random: options.random ?? Math.random,
		},
	);

	let resume: Extract<WatchPageData, { configured: true }>["resume"] = null;
	if (viewer.profileId) {
		const rows = await library.titleRows(db, viewer.profileId, details.media, details.id);
		const row = rows.find((each) => each.season === (at?.season ?? null) && each.episode === (at?.episode ?? null));
		if (row && !row.finished && !isFinished(details.media, row.watched, row.duration) && row.watched > 0) {
			resume = { position: row.watched, sourceId: row.sourceId };
		}
	}

	const { previous, next } = at ? neighbours(details, at) : { previous: null, next: null };
	return {
		configured: true,
		imageBase: services.tmdb.config.imageBase,
		title: {
			media: details.media,
			id: details.id,
			slug: details.slug,
			title: details.title,
			year: details.year,
			backdrop: details.backdrop,
			poster: details.poster,
			overview: details.overview.length > 400 ? `${details.overview.slice(0, 399)}…` : details.overview,
		},
		episode,
		previous,
		next,
		seasons: details.seasonList.filter((season) => season.episodes > 0),
		playback: settings.playbackEnabled ? (sources.length ? "on" : "none") : "off",
		sources,
		order,
		resume,
		autoplay: viewer.autoplay,
		party: Boolean(serverEnv.PARDA_REALTIME_KEY),
		trailer:
			details.videos.find((video) => video.type === "Trailer") ??
			details.videos.find((video) => video.type === "Teaser") ??
			null,
	};
}
