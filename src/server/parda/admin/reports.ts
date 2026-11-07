import "@tanstack/react-start/server-only";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { AdminReport, AdminReportPage, ReportStatusInput } from "@/features/parda/admin/schema";
import type { PardaReportListInput } from "@/features/parda/admin/search";
import type { Localized } from "@/lib/i18n/localized";
import { listPage, withAudit } from "@/server/db/crud";
import { allOf, textSearch } from "@/server/db/list";
import { pdReport, pdSource, pdTitle } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Services } from "@/server/services";
import { userNames } from "./takedowns";

/**
 * /admin/parda/reports (PLAN Task 65, decision 0237): what viewers sent with *Report a
 * problem*, filtered by status, kind and source, resolved or dismissed one at a time or
 * in bulk. One audit row per report that changed.
 */

type Row = typeof pdReport.$inferSelect;

async function toAdmin(db: Db, rows: ReadonlyArray<Row>): Promise<AdminReport[]> {
	const sourceIds = [...new Set(rows.flatMap((row) => (row.sourceId ? [row.sourceId] : [])))];
	const [titles, sources, people] = await Promise.all([
		rows.length
			? db
					.select({ media: pdTitle.media, id: pdTitle.tmdbId, title: pdTitle.title })
					.from(pdTitle)
					.where(or(...rows.map((row) => and(eq(pdTitle.media, row.media), eq(pdTitle.tmdbId, row.tmdbId)))))
			: [],
		sourceIds.length
			? db.select({ id: pdSource.id, name: pdSource.name }).from(pdSource).where(inArray(pdSource.id, sourceIds))
			: [],
		userNames(
			db,
			rows.flatMap((row) => [row.reporterId, row.resolvedBy]),
		),
	]);
	const titleOf = new Map<string, Localized>(titles.map((row) => [`${row.media}:${row.id}`, row.title]));
	const sourceOf = new Map(sources.map((row) => [row.id, row]));
	const person = (id: string | null) => (id ? (people.get(id) ?? null) : null);
	return rows.map((row) => ({
		id: row.id,
		kind: row.kind,
		media: row.media,
		tmdbId: row.tmdbId,
		season: row.season,
		episode: row.episode,
		title: titleOf.get(`${row.media}:${row.tmdbId}`) ?? null,
		source: row.sourceId ? (sourceOf.get(row.sourceId) ?? null) : null,
		note: row.note,
		status: row.status,
		reporter: person(row.reporterId),
		resolvedBy: person(row.resolvedBy),
		resolvedAt: row.resolvedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
	}));
}

export function listReports({ db }: { db: Db }, input: PardaReportListInput): Promise<AdminReportPage> {
	const titled = textSearch(input.q, [sql`${pdTitle.title}->>'en'`, sql`${pdTitle.title}->>'ne'`]);
	return listPage(db, pdReport, {
		input,
		where: allOf(
			input.status === "all" ? undefined : eq(pdReport.status, input.status),
			input.kind === "all" ? undefined : eq(pdReport.kind, input.kind),
			input.source === "all" ? undefined : eq(pdReport.sourceId, input.source),
			input.q
				? or(
						textSearch(input.q, [pdReport.note]),
						sql`exists (select 1 from ${pdTitle} where ${pdTitle.media} = ${pdReport.media} and ${pdTitle.tmdbId} = ${pdReport.tmdbId} and ${titled})`,
						/^\d{1,9}$/.test(input.q) ? eq(pdReport.tmdbId, Number(input.q)) : undefined,
					)
				: undefined,
		),
		sort: { columns: { created: pdReport.createdAt }, fallback: "created" },
		map: (rows) => toAdmin(db, rows),
	});
}

/**
 * Resolves, dismisses or reopens reports. A report already in that status is left alone
 * and records nothing; missing ids are ignored.
 */
export async function setReportStatus(
	{ db, actor }: Pick<Services, "db" | "actor">,
	{ ids, status }: ReportStatusInput,
): Promise<{ changed: number }> {
	const changed = await withAudit(db, actor, async (tx, audit) => {
		const before = await tx
			.select({ id: pdReport.id, status: pdReport.status, kind: pdReport.kind })
			.from(pdReport)
			.where(and(inArray(pdReport.id, [...ids]), ne(pdReport.status, status)))
			.for("update");
		if (before.length === 0) return 0;
		const open = status === "open";
		await tx
			.update(pdReport)
			.set({ status, resolvedBy: open ? null : actor.id, resolvedAt: open ? null : new Date() })
			.where(
				inArray(
					pdReport.id,
					before.map((row) => row.id),
				),
			);
		audit(
			...before.map((row) => ({
				action: "parda.report.status" as const,
				target: { type: "parda-report" as const, id: row.id, label: row.kind },
				before: { status: row.status },
				after: { status },
			})),
		);
		return before.length;
	});
	return { changed };
}
