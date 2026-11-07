import "@tanstack/react-start/server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { withinCap } from "@/features/parda/kids";
import { CONTINUE_MAX_AGE_MS } from "@/features/parda/library/progress";
import { isAppError } from "@/lib/errors";
import { todayInZone } from "@/lib/i18n/date-only";
import {
	type PardaNotificationData,
	pdFollowState,
	pdListItem,
	pdNotification,
	pdProfile,
	pdProgress,
	pdTitle,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { type PardaControls, titleKey } from "../controls";
import type { Tmdb } from "../tmdb/client";
import { dateOf, parse } from "../tmdb/mappers";
import { isDue, isEnded, type NewEpisodes, newEpisodes, paced } from "./rules";

/**
 * The daily new-episode check (PLAN Task 68, decision 0241). Every series some profile
 * follows (My List, ♥, or played or marked in the last six months) is asked of TMDB once
 * (a series TMDB says ended, once a week), under 40 requests a second. When its latest
 * aired episode moved past what `pd_follow_state` last saw, every profile following it
 * gets one `pd_notification` for the new range, in the transaction that moves the state.
 */

/** At most this many series a run, the longest unchecked first: the rest wait a day. */
export const CHECK_MAX = 1_500;
/** Under TMDB's ~40 a second (PLAN 12.4), with room for the pages being served meanwhile. */
const PER_SECOND = 35;
const CONCURRENCY = 7;
/** TMDB failing this many in a row is TMDB down: the run stops and tries again tomorrow. */
const FAILURES_TO_STOP = 10;
/** A state no follower kept checked for this long is dropped (its series is followed by nobody now). */
const STATE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
/** Old alerts go; the bell shows the latest anyway. */
export const NOTIFICATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const episodeSchema = z
	.object({
		season_number: z.number(),
		episode_number: z.number(),
		name: z.string().nullish(),
		air_date: z.string().nullish(),
	})
	.nullish();
const airingSchema = z.object({
	name: z.string().nullish(),
	poster_path: z.string().nullish(),
	backdrop_path: z.string().nullish(),
	status: z.string().nullish(),
	last_episode_to_air: episodeSchema,
	next_episode_to_air: episodeSchema,
});

type Airing = {
	title: string;
	poster: string | null;
	backdrop: string | null;
	ended: boolean;
	latest: { season: number; episode: number; name: string; airDate: string | null } | null;
	nextAirDate: string | null;
};

/** One request per series, in English, with no appends: only what the check needs. */
async function airing(tmdb: Tmdb, id: number): Promise<Airing> {
	const raw = parse(airingSchema, await tmdb.get(`tv/${id}`, { language: "en-US" }), "airing");
	const last = raw.last_episode_to_air;
	return {
		title: raw.name ?? "",
		poster: raw.poster_path ?? null,
		backdrop: raw.backdrop_path ?? null,
		ended: isEnded(raw.status ?? null),
		latest: last
			? {
					season: last.season_number,
					episode: last.episode_number,
					name: last.name ?? "",
					airDate: dateOf(last.air_date),
				}
			: null,
		nextAirDate: dateOf(raw.next_episode_to_air?.air_date),
	};
}

/** The series followed by some profile, each once. */
async function followedSeries(db: Db, since: Date): Promise<number[]> {
	const [listed, played] = await Promise.all([
		db.selectDistinct({ id: pdListItem.tmdbId }).from(pdListItem).where(eq(pdListItem.media, "tv")),
		db
			.selectDistinct({ id: pdProgress.tmdbId })
			.from(pdProgress)
			.where(and(eq(pdProgress.media, "tv"), gte(pdProgress.updatedAt, since))),
	]);
	return [...new Set([...listed, ...played].map((row) => row.id))];
}

/** The profiles following series `id` now, with what decides whether they're told. */
async function followersOf(db: Db | Tx, id: number, since: Date) {
	const follows = sql`(exists (select 1 from ${pdListItem} where ${pdListItem.profileId} = ${pdProfile.id} and ${pdListItem.media} = 'tv' and ${pdListItem.tmdbId} = ${id})
		or exists (select 1 from ${pdProgress} where ${pdProgress.profileId} = ${pdProfile.id} and ${pdProgress.media} = 'tv' and ${pdProgress.tmdbId} = ${id} and ${pdProgress.updatedAt} >= ${since.toISOString()}))`;
	return db.select({ id: pdProfile.id, kids: pdProfile.kids, cap: pdProfile.cap }).from(pdProfile).where(follows);
}

/** Profiles that already finished the range's last episode (they watched it before the check came). */
async function alreadyWatched(db: Db | Tx, ids: string[], id: number, range: NewEpisodes): Promise<Set<string>> {
	if (ids.length === 0) return new Set();
	const rows = await db
		.select({ profileId: pdProgress.profileId })
		.from(pdProgress)
		.where(
			and(
				inArray(pdProgress.profileId, ids),
				eq(pdProgress.media, "tv"),
				eq(pdProgress.tmdbId, id),
				eq(pdProgress.season, range.season),
				eq(pdProgress.episode, range.lastEpisode),
				eq(pdProgress.finished, true),
			),
		);
	return new Set(rows.map((row) => row.profileId));
}

export type CheckResult = { followed: number; checked: number; alerts: number; failed: number; stopped: boolean };

export async function checkNewEpisodes(
	db: Db,
	tmdb: Tmdb,
	controls: PardaControls,
	{ now = new Date(), sleep }: { now?: Date; sleep?: (ms: number) => Promise<void> } = {},
): Promise<CheckResult> {
	const since = new Date(now.getTime() - CONTINUE_MAX_AGE_MS);
	const [followed, states, blocked, settings, certificates] = await Promise.all([
		followedSeries(db, since),
		db.select().from(pdFollowState),
		controls.blocked(),
		controls.settings(),
		controls.certifications(),
	]);
	const stateOf = new Map(states.map((state) => [state.tmdbId, state]));
	const due = followed
		.filter((id) => !blocked.has(titleKey("tv", id)) && isDue(stateOf.get(id), now))
		.sort((a, b) => (stateOf.get(a)?.checkedAt.getTime() ?? 0) - (stateOf.get(b)?.checkedAt.getTime() ?? 0))
		.slice(0, CHECK_MAX);
	const adminCap = "kidsCap" in settings ? settings.kidsCap : "PG";
	// Air dates are the airing country's; UTC's day is as fair as any for "how long ago".
	const today = todayInZone("UTC", now);
	const result: CheckResult = { followed: followed.length, checked: 0, alerts: 0, failed: 0, stopped: false };
	let failuresInARow = 0;

	await paced(
		due,
		async (id) => {
			let series: Airing;
			try {
				series = await airing(tmdb, id);
				failuresInARow = 0;
			} catch (error) {
				if (isAppError(error) && error.code === "NOT_FOUND") {
					// Gone from TMDB: nothing more will air; looked at again weekly.
					series = { title: "", poster: null, backdrop: null, ended: true, latest: null, nextAirDate: null };
				} else {
					result.failed++;
					failuresInARow++;
					log("warn", "parda episode check failed", { id, ...errorFields(error) });
					return;
				}
			}
			const state = stateOf.get(id);
			const seen =
				state && state.lastSeason !== null && state.lastEpisode !== null
					? { season: state.lastSeason, episode: state.lastEpisode }
					: null;
			// The first check (no state) only records where the series is.
			const range = state ? newEpisodes(seen ?? { season: 0, episode: 0 }, series.latest, today) : null;
			const latest = series.latest;
			const next = {
				lastSeason: latest?.season ?? state?.lastSeason ?? null,
				lastEpisode: latest?.episode ?? state?.lastEpisode ?? null,
				lastAirDate: latest?.airDate ?? state?.lastAirDate ?? null,
				nextAirDate: series.nextAirDate,
				ended: series.ended,
				checkedAt: now,
			};
			await db.transaction(async (tx) => {
				await tx
					.insert(pdFollowState)
					.values({ tmdbId: id, ...next })
					.onConflictDoUpdate({ target: pdFollowState.tmdbId, set: next });
				if (!range || !latest) return;
				const followers = await followersOf(tx, id, since);
				const certificate = certificates.get(titleKey("tv", id));
				const allowed = followers.filter(
					(profile) => !profile.kids || withinCap(profile.cap ?? adminCap, "tv", certificate),
				);
				const watched = await alreadyWatched(
					tx,
					allowed.map((profile) => profile.id),
					id,
					range,
				);
				const recipients = allowed.filter((profile) => !watched.has(profile.id));
				if (recipients.length === 0) return;
				const [snapshot] = await tx
					.select({ title: pdTitle.title })
					.from(pdTitle)
					.where(and(eq(pdTitle.media, "tv"), eq(pdTitle.tmdbId, id)));
				const data: PardaNotificationData = {
					title: { en: series.title, ne: snapshot?.title.ne || series.title },
					poster: series.poster,
					backdrop: series.backdrop,
					name: latest.name,
					airDate: latest.airDate,
				};
				const inserted = await tx
					.insert(pdNotification)
					.values(recipients.map((profile) => ({ profileId: profile.id, tmdbId: id, ...range, data })))
					.onConflictDoNothing()
					.returning({ id: pdNotification.id });
				result.alerts += inserted.length;
			});
			result.checked++;
		},
		{
			perSecond: PER_SECOND,
			concurrency: CONCURRENCY,
			stop: () => {
				if (failuresInARow < FAILURES_TO_STOP) return false;
				result.stopped = true;
				return true;
			},
			...(sleep ? { sleep } : {}),
		},
	);

	// Housekeeping: states nobody kept checked, and alerts past their use.
	await db.delete(pdFollowState).where(lt(pdFollowState.checkedAt, new Date(now.getTime() - STATE_MAX_AGE_MS)));
	await db
		.delete(pdNotification)
		.where(lt(pdNotification.createdAt, new Date(now.getTime() - NOTIFICATION_MAX_AGE_MS)));
	return result;
}
