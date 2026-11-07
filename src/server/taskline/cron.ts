import "@tanstack/react-start/server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { workspaceSettings } from "@/features/taskline/settings";
import { TIMER_MAX_MINUTES } from "@/features/taskline/types";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { tlInvitation, tlMember, tlNotification, tlProject, tlTask, tlWorkspace } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";
import { runTimeRule } from "./automations/engine";
import { catchUpRecurrences } from "./automations/recurrence";
import * as automations from "./automations/repository";
import { systemAccess } from "./automations/scope";
import * as collab from "./collab/repository";
import { type DeliveryResult, deliverInstant, sendDigests } from "./notify/deliver";
import { produce } from "./notify/produce";
import { bumpRev } from "./rev";
import * as sprints from "./sprints/repository";
import * as tasks from "./tasks/repository";
import * as time from "./time/repository";

/**
 * `GET /api/cron/taskline` (PLAN 11.5; decision 0214), daily at about 07:00 in
 * Kathmandu. Each step is idempotent and runs on its own: one failing doesn't stop
 * the others, and running the whole job twice changes nothing the second time.
 *
 * 1. Due and overdue notices to assignees (one per task and due date).
 * 2. The daily digests.
 * 3. Sprint snapshots: each active sprint's close of yesterday (Task 52, 0216).
 * 4. Purging the trash past each workspace's retention (with the tasks' files).
 * 5. Expiring invitations: open ones a month past their date are revoked.
 * 6. Stopping timers that ran 12 hours (Task 53, 0218): each counts 12 hours, and its
 *    owner hears (the `timer` notification). It runs before the digests, which carry it.
 *
 * 7. Automations' time triggers (Task 56, 0221): each enabled "due soon" or "overdue"
 *    rule on the open tasks it names, once per task and due date (the run's key); and
 *    the run log past 30 days goes.
 * 8. Repeating tasks whose next occurrence came while the last one is still open get
 *    their next task (the missed occurrences skipped).
 */

/** Overdue notices catch up this many days of missed runs, not the whole backlog. */
const OVERDUE_CATCH_UP_DAYS = 3;
const INVITATION_GRACE_DAYS = 30;
/** How long the automations' run log keeps a run. */
const RUN_LOG_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CronStep = { ok: boolean; [detail: string]: unknown };
export type CronResult = Record<
	"timers" | "notices" | "instant" | "digests" | "sprints" | "trash" | "invitations" | "automations" | "recurrences",
	CronStep
>;

/** Notices of tasks due tomorrow, or past due, to their assignees; never twice for one due date. */
export async function dueNotices(
	db: Db,
	now = new Date(),
	instant: string[] = [],
): Promise<{ due: number; overdue: number }> {
	const counts = { due: 0, overdue: 0 };
	const workspaces = await db.select().from(tlWorkspace);
	for (const workspace of workspaces) {
		const settings = workspaceSettings.parse(workspace.settings);
		const today = todayInZone(settings.timeZone, now);
		const tomorrow = addDays(today, 1);
		const candidates = await db
			.select({ task: tlTask, project: tlProject })
			.from(tlTask)
			.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
			.innerJoin(tlMember, eq(tlMember.id, tlTask.assigneeId))
			.where(
				and(
					eq(tlTask.workspaceId, workspace.id),
					isNull(tlTask.deletedAt),
					isNull(tlTask.completedAt),
					isNull(tlProject.archivedAt),
					isNotNull(tlMember.userId),
					isNull(tlMember.deactivatedAt),
					gte(tlTask.dueOn, addDays(today, -OVERDUE_CATCH_UP_DAYS)),
					lte(tlTask.dueOn, tomorrow),
					sql`${tlTask.dueOn} <> ${today}`,
				),
			);
		if (candidates.length === 0) continue;
		const told = new Set(
			(
				await db
					.select({ taskId: tlNotification.taskId, kind: tlNotification.kind, data: tlNotification.data })
					.from(tlNotification)
					.where(
						and(
							inArray(
								tlNotification.taskId,
								candidates.map((row) => row.task.id),
							),
							inArray(tlNotification.kind, ["due", "overdue"]),
						),
					)
			).map((row) => `${row.taskId}:${row.kind}:${row.data.dueOn ?? ""}`),
		);
		for (const { task, project } of candidates) {
			if (!task.dueOn) continue;
			const kind = task.dueOn === tomorrow ? "due" : "overdue";
			if (told.has(`${task.id}:${kind}:${task.dueOn}`)) continue;
			const notified = await db.transaction((tx) =>
				produce(tx, { workspace, project, settings }, { memberId: null, userId: null, name: null }, [
					{
						kind,
						taskId: task.id,
						to: [task.assigneeId],
						data: {
							ref: tasks.taskRef(project.key, task.number),
							title: task.title,
							project: project.name,
							dueOn: task.dueOn ?? "",
						},
					},
				]),
			);
			instant.push(...notified);
			counts[kind]++;
		}
	}
	return counts;
}

