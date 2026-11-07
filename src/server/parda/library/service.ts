import "@tanstack/react-start/server-only";
import {
	airedEpisodes,
	CONTINUE_MAX_AGE_MS,
	continueEntry,
	type EpisodeKey,
	isFinished,
	minutesLeft,
	type ProgressRow,
	progressShare,
	type SeriesShape,
} from "@/features/parda/library/progress";
import type {
	ContinueItem,
	ContinueRailData,
	EpisodeProgress,
	TitleCta,
	TitleProgressData,
} from "@/features/parda/library/types";
import { AppError, isAppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { catalogScope, type PardaCatalog } from "../catalog/context";
import { titleDetails } from "../catalog/service";
import { titleKey } from "../controls";
import type { PardaViewer } from "../profiles/service";
import * as repo from "./repository";

/**
 * A profile's progress and Continue watching (PLAN 12.5, decision 0236). Every call acts
 * on the viewer's active profile only, which `requirePardaViewer` resolved from the session.
 */

export type PardaServices = { db: Db; viewer: PardaViewer; catalog: PardaCatalog | null };

type Locale = "en" | "ne";
type TitleRef = { media: PardaMedia; id: number };

/** A blocked title takes no progress and shows none (PLAN 12.5: takedowns everywhere). */
async function refuseBlocked(ctx: PardaServices, ref: TitleRef) {
	if (!ctx.catalog) return;
	if ((await ctx.catalog.services.controls.blocked()).has(titleKey(ref.media, ref.id))) {
		throw new AppError("NOT_FOUND", "Title not found");
	}
}

const toRow = (row: repo.ProgressDbRow): ProgressRow => ({
	season: row.season,
	episode: row.episode,
	watched: row.watched,
	duration: row.duration,
	finished: row.finished,
	updatedAt: row.updatedAt.getTime(),
});

/** A series' seasons and last aired episode, through the catalogue (cached; takedowns apply). Null when it can't say. */
async function seriesShape(ctx: PardaServices, id: number, locale: Locale): Promise<SeriesShape | null> {
	if (!ctx.catalog) return null;
	const details = await titleDetails(ctx.catalog.services, catalogScope(ctx.catalog, locale), "tv", id);
	return {
		seasons: details.seasonList.map((season) => ({ number: season.number, episodes: season.episodes })),
		latest: details.latest ? { season: details.latest.season, episode: details.latest.episode } : null,
	};
}

export type ProgressInput = TitleRef & {
	season?: number | undefined;
	episode?: number | undefined;
	watched: number;
	duration: number | null;
	sourceId: string | null;
};

const episodeOf = (input: { media: PardaMedia; season?: number | undefined; episode?: number | undefined }) =>
	input.media === "movie"
		? { season: null, episode: null }
		: { season: input.season ?? 1, episode: input.episode ?? 1 };

/** The player's report. Refused when playback is off or the title blocked. */
export async function saveProgress(ctx: PardaServices, input: ProgressInput): Promise<{ saved: boolean }> {
	await refuseBlocked(ctx, input);
	if (ctx.catalog && !(await ctx.catalog.services.controls.settings()).playbackEnabled) {
		throw new AppError("FORBIDDEN", "Playback is off");
	}
	const sources = ctx.catalog ? await ctx.catalog.services.controls.sources() : [];
	const sourceId = sources.some((source) => source.id === input.sourceId) ? input.sourceId : null;
	const saved = await repo.upsertProgress(ctx.db, ctx.viewer.profile.id, {
		media: input.media,
		tmdbId: input.id,
		...episodeOf(input),
		watched: Math.floor(input.watched),
		duration: input.duration === null ? null : Math.floor(input.duration),
		sourceId,
		finished: isFinished(input.media, input.watched, input.duration),
	});
	return { saved };
}

const ctaOf = (entry: ReturnType<typeof continueEntry>): TitleCta | null => {
	if (!entry) return null;
	switch (entry.kind) {
		case "resume":
			return {
				kind: "resume",
				season: entry.season,
				episode: entry.episode,
				left: minutesLeft(entry.watched, entry.duration),
				share: progressShare({ ...entry, finished: false }),
			};
		case "next":
			return { kind: "next", season: entry.season, episode: entry.episode };
		case "schedule":
			return { kind: "caughtUp", season: entry.season, episode: entry.episode };
		case "complete":
			return { kind: "rewatch" };
	}
};

/** The title page's action, the movie's bar, and each episode's bar. */
export async function titleProgress(ctx: PardaServices, ref: TitleRef, locale: Locale): Promise<TitleProgressData> {
	await refuseBlocked(ctx, ref);
	const rows = await repo.titleRows(ctx.db, ctx.viewer.profile.id, ref.media, ref.id);
	if (rows.length === 0) return { cta: null, share: null, episodes: [] };
	const shape = ref.media === "tv" ? await shapeOrNull(ctx, ref.id, locale) : null;
	const episodes: EpisodeProgress[] =
		ref.media === "tv"
			? rows.flatMap((row) =>
					row.season === null || row.episode === null
						? []
						: [{ season: row.season, episode: row.episode, share: progressShare(row), finished: row.finished }],
				)
			: [];
	const movie = ref.media === "movie" ? rows[0] : undefined;
	return {
		cta: ctaOf(continueEntry(ref.media, rows.map(toRow), shape ?? undefined)),
		share: movie ? progressShare(movie) : null,
		episodes,
	};
}

/** TMDB failing leaves a series' Next out rather than failing the page. */
async function shapeOrNull(ctx: PardaServices, id: number, locale: Locale): Promise<SeriesShape | null> {
	try {
		return await seriesShape(ctx, id, locale);
	} catch (error) {
		if (isAppError(error) && (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "NOT_FOUND")) {
			log("warn", "parda series shape unavailable", { id, ...errorFields(error) });
			return null;
		}
		throw error;
	}
}

/** The rail holds at most this many titles. */
const RAIL_MAX = 20;

/**
 * The Continue watching rail: latest first, titles in progress or with a next episode
 * that has aired. Finished, waiting (Schedule) and hidden titles aren't on it, nor
 * anything untouched for six months or blocked.
 */
export async function continueWatching(
	ctx: PardaServices,
	locale: Locale,
	now = Date.now(),
): Promise<ContinueRailData> {
	if (!ctx.catalog) return { imageBase: "", items: [] };
	const catalog = ctx.catalog;
	const since = new Date(now - CONTINUE_MAX_AGE_MS);
	// More than the rail holds: some are finished or waiting.
	const titles = await repo.recentTitles(ctx.db, ctx.viewer.profile.id, since, RAIL_MAX * 2);
	const blocked = await catalog.services.controls.blocked();
	const scope = catalogScope(catalog, locale);
	const items = await Promise.all(
		titles.map(async ({ media, tmdbId, rows }): Promise<ContinueItem | null> => {
			if (blocked.has(titleKey(media, tmdbId))) return null;
			try {
				const details = await titleDetails(catalog.services, scope, media, tmdbId);
				const shape: SeriesShape | undefined =
					media === "tv"
						? {
								seasons: details.seasonList.map((season) => ({ number: season.number, episodes: season.episodes })),
								latest: details.latest ? { season: details.latest.season, episode: details.latest.episode } : null,
							}
						: undefined;
				const cta = ctaOf(continueEntry(media, rows.map(toRow), shape));
				if (!cta || (cta.kind !== "resume" && cta.kind !== "next")) return null;
				return {
					media,
					id: tmdbId,
					slug: details.slug,
					title: details.title,
					backdrop: details.backdrop,
					poster: details.poster,
					cta,
					share: cta.kind === "resume" ? cta.share : 0,
				};
			} catch (error) {
				if (isAppError(error) && (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "NOT_FOUND")) return null;
				throw error;
			}
		}),
	);
	return {
		imageBase: catalog.services.tmdb.config.imageBase,
		items: items.filter((item): item is ContinueItem => item !== null).slice(0, RAIL_MAX),
	};
}

export async function removeFromContinue(ctx: PardaServices, ref: TitleRef): Promise<void> {
	await repo.hideTitle(ctx.db, ctx.viewer.profile.id, ref.media, ref.id);
}

export async function rewatch(ctx: PardaServices, ref: TitleRef): Promise<void> {
	await refuseBlocked(ctx, ref);
	await repo.rewatchTitle(ctx.db, ctx.viewer.profile.id, ref.media, ref.id);
}

export type MarkInput = TitleRef & {
	/** `title`: the movie, or every aired episode of a series; `season` and `episode` narrow it. */
	scope: "title" | "season" | "episode";
	season?: number | undefined;
	episode?: number | undefined;
	watched: boolean;
};

/** *Mark watched* or *unwatched*, by episode, season or series: the Continue watching pointer moves with it. */
export async function mark(ctx: PardaServices, input: MarkInput, locale: Locale): Promise<void> {
	await refuseBlocked(ctx, input);
	const profileId = ctx.viewer.profile.id;
	if (input.media === "movie") {
		await (input.watched ? repo.markWatched : repo.markUnwatched)(ctx.db, profileId, "movie", input.id, null);
		return;
	}
	if (input.scope === "episode") {
		if (input.season === undefined || input.episode === undefined) throw new AppError("BAD_REQUEST", "Episode needed");
		const keys = [{ season: input.season, episode: input.episode }];
		await (input.watched ? repo.markWatched : repo.markUnwatched)(ctx.db, profileId, "tv", input.id, keys);
		return;
	}
	if (!input.watched && input.scope === "title") {
		await repo.markUnwatched(ctx.db, profileId, "tv", input.id, null);
		return;
	}
	const shape = await seriesShape(ctx, input.id, locale);
	if (!shape) throw new AppError("UPSTREAM_UNAVAILABLE", "No catalogue");
	if (input.scope === "season" && input.season === undefined) throw new AppError("BAD_REQUEST", "Season needed");
	const keys: EpisodeKey[] = input.scope === "season" ? airedEpisodes(shape, input.season) : airedEpisodes(shape);
	const all: EpisodeKey[] =
		input.scope === "season"
			? shape.seasons
					.filter((season) => season.number === input.season)
					.flatMap((season) =>
						Array.from({ length: season.episodes }, (_, at) => ({ season: season.number, episode: at + 1 })),
					)
			: keys;
	await (input.watched
		? repo.markWatched(ctx.db, profileId, "tv", input.id, keys)
		: repo.markUnwatched(ctx.db, profileId, "tv", input.id, all));
}

export type LocalEntry = ProgressInput & { updatedAt: number };

/** The browser's own progress (no session until now), once: newer entries win. At most 50. */
export async function importLocal(ctx: PardaServices, entries: ReadonlyArray<LocalEntry>, now = Date.now()) {
	const blocked = ctx.catalog ? await ctx.catalog.services.controls.blocked() : new Set<string>();
	const writes = entries
		.filter((entry) => !blocked.has(titleKey(entry.media, entry.id)))
		.slice(0, 50)
		.map((entry) => ({
			media: entry.media,
			tmdbId: entry.id,
			...episodeOf(entry),
			watched: Math.floor(entry.watched),
			duration: entry.duration === null ? null : Math.floor(entry.duration),
			sourceId: null,
			finished: isFinished(entry.media, entry.watched, entry.duration),
			// A browser's clock can be ahead; nothing is newer than now.
			updatedAt: new Date(Math.min(entry.updatedAt, now)),
		}));
	return { imported: await repo.importProgress(ctx.db, ctx.viewer.profile.id, writes) };
}
