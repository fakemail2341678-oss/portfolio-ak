import "@tanstack/react-start/server-only";
import { eq, sql } from "drizzle-orm";
import type { PardaBand, PardaReportKind, PardaViewerKind } from "@/features/parda/player/playback";
import { AppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import { pdPlay, pdReport } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { PardaControls } from "../controls";
import { titleKey } from "../controls";

/**
 * Playbacks and reports (PLAN 12.5, "pd_play"; decision 0236). A playback's row is
 * written when its player first moves, failed or was left, and updated as it goes: the
 * page makes its id. Counters only grow, so a late or repeated report can't undo one.
 * A playback that has just failed is reported back, so it can count against its source
 * on this title (decision 0238).
 */

export type PlayReport = {
	playbackId: string;
	sourceId: string;
	media: PardaMedia;
	id: number;
	season?: number | undefined;
	episode?: number | undefined;
	failed: boolean;
	failReason?: string | undefined;
	startMs: number | null;
	stallCount: number;
	stallMs: number;
	watchedS: number;
	switchedAway: boolean;
	band: PardaBand;
	/** Party plays never count for ranking: the source is forced and pauses are shared. */
	inParty?: boolean | undefined;
};

/** A source that's gone (deleted, or never one) keeps the row with no source: the play still counts for nothing. */
async function knownSource(controls: PardaControls, sourceId: string) {
	return (await controls.sources()).some((source) => source.id === sourceId) ? sourceId : null;
}

/** `failedNow`: this report turned the playback failed, from a source that still exists. */
export async function recordPlay(
	db: Db,
	controls: PardaControls,
	viewerKind: PardaViewerKind,
	report: PlayReport,
	viewerKey: string | null = null,
): Promise<{ failedNow: boolean; sourceId: string | null }> {
	const sourceId = await knownSource(controls, report.sourceId);
	const values = {
		id: report.playbackId,
		viewerKind,
		viewerKey,
		sourceId,
		media: report.media,
		tmdbId: report.id,
		season: report.media === "tv" ? (report.season ?? null) : null,
		episode: report.media === "tv" ? (report.episode ?? null) : null,
		failed: report.failed,
		failReason: report.failReason ?? null,
		startMs: report.startMs,
		stallCount: report.stallCount,
		stallMs: report.stallMs,
		watchedS: report.watchedS,
		switchedAway: report.switchedAway,
		band: report.band,
		inParty: report.inParty ?? false,
	};
	return db.transaction(async (tx) => {
		const [before] = await tx
			.select({ failed: pdPlay.failed, tmdbId: pdPlay.tmdbId, sourceId: pdPlay.sourceId })
			.from(pdPlay)
			.where(eq(pdPlay.id, report.playbackId));
		// Someone else's id (another title or source) changes nothing below, so it can't count either.
		const ours = !before || (before.tmdbId === report.id && before.sourceId === sourceId);
		await tx
			.insert(pdPlay)
			.values(values)
			.onConflictDoUpdate({
				target: pdPlay.id,
				set: {
					failed: sql`${pdPlay.failed} or excluded.failed`,
					failReason: sql`coalesce(excluded.fail_reason, ${pdPlay.failReason})`,
					startMs: sql`coalesce(${pdPlay.startMs}, excluded.start_ms)`,
					stallCount: sql`greatest(${pdPlay.stallCount}, excluded.stall_count)`,
					stallMs: sql`greatest(${pdPlay.stallMs}, excluded.stall_ms)`,
					watchedS: sql`greatest(${pdPlay.watchedS}, excluded.watched_s)`,
					switchedAway: sql`${pdPlay.switchedAway} or excluded.switched_away`,
				},
				// The row's title and source never change: a report naming others is someone else's id.
				setWhere: sql`${pdPlay.tmdbId} = excluded.tmdb_id and ${pdPlay.sourceId} is not distinct from excluded.source_id`,
			});
		return { failedNow: ours && report.failed && !before?.failed && sourceId !== null, sourceId };
	});
}

export type ProblemReport = {
	kind: PardaReportKind;
	media: PardaMedia;
	id: number;
	season?: number | undefined;
	episode?: number | undefined;
	sourceId: string | null;
	note: string;
};

export async function reportProblem(
	db: Db,
	controls: PardaControls,
	reporterId: string | null,
	report: ProblemReport,
): Promise<{ id: string }> {
	if ((await controls.blocked()).has(titleKey(report.media, report.id))) {
		throw new AppError("NOT_FOUND", "Title not found");
	}
	const sourceId = report.sourceId ? await knownSource(controls, report.sourceId) : null;
	const [row] = await db
		.insert(pdReport)
		.values({
			kind: report.kind,
			media: report.media,
			tmdbId: report.id,
			season: report.media === "tv" ? (report.season ?? null) : null,
			episode: report.media === "tv" ? (report.episode ?? null) : null,
			sourceId,
			note: report.note.trim(),
			reporterId,
		})
		.returning({ id: pdReport.id });
	if (!row) throw new AppError("INTERNAL", "Report not saved");
	return row;
}