/** Deletes tasks trashed longer ago than their workspace keeps them, with their subtasks and files. */
export async function purgeTrash(db: Db, now = new Date()): Promise<{ purged: number }> {
	let purged = 0;
	const workspaces = await db.select().from(tlWorkspace);
	for (const workspace of workspaces) {
		const settings = workspaceSettings.parse(workspace.settings);
		const before = new Date(now.getTime() - settings.trashRetentionDays * DAY_MS);
		const due = await db
			.select({ id: tlTask.id, projectId: tlTask.projectId })
			.from(tlTask)
			.where(and(eq(tlTask.workspaceId, workspace.id), lt(tlTask.deletedAt, before)));
		if (due.length === 0) continue;
		await db.transaction(async (tx) => {
			const ids = new Set(due.map((row) => row.id));
			for (const row of due) for (const below of await tasks.descendantsOf(tx, row.id)) ids.add(below.id);
			await collab.removeTaskFiles(tx, [...ids]);
			await tasks.deleteTasks(tx, [...ids]);
			for (const projectId of new Set(due.map((row) => row.projectId))) await bumpRev(tx, projectId);
		});
		purged += due.length;
	}
	return { purged };
}

/**
 * Each active sprint's totals at the close of yesterday in its workspace (decision
 * 0216): the job runs in the morning, so what it reads is the day that just ended. A
 * day already written is left alone, so a second run changes nothing.
 */
export async function sprintSnapshots(db: Db, now = new Date()): Promise<{ snapshots: number }> {
	let written = 0;
	const workspaces = await db.select().from(tlWorkspace);
	for (const workspace of workspaces) {
		const settings = workspaceSettings.parse(workspace.settings);
		const yesterday = addDays(todayInZone(settings.timeZone, now), -1);
		const live = await db
			.select({ id: tlProject.id })
			.from(tlProject)
			.where(and(eq(tlProject.workspaceId, workspace.id), isNull(tlProject.archivedAt)));
		const active = (
			await sprints.activeSprintsOf(
				db,
				live.map((row) => row.id),
			)
		).filter((sprint) => sprint.startOn <= yesterday);
		if (active.length === 0) continue;
		const totals = await sprints.totalsOf(
			db,
			active.map((sprint) => sprint.id),
		);
		for (const sprint of active) {
			const today = totals.get(sprint.id);
			if (today && (await sprints.writeSnapshot(db, sprint.id, yesterday, today, { replace: false }))) written++;
		}
	}
	return { snapshots: written };
}

/**
 * Timers running for 12 hours or more stop, each counting 12 hours (TIMER_MAX_MINUTES)
 * from its start; the owner is told so they can correct it. A timer stopped once isn't
 * running any more, so a second run finds nothing.
 */
export async function stopForgottenTimers(
	db: Db,
	now = new Date(),
	instant: string[] = [],
): Promise<{ stopped: number }> {
	const due = await time.runningSince(db, new Date(now.getTime() - TIMER_MAX_MINUTES * 60_000));
	for (const entry of due) {
		const notified = await db.transaction(async (tx) => {
			const endedAt = new Date((entry.startedAt ?? now).getTime() + TIMER_MAX_MINUTES * 60_000);
			const row = await time.patchEntry(tx, entry.id, { endedAt, minutes: TIMER_MAX_MINUTES });
			await time.recordLogged(tx, row, { auto: true, actorId: null });
			await bumpRev(tx, row.projectId);
			const [scope] = await tx
				.select({ workspace: tlWorkspace, project: tlProject })
				.from(tlProject)
				.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlProject.workspaceId))
				.where(eq(tlProject.id, row.projectId));
			if (!scope) return [];
			const task = row.taskId ? await tasks.getById(tx, row.projectId, row.taskId) : null;
			return produce(
				tx,
				{ ...scope, settings: workspaceSettings.parse(scope.workspace.settings) },
				{ memberId: null, userId: null, name: null },
				[
					{
						kind: "timer",
						taskId: row.taskId,
						to: [row.memberId],
						data: {
							ref: task ? tasks.taskRef(scope.project.key, task.number) : undefined,
							title: task?.title ?? scope.project.name,
							project: scope.project.name,
							minutes: TIMER_MAX_MINUTES,
						},
					},
				],
			);
		});
		instant.push(...notified);
	}
	return { stopped: due.length };
}

