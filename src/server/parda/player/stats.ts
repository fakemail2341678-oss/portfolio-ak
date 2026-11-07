import "@tanstack/react-start/server-only";
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, max, or, sql } from "drizzle-orm";
import type { PardaMedia } from "@/server/db/schema";
import {
	type PardaStatBand,
	pdPlay,
	pdSource,
	pdSourceProbe,
	pdSourceStat,
	pdSourceTitleFail,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { RANKING, type SourceMeasures, scoreSource } from "./ranking";

/**
 * Source ranking's data (PLAN 12.5, decision 0238): the daily rollup of `pd_play` and
 * `pd_source_probe` into `pd_source_stat` with each source's score, the latest standings
 * the watch page and the admin read, and the per-title failures that skip a source.
 */

const DAY_MS = 86_400_000;
/** Rollups, probes and failures older than this are pruned by the daily job. */
const KEEP_DAYS = 35;
/** Two failures of a title within this skip the source for it this long. */
export const TITLE_FAIL_MS = DAY_MS;

export const utcDay = (at: Date) => at.toISOString().slice(0, 10);

export type SourceStanding = typeof pdSourceStat.$inferSelect;

const int = (value: unknown) => sql<number>`(${value})::int`;
const num = (value: unknown) => sql<number>`coalesce(${value}, 0)::float8`;

/** Every source's plays in the window, per band and in all (`grouping sets`). Party plays never count. */
function playAggregates(db: Db, since: Date, until: Date) {
	return db
		.select({
			sourceId: pdPlay.sourceId,
			band: sql<PardaStatBand>`case when grouping(${pdPlay.band}) = 1 then 'all' else ${pdPlay.band} end`,
			plays: int(sql`count(*)`),
			failed: int(sql`count(*) filter (where ${pdPlay.failed})`),
			switchedAway: int(sql`count(*) filter (where ${pdPlay.switchedAway})`),
			startMedianMs: sql<number | null>`round(percentile_cont(0.5) within group (order by ${pdPlay.startMs}))::int`,
			startP90Ms: sql<number | null>`round(percentile_cont(0.9) within group (order by ${pdPlay.startMs}))::int`,
			stallCount: int(sql`coalesce(sum(${pdPlay.stallCount}), 0)`),
			stallMs: num(sql`sum(${pdPlay.stallMs})`),
			watchedS: num(sql`sum(${pdPlay.watchedS})`),
		})
		.from(pdPlay)
		.where(
			and(
				gte(pdPlay.createdAt, since),
				lt(pdPlay.createdAt, until),
				isNotNull(pdPlay.sourceId),
				eq(pdPlay.inParty, false),
			),
		)
		.groupBy(sql`grouping sets ((${pdPlay.sourceId}, ${pdPlay.band}), (${pdPlay.sourceId}))`);
}

/** The probe's runs in the window, per source. */
function probeAggregates(db: Db, since: Date, until: Date) {
	return db
		.select({
			sourceId: pdSourceProbe.sourceId,
			runs: int(sql`count(*)`),
			alive: int(sql`count(*) filter (where ${pdSourceProbe.alive})`),
			height: sql<number | null>`max(${pdSourceProbe.topHeight}) filter (where ${pdSourceProbe.alive})`,
			// A ladder of more than one height is adaptive; no ladder seen says nothing.
			adaptive: sql<
				boolean | null
			>`bool_or(jsonb_array_length(${pdSourceProbe.ladder}) > 1) filter (where jsonb_array_length(${pdSourceProbe.ladder}) > 0)`,
			popups: int(sql`coalesce(sum(${pdSourceProbe.popups}), 0)`),
			clicks: int(sql`coalesce(sum(${pdSourceProbe.clicks}), 0)`),
			probedAt: max(pdSourceProbe.createdAt),
		})
		.from(pdSourceProbe)
		.where(and(gte(pdSourceProbe.createdAt, since), lt(pdSourceProbe.createdAt, until)))
		.groupBy(pdSourceProbe.sourceId);
}

export type RollupResult = { day: string; sources: number; scored: number };

/**
 * The daily rollup (`GET /api/cron/parda`): the last 7 days per source and band, the
 * probe's numbers and the score, as today's rows. Running it again the same day replaces
 * them. Old rollups, probes and spent failures are pruned.
 */
export async function rollupSources(db: Db, now = new Date()): Promise<RollupResult> {
	const since = new Date(now.getTime() - RANKING.windowDays * DAY_MS);
	const day = utcDay(now);
	const [sources, plays, probes] = await Promise.all([
		db.select({ id: pdSource.id, adapter: pdSource.adapter, quality: pdSource.quality }).from(pdSource),
		playAggregates(db, since, now),
		probeAggregates(db, since, now),
	]);
	const playsOf = new Map(plays.map((row) => [`${row.sourceId}:${row.band}`, row]));
	const probeOf = new Map(probes.map((row) => [row.sourceId, row]));

	let scored = 0;
	const rows: Array<typeof pdSourceStat.$inferInsert> = [];
	for (const source of sources) {
		const all = playsOf.get(`${source.id}:all`);
		const probe = probeOf.get(source.id);
		const measures: SourceMeasures = {
			adapter: source.adapter,
			plays: all?.plays ?? 0,
			failed: all?.failed ?? 0,
			startMedianMs: all?.startMedianMs ?? null,
			stallMs: all?.stallMs ?? 0,
			watchedS: all?.watchedS ?? 0,
			probeRuns: probe?.runs ?? 0,
			probeAlive: probe?.alive ?? 0,
			probeHeight: probe?.height ?? null,
			probePopups: probe?.popups ?? 0,
			probeClicks: probe?.clicks ?? 0,
			quality: source.quality,
		};
		const score = scoreSource(measures);
		if (score !== null) scored += 1;
		const measured = (band: PardaStatBand) => {
			const row = playsOf.get(`${source.id}:${band}`);
			return {
				plays: row?.plays ?? 0,
				failed: row?.failed ?? 0,
				switchedAway: row?.switchedAway ?? 0,
				startMedianMs: row?.startMedianMs ?? null,
				startP90Ms: row?.startP90Ms ?? null,
				stallCount: row?.stallCount ?? 0,
				stallMs: Math.round(row?.stallMs ?? 0),
				watchedS: Math.round(row?.watchedS ?? 0),
			};
		};
		rows.push({
			day,
			sourceId: source.id,
			band: "all",
			...measured("all"),
			probeRuns: probe?.runs ?? 0,
			probeAlive: probe?.alive ?? 0,
			probeHeight: probe?.height ?? null,
			probeAdaptive: probe?.adaptive ?? null,
			probePopups: probe?.popups ?? 0,
			probeClicks: probe?.clicks ?? 0,
			probedAt: probe?.probedAt ?? null,
			score,
		});
		for (const band of ["slow", "ok", "unknown"] as const) {
			if (playsOf.has(`${source.id}:${band}`)) rows.push({ day, sourceId: source.id, band, ...measured(band) });
		}
	}

	const keepFrom = new Date(now.getTime() - KEEP_DAYS * DAY_MS);
	await db.transaction(async (tx) => {
		await tx.delete(pdSourceStat).where(eq(pdSourceStat.day, day));
		if (rows.length) await tx.insert(pdSourceStat).values(rows);
		await tx.delete(pdSourceStat).where(lt(pdSourceStat.day, utcDay(keepFrom)));
		await tx.delete(pdSourceProbe).where(lt(pdSourceProbe.createdAt, keepFrom));
		await tx
			.delete(pdSourceTitleFail)
			.where(
				and(
					lt(pdSourceTitleFail.firstAt, new Date(now.getTime() - TITLE_FAIL_MS)),
					or(isNull(pdSourceTitleFail.skipUntil), lt(pdSourceTitleFail.skipUntil, now)),
				),
			);
	});
	return { day, sources: sources.length, scored };
}

/** Each source's latest `all` row: the newest day the rollup ran. A source added since has none. */
export async function latestStandings(db: Db): Promise<Map<string, SourceStanding>> {
	const rows = await db
		.select()
		.from(pdSourceStat)
		.where(
			and(
				eq(pdSourceStat.band, "all"),
				eq(pdSourceStat.day, sql`(select max(${pdSourceStat.day}) from ${pdSourceStat})`),
			),
		);
	return new Map(rows.map((row) => [row.sourceId, row]));
}

export type TitleFailure = { sourceId: string; media: PardaMedia; tmdbId: number };

/**
 * A failed playback of a title (PLAN 12.5, "At click"). A failure from someone other than
 * the first reporter within 24 h skips the source for that title for 24 h; the same client
 * failing again changes nothing, so one client can't hide a source.
 */
export async function noteTitleFailure(db: Db, failure: TitleFailure, client: string, now = new Date()) {
	const stale = new Date(now.getTime() - TITLE_FAIL_MS);
	const until = new Date(now.getTime() + TITLE_FAIL_MS);
	const fail = pdSourceTitleFail;
	const restarts = sql`${fail.firstAt} <= ${stale.toISOString()}::timestamptz`;
	const other = sql`${fail.firstClient} <> excluded.first_client`;
	await db
		.insert(fail)
		.values({ ...failure, failures: 1, firstAt: now, firstClient: client })
		.onConflictDoUpdate({
			target: [fail.media, fail.tmdbId, fail.sourceId],
			set: {
				// Postgres reads the old row in every expression, so their order doesn't matter.
				failures: sql`case when ${restarts} then 1 when ${other} then ${fail.failures} + 1 else ${fail.failures} end`,
				skipUntil: sql`case when not (${restarts}) and ${other} then ${until.toISOString()}::timestamptz else ${fail.skipUntil} end`,
				firstClient: sql`case when ${restarts} then excluded.first_client else ${fail.firstClient} end`,
				firstAt: sql`case when ${restarts} then excluded.first_at else ${fail.firstAt} end`,
			},
		});
}

/** The sources skipped for this title now. */
export async function skippedSources(
	db: Db,
	title: { media: PardaMedia; tmdbId: number },
	sourceIds: ReadonlyArray<string>,
	now = new Date(),
): Promise<Set<string>> {
	if (sourceIds.length === 0) return new Set();
	const rows = await db
		.select({ sourceId: pdSourceTitleFail.sourceId })
		.from(pdSourceTitleFail)
		.where(
			and(
				eq(pdSourceTitleFail.media, title.media),
				eq(pdSourceTitleFail.tmdbId, title.tmdbId),
				inArray(pdSourceTitleFail.sourceId, [...sourceIds]),
				gt(pdSourceTitleFail.skipUntil, now),
			),
		);
	return new Set(rows.map((row) => row.sourceId));
}
