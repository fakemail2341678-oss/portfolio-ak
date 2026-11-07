import "@tanstack/react-start/server-only";
import { and, asc, count, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import {
	type AdminSource,
	type AdminSourceStanding,
	SOURCE_QUALITIES,
	type SourceInput,
	type SourceStateInput,
} from "@/features/parda/admin/schema";
import { sourceFieldProblems, type TemplateProblem } from "@/features/parda/player/templates";
import { AppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { changes } from "@/server/audit/record";
import { notFound, withAudit } from "@/server/db/crud";
import { pdReport, pdSettings, pdSource } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { PardaSourceRow } from "../controls";
import { effectiveAdaptive, okOrder, RANKING } from "../player/ranking";
import { latestStandings, type SourceStanding } from "../player/stats";
import { type PardaAdminServices, saveVersioned } from "./context";

/**
 * /admin/parda/sources (PLAN Task 65, decision 0237): add, edit, delete, enable, pin and
 * reorder the rows the watch page plays from. A template is checked against its row's
 * origins when it's saved, and a problem comes back on its field. Every write is audited
 * and clears the controls' cache, so the watch page and the CSP follow at once. The list
 * shows each row's latest daily standing and its place in today's order (decision 0238).
 */

const WHAT = "Parda source";

const PROBLEM_MESSAGES: Readonly<Record<TemplateProblem, () => string>> = {
	"not-https": m.pd_admin_source_problem_not_https,
	"origin-not-listed": m.pd_admin_source_problem_origin,
	"unknown-token": m.pd_admin_source_problem_token,
	"invalid-origin": m.pd_admin_source_problem_invalid_origin,
};

function checkTemplates(input: Pick<SourceInput, "movieTemplate" | "tvTemplate" | "origins">) {
	const problems = Object.entries(sourceFieldProblems(input));
	if (problems.length === 0) return;
	throw new AppError("BAD_REQUEST", `${WHAT}: templates refused`, {
		fieldErrors: Object.fromEntries(
			problems.map(([field, problem]) => [field, [PROBLEM_MESSAGES[problem as TemplateProblem]()]]),
		),
	});
}

const fields = (input: SourceInput) => ({
	name: input.name,
	movieTemplate: input.movieTemplate,
	tvTemplate: input.tvTemplate,
	origins: [...new Set(input.origins)],
	adapter: input.adapter,
	sandbox: input.sandbox,
	adaptive: input.adaptive === "probe" ? null : input.adaptive === "yes",
	quality: input.quality === "probe" ? null : Number(input.quality),
	needsClick: input.needsClick,
	cdnGroup: input.cdnGroup || null,
	autoFallback: input.autoFallback,
	enabled: input.enabled,
	pinned: input.pinned,
});

const target = (row: Pick<PardaSourceRow, "id" | "name">) => ({
	type: "parda-source" as const,
	id: row.id,
	label: row.name.en,
});

/** What an edit's audit row shows: every field, the name by its English text. */
const summary = (row: PardaSourceRow) => ({
	name: row.name.en,
	nameNe: row.name.ne,
	movieTemplate: row.movieTemplate,
	tvTemplate: row.tvTemplate,
	origins: row.origins,
	adapter: row.adapter,
	sandbox: row.sandbox,
	adaptive: row.adaptive,
	quality: row.quality,
	needsClick: row.needsClick,
	cdnGroup: row.cdnGroup,
	autoFallback: row.autoFallback,
	enabled: row.enabled,
	pinned: row.pinned,
});
const COMPARED = [
	"name",
	"nameNe",
	"movieTemplate",
	"tvTemplate",
	"origins",
	"adapter",
	"sandbox",
	"adaptive",
	"quality",
	"needsClick",
	"cdnGroup",
	"autoFallback",
	"enabled",
	"pinned",
] as const satisfies ReadonlyArray<keyof ReturnType<typeof summary>>;

const ratio = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 1000 : null);

function standingOf(standing: SourceStanding | undefined): AdminSourceStanding | null {
	if (!standing) return null;
	return {
		day: standing.day,
		score: standing.score,
		from: standing.score === null ? null : standing.plays >= RANKING.minPlays ? "viewers" : "probe",
		plays: standing.plays,
		failureRate: ratio(standing.failed, standing.plays),
		startMedianMs: standing.startMedianMs,
		stallPerMinute: ratio(standing.stallMs / 1000, standing.watchedS / 60),
		popupsPerClick: ratio(standing.probePopups, standing.probeClicks),
		probeRuns: standing.probeRuns,
		probedAt: standing.probedAt?.toISOString() ?? null,
	};
}

const toAdmin = (
	row: PardaSourceRow,
	extra: {
		reports?: { open: number; ads: number } | undefined;
		standing?: SourceStanding | undefined;
		rank?: number | null;
	} = {},
): AdminSource => ({
	id: row.id,
	name: row.name,
	movieTemplate: row.movieTemplate,
	tvTemplate: row.tvTemplate,
	origins: row.origins,
	adapter: row.adapter,
	sandbox: row.sandbox,
	adaptive: row.adaptive === null ? "probe" : row.adaptive ? "yes" : "no",
	quality: SOURCE_QUALITIES.find((quality) => quality === String(row.quality)) ?? "probe",
	needsClick: row.needsClick,
	cdnGroup: row.cdnGroup ?? "",
	autoFallback: row.autoFallback,
	enabled: row.enabled,
	pinned: row.pinned,
	position: row.position,
	rank: extra.rank ?? null,
	updatedAt: String(row.version),
	openReports: extra.reports?.open ?? 0,
	adsReports: extra.reports?.ads ?? 0,
	height: row.quality ?? extra.standing?.probeHeight ?? null,
	heightFrom: row.quality !== null ? "admin" : extra.standing?.probeHeight ? "probe" : null,
	adaptiveNow: effectiveAdaptive(row.adaptive, extra.standing?.probeAdaptive),
	standing: standingOf(extra.standing),
});

/**
 * Every source in the admin's order, with its open reports, its latest standing and its
 * place in today's order (pinned first, then by score or by the admin's order). Read
 * fresh, not from the cache.
 */
export async function listSources({ db }: { db: Db }): Promise<AdminSource[]> {
	const [rows, reports, standings, [settings]] = await Promise.all([
		db.select().from(pdSource).orderBy(asc(pdSource.position), asc(pdSource.createdAt)),
		db
			.select({
				sourceId: pdReport.sourceId,
				open: count(),
				ads: sql<number>`count(*) filter (where ${pdReport.kind} = 'ads')`.mapWith(Number),
			})
			.from(pdReport)
			.where(and(eq(pdReport.status, "open"), isNotNull(pdReport.sourceId)))
			.groupBy(pdReport.sourceId),
		latestStandings(db),
		db.select({ sourceOrder: pdSettings.sourceOrder }).from(pdSettings).limit(1),
	]);
	const bySource = new Map(reports.map((row) => [row.sourceId, row]));
	const order = okOrder(
		rows
			.filter((row) => row.enabled)
			.map((row) => ({
				id: row.id,
				position: row.position,
				pinned: row.pinned,
				adaptive: false,
				score: standings.get(row.id)?.score ?? null,
				plays: standings.get(row.id)?.plays ?? 0,
				measurable: row.adapter !== "none",
			})),
		settings?.sourceOrder ?? "auto",
	);
	// `position` is the place in this order (the seed counts from 1, and gaps are harmless).
	return rows.map((row, index) => {
		const rank = order.indexOf(row.id);
		return {
			...toAdmin(row, {
				reports: bySource.get(row.id),
				standing: standings.get(row.id),
				rank: rank === -1 ? null : rank,
			}),
			position: index,
		};
	});
}

export async function getSource({ db }: { db: Db }, id: string): Promise<AdminSource> {
	const [[row], standings] = await Promise.all([
		db.select().from(pdSource).where(eq(pdSource.id, id)),
		latestStandings(db),
	]);
	if (!row) throw notFound(WHAT);
	return toAdmin(row, { standing: standings.get(id) });
}

/** A new source goes last. */
export async function createSource({ db, actor, controls }: PardaAdminServices, input: SourceInput) {
	checkTemplates(input);
	const created = await withAudit(db, actor, async (tx, audit) => {
		const [last] = await tx.select({ position: max(pdSource.position) }).from(pdSource);
		const [row] = await tx
			.insert(pdSource)
			.values({ ...fields(input), position: (last?.position ?? -1) + 1 })
			.returning();
		if (!row) throw notFound(WHAT);
		audit({ action: "parda.source.create", target: target(row), after: summary(row) });
		return row;
	});
	controls.invalidate();
	return toAdmin(created);
}

export async function updateSource(
	{ db, actor, controls }: PardaAdminServices,
	{ id, updatedAt, ...input }: SourceInput & { id: string; updatedAt: string },
): Promise<AdminSource> {
	checkTemplates(input);
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const [before] = await tx.select().from(pdSource).where(eq(pdSource.id, id));
		if (!before) throw notFound(WHAT);
		const row = await saveVersioned(tx, pdSource, { id, version: Number(updatedAt), set: fields(input), what: WHAT });
		const changed = changes(summary(before), summary(row), COMPARED);
		if (changed) audit({ action: "parda.source.update", target: target(row), ...changed });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}

/** Enable, disable, pin or unpin from the list: one UPDATE, last write wins, the version stays. */
export async function setSourceState(
	{ db, actor, controls }: PardaAdminServices,
	{ id, ...state }: SourceStateInput,
): Promise<AdminSource> {
	const set = {
		...(state.enabled === undefined ? {} : { enabled: state.enabled }),
		...(state.pinned === undefined ? {} : { pinned: state.pinned }),
	};
	const saved = await withAudit(db, actor, async (tx, audit) => {
		const [before] = await tx.select().from(pdSource).where(eq(pdSource.id, id)).for("update");
		if (!before) throw notFound(WHAT);
		if (Object.keys(set).length === 0) return before;
		const [row] = await tx.update(pdSource).set(set).where(eq(pdSource.id, id)).returning();
		if (!row) throw notFound(WHAT);
		const changed = changes(summary(before), summary(row), ["enabled", "pinned"]);
		if (changed) audit({ action: "parda.source.state", target: target(row), ...changed });
		return row;
	});
	controls.invalidate();
	return toAdmin(saved);
}

/** The whole order at once: every source, each once, or nothing changes. */
export async function reorderSources(
	{ db, actor, controls }: PardaAdminServices,
	ids: ReadonlyArray<string>,
): Promise<{ moved: number }> {
	const moved = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx.select({ id: pdSource.id, position: pdSource.position }).from(pdSource).for("update");
		const known = new Set(rows.map((row) => row.id));
		if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((id) => !known.has(id))) {
			throw new AppError("BAD_REQUEST", `${WHAT}: the order must list every source once`);
		}
		const current = new Map(rows.map((row) => [row.id, row.position]));
		let count = 0;
		for (const [position, id] of ids.entries()) {
			if (current.get(id) === position) continue;
			await tx.update(pdSource).set({ position }).where(eq(pdSource.id, id));
			count += 1;
		}
		if (count > 0) {
			audit({
				action: "parda.source.reorder",
				target: { type: "parda-source", id: "order" },
				after: { order: [...ids] },
			});
		}
		return count;
	});
	controls.invalidate();
	return { moved };
}

/** Deleted rows leave their plays and reports behind, with no source (`set null`). */
export async function deleteSources(
	{ db, actor, controls }: PardaAdminServices,
	ids: ReadonlyArray<string>,
): Promise<{ deleted: number }> {
	const deleted = await withAudit(db, actor, async (tx, audit) => {
		const rows = await tx
			.delete(pdSource)
			.where(inArray(pdSource.id, [...ids]))
			.returning();
		audit(
			...rows.map((row) => ({ action: "parda.source.delete" as const, target: target(row), before: summary(row) })),
		);
		return rows.length;
	});
	controls.invalidate();
	return { deleted };
}
