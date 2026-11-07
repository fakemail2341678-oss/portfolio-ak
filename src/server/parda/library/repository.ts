import "@tanstack/react-start/server-only";
import { and, desc, eq, gt, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import type { EpisodeKey } from "@/features/parda/library/progress";
import type { PardaMedia } from "@/server/db/schema";
import { pdContinueState, pdProgress } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Progress rows and the Continue watching state (decision 0236). Every query is scoped to
 * one profile (`ownedByProfile`); the service resolved that profile from the session.
 */

export type ProgressDbRow = typeof pdProgress.$inferSelect;

export const ownedByProfile = (profileId: string) => eq(pdProgress.profileId, profileId);

const title = (media: PardaMedia, id: number) => and(eq(pdProgress.media, media), eq(pdProgress.tmdbId, id));

/** A report reaches the row at most this often; finishing, or another source, always does (PLAN 12.5). */
export const SAVE_THROTTLE_SECONDS = 10;

export type ProgressWrite = {
	media: PardaMedia;
	tmdbId: number;
	season: number | null;
	episode: number | null;
	watched: number;
	duration: number | null;
	sourceId: string | null;
	finished: boolean;
};

const conflictTarget = [
	pdProgress.profileId,
	pdProgress.media,
	pdProgress.tmdbId,
	pdProgress.season,
	pdProgress.episode,
];

/**
 * The player's report, upserted and throttled inside the statement: a row written less
 * than 10 s ago keeps its values unless this report finishes it or comes from another
 * source. The latest report decides `finished`, so replaying a finished episode from the
 * start makes it a resume again. True when the row changed.
 */
export async function upsertProgress(db: Db | Tx, profileId: string, write: ProgressWrite): Promise<boolean> {
	const rows = await db
		.insert(pdProgress)
		.values({ profileId, ...write })
		.onConflictDoUpdate({
			target: conflictTarget,
			set: {
				watched: sql`excluded.watched`,
				duration: sql`coalesce(excluded.duration, ${pdProgress.duration})`,
				sourceId: sql`excluded.source_id`,
				finished: sql`excluded.finished`,
				marked: false,
				updatedAt: sql`now()`,
			},
			setWhere: sql`${pdProgress.updatedAt} < now() - make_interval(secs => ${SAVE_THROTTLE_SECONDS})
				or excluded.finished <> ${pdProgress.finished}
				or excluded.source_id is distinct from ${pdProgress.sourceId}`,
		})
		.returning({ id: pdProgress.id });
	return rows.length > 0;
}

/** Progress kept in a browser, brought in once a session starts: only where it's newer than ours. */
export async function importProgress(
	db: Db | Tx,
	profileId: string,
	writes: ReadonlyArray<ProgressWrite & { updatedAt: Date }>,
): Promise<number> {
	let imported = 0;
	for (const write of writes) {
		const rows = await db
			.insert(pdProgress)
			.values({ profileId, ...write })
			.onConflictDoUpdate({
				target: conflictTarget,
				set: {
					watched: sql`excluded.watched`,
					duration: sql`coalesce(excluded.duration, ${pdProgress.duration})`,
					finished: sql`excluded.finished`,
					marked: false,
					updatedAt: sql`excluded.updated_at`,
				},
				setWhere: sql`excluded.updated_at > ${pdProgress.updatedAt}`,
			})
			.returning({ id: pdProgress.id });
		imported += rows.length;
	}
	return imported;
}

export async function continueState(db: Db | Tx, profileId: string, media: PardaMedia, id: number) {
	const [row] = await db
		.select()
		.from(pdContinueState)
		.where(
			and(eq(pdContinueState.profileId, profileId), eq(pdContinueState.media, media), eq(pdContinueState.tmdbId, id)),
		)
		.limit(1);
	return row ?? null;
}

/** Rows that still count for a title: those after its *Rewatch*, if any. */
export async function titleRows(db: Db | Tx, profileId: string, media: PardaMedia, id: number) {
	const state = await continueState(db, profileId, media, id);
	const filters: SQL[] = [ownedByProfile(profileId)];
	const scope = title(media, id);
	if (scope) filters.push(scope);
	if (state?.rewatchAt) filters.push(gt(pdProgress.updatedAt, state.rewatchAt));
	return db
		.select()
		.from(pdProgress)
		.where(and(...filters))
		.orderBy(desc(pdProgress.updatedAt));
}

/**
 * The titles touched since `since`, latest first, at most `limit`, minus those *Remove*
 * hid after their last play; with each title's rows that still count.
 */
export async function recentTitles(db: Db | Tx, profileId: string, since: Date, limit: number) {
	const latest = sql<Date>`max(${pdProgress.updatedAt})`;
	const titles = await db
		.select({ media: pdProgress.media, tmdbId: pdProgress.tmdbId, at: latest })
		.from(pdProgress)
		.leftJoin(
			pdContinueState,
			and(
				eq(pdContinueState.profileId, pdProgress.profileId),
				eq(pdContinueState.media, pdProgress.media),
				eq(pdContinueState.tmdbId, pdProgress.tmdbId),
			),
		)
		.where(
			and(
				ownedByProfile(profileId),
				gt(pdProgress.updatedAt, since),
				or(isNull(pdContinueState.rewatchAt), gt(pdProgress.updatedAt, pdContinueState.rewatchAt)),
			),
		)
		.groupBy(pdProgress.media, pdProgress.tmdbId, pdContinueState.hiddenAt)
		.having(or(isNull(pdContinueState.hiddenAt), sql`${latest} > ${pdContinueState.hiddenAt}`))
		.orderBy(desc(latest))
		.limit(limit);
	if (titles.length === 0) return [];
	const ids = [...new Set(titles.map((row) => row.tmdbId))];
	const rows = await db
		.select()
		.from(pdProgress)
		.leftJoin(
			pdContinueState,
			and(
				eq(pdContinueState.profileId, pdProgress.profileId),
				eq(pdContinueState.media, pdProgress.media),
				eq(pdContinueState.tmdbId, pdProgress.tmdbId),
			),
		)
		.where(
			and(
				ownedByProfile(profileId),
				inArray(pdProgress.tmdbId, ids),
				or(isNull(pdContinueState.rewatchAt), gt(pdProgress.updatedAt, pdContinueState.rewatchAt)),
			),
		);
	return titles.map((each) => ({
		media: each.media,
		tmdbId: each.tmdbId,
		rows: rows.map((row) => row.pd_progress).filter((row) => row.media === each.media && row.tmdbId === each.tmdbId),
	}));
}

const upsertState = (
	db: Db | Tx,
	profileId: string,
	media: PardaMedia,
	id: number,
	set: { hiddenAt?: Date; rewatchAt?: Date },
) =>
	db
		.insert(pdContinueState)
		.values({ profileId, media, tmdbId: id, ...set })
		.onConflictDoUpdate({ target: [pdContinueState.profileId, pdContinueState.media, pdContinueState.tmdbId], set });

/** *Remove*: off the rail until it's played again. */
export const hideTitle = (db: Db | Tx, profileId: string, media: PardaMedia, id: number, now = new Date()) =>
	upsertState(db, profileId, media, id, { hiddenAt: now });

/** *Rewatch*: our record starts over (the player's own memory is its business). */
export const rewatchTitle = (db: Db | Tx, profileId: string, media: PardaMedia, id: number, now = new Date()) =>
	upsertState(db, profileId, media, id, { rewatchAt: now });

/** Marks episodes (or the movie, with no keys) watched: finished, by a mark. */
export async function markWatched(
	db: Db | Tx,
	profileId: string,
	media: PardaMedia,
	id: number,
	keys: ReadonlyArray<EpisodeKey> | null,
) {
	const values = (keys ?? [{ season: null, episode: null }]).map((key) => ({
		profileId,
		media,
		tmdbId: id,
		season: key.season,
		episode: key.episode,
		finished: true,
		marked: true,
	}));
	for (let at = 0; at < values.length; at += 500) {
		await db
			.insert(pdProgress)
			.values(values.slice(at, at + 500))
			.onConflictDoUpdate({
				target: conflictTarget,
				set: {
					finished: true,
					marked: true,
					watched: sql`coalesce(${pdProgress.duration}, ${pdProgress.watched})`,
					updatedAt: sql`now()`,
				},
			});
	}
}

/** Marks episodes (or the movie, or a whole series with `keys` null on a series) unwatched: their rows go. */
export async function markUnwatched(
	db: Db | Tx,
	profileId: string,
	media: PardaMedia,
	id: number,
	keys: ReadonlyArray<EpisodeKey> | null,
) {
	const scope = title(media, id);
	const base = [ownedByProfile(profileId), ...(scope ? [scope] : [])];
	if (keys === null) {
		await db.delete(pdProgress).where(and(...base));
		return;
	}
	const seasons = new Map<number, number[]>();
	for (const key of keys) seasons.set(key.season, [...(seasons.get(key.season) ?? []), key.episode]);
	for (const [season, episodes] of seasons) {
		await db
			.delete(pdProgress)
			.where(and(...base, eq(pdProgress.season, season), inArray(pdProgress.episode, episodes)));
	}
}

/** Moves every row of one profile to another (a guest's claim): where both have a row, the later one wins. */
export async function mergeProfiles(tx: Tx, fromProfileId: string, toProfileId: string) {
	await tx.execute(sql`
		insert into ${pdProgress} (profile_id, media, tmdb_id, season, episode, watched, duration, source_id, finished, marked, updated_at)
		select ${toProfileId}, media, tmdb_id, season, episode, watched, duration, source_id, finished, marked, updated_at
		from ${pdProgress} where profile_id = ${fromProfileId}
		on conflict (profile_id, media, tmdb_id, season, episode) do update set
			watched = excluded.watched, duration = excluded.duration, source_id = excluded.source_id,
			finished = excluded.finished, marked = excluded.marked, updated_at = excluded.updated_at
		where excluded.updated_at > ${pdProgress}.updated_at`);
	await tx.execute(sql`
		insert into ${pdContinueState} (profile_id, media, tmdb_id, hidden_at, rewatch_at)
		select ${toProfileId}, media, tmdb_id, hidden_at, rewatch_at
		from ${pdContinueState} where profile_id = ${fromProfileId}
		on conflict (profile_id, media, tmdb_id) do update set
			hidden_at = greatest(${pdContinueState}.hidden_at, excluded.hidden_at),
			rewatch_at = greatest(${pdContinueState}.rewatch_at, excluded.rewatch_at)`);
}