/** Open invitations a month past their date are revoked: they leave the admin's list and free the address. */
export async function expireInvitations(db: Db, now = new Date()): Promise<{ expired: number }> {
	const rows = await db
		.update(tlInvitation)
		.set({ revokedAt: now })
		.where(
			and(
				isNull(tlInvitation.acceptedAt),
				isNull(tlInvitation.revokedAt),
				lt(tlInvitation.expiresAt, new Date(now.getTime() - INVITATION_GRACE_DAYS * DAY_MS)),
			),
		)
		.returning({ id: tlInvitation.id });
	return { expired: rows.length };
}

/**
 * The time triggers: each enabled rule with "due soon" (due within its days, from today)
 * or "overdue" (past due, catching up three days of missed runs, as the notices) on the
 * open tasks of its scope's active projects. A task runs once per rule and due date: a
 * match claims its run's key, so a second run of the job (or a moved-back date) finds it.
 */
export async function automationTimeTriggers(
	db: Db,
	now = new Date(),
	instant: string[] = [],
): Promise<{ runs: number; pruned: number }> {
	let runs = 0;
	for (const rule of await automations.enabledTimeRules(db)) {
		const [workspace] = await db.select().from(tlWorkspace).where(eq(tlWorkspace.id, rule.workspaceId));
		if (!workspace) continue;
		const today = todayInZone(workspaceSettings.parse(workspace.settings).timeZone, now);
		const window =
			rule.trigger.type === "due_soon"
				? and(gte(tlTask.dueOn, today), lte(tlTask.dueOn, addDays(today, rule.trigger.days)))
				: and(gte(tlTask.dueOn, addDays(today, -OVERDUE_CATCH_UP_DAYS)), lt(tlTask.dueOn, today));
		const candidates = await db
			.select({ task: tlTask, project: tlProject })
			.from(tlTask)
			.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
			.where(
				and(
					eq(tlTask.workspaceId, workspace.id),
					rule.projectId ? eq(tlTask.projectId, rule.projectId) : undefined,
					isNull(tlTask.deletedAt),
					isNull(tlTask.completedAt),
					isNull(tlProject.archivedAt),
					window,
				),
			);
		for (const { task, project } of candidates) {
			const access = systemAccess(workspace, project);
			instant.push(...(await db.transaction((tx) => runTimeRule(tx, access, rule, task))));
			runs++;
		}
	}
	const pruned = await automations.pruneRuns(db, new Date(now.getTime() - RUN_LOG_DAYS * DAY_MS));
	return { runs, pruned };
}

async function step(name: string, run: () => Promise<object>): Promise<CronStep> {
	try {
		return { ok: true, ...(await run()) };
	} catch (error) {
		log("error", `taskline cron: ${name} failed`, errorFields(error));
		return { ok: false };
	}
}

export async function runTasklineCron(
	db: Db,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<CronResult> {
	// What the steps below made with an instant email: sent before the digests, which leave young instant rows alone.
	const instant: string[] = [];
	return {
		timers: await step("timers", () => stopForgottenTimers(db, now, instant)),
		// Before the notices and digests, which then carry what the automations said.
		automations: await step("automations", () => automationTimeTriggers(db, now, instant)),
		recurrences: await step("recurrences", () => catchUpRecurrences(db, now)),
		notices: await step("notices", () => dueNotices(db, now, instant)),
		instant: await step("instant", (): Promise<DeliveryResult> => deliverInstant(db, instant, { provider, now })),
		digests: await step("digests", (): Promise<DeliveryResult> => sendDigests(db, { provider, now })),
		sprints: await step("sprints", () => sprintSnapshots(db, now)),
		trash: await step("trash", () => purgeTrash(db, now)),
		invitations: await step("invitations", () => expireInvitations(db, now)),
	};
}
