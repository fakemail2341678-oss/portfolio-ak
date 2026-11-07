import "@tanstack/react-start/server-only";
import { withinCap } from "@/features/parda/kids";
import { CONTINUE_MAX_AGE_MS } from "@/features/parda/library/progress";
import type { FollowingSchedule, InboxData, NewEpisodeItem, ScheduleEntry } from "@/features/parda/schedule/types";
import { titleSlug } from "@/features/parda/slug";
import { isAppError } from "@/lib/errors";
import { addDays } from "@/lib/i18n/date-only";
import { errorFields, log } from "@/server/log";
import { catalogScope, type PardaCatalog } from "../catalog/context";
import { titleDetails, titleSeason } from "../catalog/service";
import { titleKey } from "../controls";
import type { PardaServices } from "../library/service";
import * as repo from "./repository";

/**
 * A profile's side of the alerts (PLAN Task 68, decision 0241): the bell, the home's New
 * episodes rail and its half of the schedule. Every call acts on the viewer's active
 * profile only; takedowns and a kids' cap hide alerts as they hide titles.
 */

type Locale = "en" | "ne";

/** The bell lists this many; older ones are in no list (the job prunes them at 90 days). */
const INBOX_MAX = 30;
/** The New episodes rail reads alerts this far back, and shows at most this many series. */
const RAIL_DAYS = 30;
const RAIL_MAX = 20;
/** The schedule looks this far ahead for followed series, over at most this many of them. */
export const FOLLOWING_DAYS = 14;
const FOLLOWING_MAX = 60;

const imageBaseOf = (ctx: PardaServices) => ctx.catalog?.services.tmdb.config.imageBase ?? "";

/** Whether the profile may see series `id`: not taken down, and within a kids' cap. */
async function visibleTo(catalog: PardaCatalog | null) {
	if (!catalog) return () => true;
	const blocked = await catalog.services.controls.blocked();
	const cap = catalog.cap;
	const certificates = cap ? await catalog.services.controls.certifications() : null;
	return (id: number) => {
		const key = titleKey("tv", id);
		return !blocked.has(key) && (!cap || withinCap(cap, "tv", certificates?.get(key)));
	};
}

const nameIn = (row: repo.NotificationRow, locale: Locale) =>
	(locale === "ne" ? row.data.title.ne : "") || row.data.title.en;

export async function inbox(ctx: PardaServices, locale: Locale): Promise<InboxData> {
	const profileId = ctx.viewer.profile.id;
	const [rows, shown] = await Promise.all([
		repo.latestNotifications(ctx.db, profileId, INBOX_MAX),
		visibleTo(ctx.catalog),
	]);
	const items = rows
		.filter((row) => shown(row.tmdbId))
		.map((row) => ({
			id: row.id,
			tmdbId: row.tmdbId,
			slug: titleSlug(row.data.title.en),
			title: nameIn(row, locale),
			poster: row.data.poster,
			season: row.season,
			episode: row.episode,
			lastEpisode: row.lastEpisode,
			createdAt: row.createdAt.toISOString(),
			read: row.readAt !== null,
		}));
	return { imageBase: imageBaseOf(ctx), items, unread: await repo.unreadCount(ctx.db, profileId) };
}

/** Marks alerts read: those the bell showed (`ids`), or all of the profile's. */
export async function markRead(ctx: PardaServices, ids: ReadonlyArray<string> | null, now = new Date()) {
	await repo.markRead(ctx.db, ctx.viewer.profile.id, ids, now);
}

/**
 * The home's New episodes: each series once, from its latest alert of the last 30 days,
 * until the profile finished that alert's last episode.
 */
export async function newEpisodes(ctx: PardaServices, locale: Locale, now = new Date()): Promise<NewEpisodeItem[]> {
	const profileId = ctx.viewer.profile.id;
	const since = new Date(now.getTime() - RAIL_DAYS * 86_400_000);
	const [rows, shown] = await Promise.all([
		repo.latestNotifications(ctx.db, profileId, RAIL_MAX * 5, since),
		visibleTo(ctx.catalog),
	]);
	const latest = new Map<number, repo.NotificationRow>();
	for (const row of rows) if (!latest.has(row.tmdbId) && shown(row.tmdbId)) latest.set(row.tmdbId, row);
	const finished = await repo.finishedEpisodes(ctx.db, profileId, [...latest.keys()]);
	return [...latest.values()]
		.filter((row) => !finished.has(`${row.tmdbId}:${row.season}:${row.lastEpisode}`))
		.slice(0, RAIL_MAX)
		.map((row) => ({
			id: row.tmdbId,
			slug: titleSlug(row.data.title.en),
			title: nameIn(row, locale),
			backdrop: row.data.backdrop,
			season: row.season,
			episode: row.episode,
			lastEpisode: row.lastEpisode,
		}));
}

const unavailable = (error: unknown) =>
	isAppError(error) && (error.code === "UPSTREAM_UNAVAILABLE" || error.code === "NOT_FOUND");

/**
 * The profile's half of the schedule: the episodes of followed series airing from `today`
 * (the viewer's) for 14 days. A series' next episode comes with its details; the rest of
 * that season's dates come from the season (both cached). A series TMDB can't answer, or
 * the profile can't open, is left out.
 */
export async function followingSchedule(
	ctx: PardaServices,
	locale: Locale,
	today: string,
	now = new Date(),
): Promise<FollowingSchedule> {
	const catalog = ctx.catalog;
	if (!catalog) return { imageBase: "", entries: [] };
	const scope = catalogScope(catalog, locale);
	const last = addDays(today, FOLLOWING_DAYS - 1);
	const within = (date: string | null): date is string => date !== null && date >= today && date <= last;
	const ids = await repo.followedBy(
		ctx.db,
		ctx.viewer.profile.id,
		new Date(now.getTime() - CONTINUE_MAX_AGE_MS),
		FOLLOWING_MAX,
	);
	const perSeries = await Promise.all(
		ids.map(async (id): Promise<ScheduleEntry[]> => {
			try {
				const details = await titleDetails(catalog.services, scope, "tv", id);
				const next = details.next;
				if (!next || !within(next.airDate)) return [];
				const base = {
					id,
					slug: details.slug,
					title: details.title,
					poster: details.poster,
					kind: "following" as const,
				};
				const first: ScheduleEntry = {
					...base,
					season: next.season,
					episode: next.episode,
					name: next.name,
					airDate: next.airDate,
				};
				try {
					const season = await titleSeason(catalog.services, scope, id, next.season);
					const later = season.episodes.filter((episode) => episode.number > next.episode && within(episode.airDate));
					return [
						first,
						...later.map((episode) => ({
							...base,
							season: next.season,
							episode: episode.number,
							name: episode.name,
							airDate: episode.airDate ?? today,
						})),
					];
				} catch (error) {
					if (!unavailable(error)) throw error;
					return [first];
				}
			} catch (error) {
				if (!unavailable(error)) throw error;
				log("warn", "parda schedule series unavailable", { id, ...errorFields(error) });
				return [];
			}
		}),
	);
	return { imageBase: catalog.services.tmdb.config.imageBase, entries: perSeries.flat() };
}
