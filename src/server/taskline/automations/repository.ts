import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
	type Automation,
	type AutomationOutcome,
	type AutomationRun,
	type AutomationRunDetail,
	type AutomationTriggerType,
	TIME_TRIGGERS,
} from "@/features/taskline/types";
import { type TlAutomationRow, tlAutomation, tlAutomationRun, tlProject, tlTask } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Automations and their runs: plain reads and writes (the rules are the service's and the engine's). */

/** A workspace's rules (`projectId` null) or one project's. */
export type AutomationScope = { workspaceId: string; projectId: string | null };

const inScope = ({ workspaceId, projectId }: AutomationScope) =>
	and(
		eq(tlAutomation.workspaceId, workspaceId),
		projectId ? eq(tlAutomation.projectId, projectId) : isNull(tlAutomation.projectId),
	);

export function automationDto(row: TlAutomationRow, lastRun?: Automation["lastRun"]): Automation {
	return {
		id: row.id,
		projectId: row.projectId,
		name: row.name,
		enabled: row.enabled,
		trigger: row.trigger,
		conditions: row.conditions,
		actions: row.actions,
		version: row.version,
		lastRun: lastRun ?? null,
		createdAt: row.createdAt.toISOString(),
	};
}

/** A scope's rules, oldest first (the order they run in). */
export async function listScope(db: Db, scope: AutomationScope): Promise<TlAutomationRow[]> {
	return db
		.select()
		.from(tlAutomation)
		.where(inScope(scope))
		.orderBy(asc(tlAutomation.createdAt), asc(tlAutomation.id));
}

/** Each automation's latest run. */
export async function lastRuns(db: Db, ids: ReadonlyArray<string>): Promise<Map<string, Automation["lastRun"]>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.selectDistinctOn([tlAutomationRun.automationId], {
			automationId: tlAutomationRun.automationId,
			outcome: tlAutomationRun.outcome,
			at: tlAutomationRun.at,
		})
		.from(tlAutomationRun)
		.where(inArray(tlAutomationRun.automationId, [...ids]))
		.orderBy(tlAutomationRun.automationId, desc(tlAutomationRun.at));
	return new Map(rows.map((row) => [row.automationId, { outcome: row.outcome, at: row.at.toISOString() }]));
}

/** Rules with their latest runs, as the pages show them. */
export async function dtos(db: Db, rows: ReadonlyArray<TlAutomationRow>): Promise<Automation[]> {
	const last = await lastRuns(
		db,
		rows.map((row) => row.id),
	);
	return rows.map((row) => automationDto(row, last.get(row.id)));
}

export async function getAutomation(db: Db, scope: AutomationScope, id: string): Promise<TlAutomationRow | null> {
	const [row] = await db
		.select()
		.from(tlAutomation)
		.where(and(inScope(scope), eq(tlAutomation.id, id)));
	return row ?? null;
}

export async function countScope(db: Db, scope: AutomationScope): Promise<number> {
	const [row] = await db.select({ count: count() }).from(tlAutomation).where(inScope(scope));
	return row?.count ?? 0;
}

export async function insertAutomation(tx: Tx, values: typeof tlAutomation.$inferInsert): Promise<TlAutomationRow> {
	const [row] = await tx.insert(tlAutomation).values(values).returning();
	if (!row) throw new Error("Automation insert returned no row");
	return row;
}

export async function setEnabled(tx: Tx, id: string, enabled: boolean): Promise<TlAutomationRow> {
	const [row] = await tx.update(tlAutomation).set({ enabled }).where(eq(tlAutomation.id, id)).returning();
	if (!row) throw new Error("Automation update returned no row");
	return row;
}

export async function deleteAutomation(tx: Tx, id: string): Promise<void> {
	await tx.delete(tlAutomation).where(eq(tlAutomation.id, id));
}

/** The enabled rules a change in `projectId` may fire: the workspace's and the project's, of these triggers. */
export async function enabledFor(
	db: Db,
	workspaceId: string,
	projectId: string,
	triggers: ReadonlyArray<AutomationTriggerType>,
): Promise<TlAutomationRow[]> {
	if (triggers.length === 0) return [];
	return db
		.select()
		.from(tlAutomation)
		.where(
			and(
				eq(tlAutomation.workspaceId, workspaceId),
				eq(tlAutomation.enabled, true),
				or(isNull(tlAutomation.projectId), eq(tlAutomation.projectId, projectId)),
				inArray(sql<string>`${tlAutomation.trigger}->>'type'`, [...triggers]),
			),
		)
		.orderBy(sql`${tlAutomation.projectId} nulls first`, asc(tlAutomation.createdAt), asc(tlAutomation.id));
}

/** Every enabled rule with a time trigger (the daily job's). */
export async function enabledTimeRules(db: Db): Promise<TlAutomationRow[]> {
	return db
		.select()
		.from(tlAutomation)
		.where(
			and(eq(tlAutomation.enabled, true), inArray(sql<string>`${tlAutomation.trigger}->>'type'`, [...TIME_TRIGGERS])),
		)
		.orderBy(asc(tlAutomation.createdAt), asc(tlAutomation.id));
}

export type RunValues = {
	automationId: string;
	taskId: string | null;
	outcome: AutomationOutcome;
	detail: AutomationRunDetail;
	key?: string | null;
};

export async function insertRun(tx: Tx, values: RunValues): Promise<void> {
	await tx.insert(tlAutomationRun).values(values);
}

/** A keyed run, once: false when that key already ran (the daily job's second run). */
export async function claimRun(tx: Tx, values: RunValues & { key: string }): Promise<string | null> {
	const [row] = await tx
		.insert(tlAutomationRun)
		.values(values)
		.onConflictDoNothing({
			target: [tlAutomationRun.automationId, tlAutomationRun.key],
			where: sql`${tlAutomationRun.key} is not null`,
		})
		.returning({ id: tlAutomationRun.id });
	return row?.id ?? null;
}

export async function finishRun(
	tx: Tx,
	id: string,
	{ outcome, detail }: { outcome: AutomationOutcome; detail: AutomationRunDetail },
): Promise<void> {
	await tx.update(tlAutomationRun).set({ outcome, detail }).where(eq(tlAutomationRun.id, id));
}

/** The latest runs of these automations, newest first, with their task's reference. */
export async function listRuns(db: Db, automationIds: ReadonlyArray<string>, limit = 50): Promise<AutomationRun[]> {
	if (automationIds.length === 0) return [];
	const rows = await db
		.select({
			id: tlAutomationRun.id,
			automationId: tlAutomationRun.automationId,
			automation: tlAutomation.name,
			outcome: tlAutomationRun.outcome,
			detail: tlAutomationRun.detail,
			at: tlAutomationRun.at,
			number: tlTask.number,
			title: tlTask.title,
			projectKey: tlProject.key,
		})
		.from(tlAutomationRun)
		.innerJoin(tlAutomation, eq(tlAutomation.id, tlAutomationRun.automationId))
		.leftJoin(tlTask, eq(tlTask.id, tlAutomationRun.taskId))
		.leftJoin(tlProject, eq(tlProject.id, tlTask.projectId))
		.where(inArray(tlAutomationRun.automationId, [...automationIds]))
		.orderBy(desc(tlAutomationRun.at), desc(tlAutomationRun.id))
		.limit(limit);
	return rows.map((row) => ({
		id: row.id,
		automationId: row.automationId,
		automation: row.automation,
		projectKey: row.projectKey,
		ref: row.projectKey && row.number ? `${row.projectKey}-${row.number}` : null,
		title: row.title,
		outcome: row.outcome,
		detail: row.detail,
		at: row.at.toISOString(),
	}));
}

/** Runs older than `before` go (the daily job, after 30 days: the keyed ones are past their window by then). */
export async function pruneRuns(db: Db, before: Date): Promise<number> {
	const rows = await db
		.delete(tlAutomationRun)
		.where(lt(tlAutomationRun.at, before))
		.returning({ id: tlAutomationRun.id });
	return rows.length;
}
