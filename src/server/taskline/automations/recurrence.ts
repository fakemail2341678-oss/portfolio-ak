import "@tanstack/react-start/server-only";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { dueByNow, nextDue, shiftedStart } from "@/features/taskline/recurrence";
import { workspaceSettings } from "@/features/taskline/settings";
import { todayInZone } from "@/lib/i18n/date-only";
import { lockQuota } from "@/server/db/quota";
import { type TlTaskRow, tlProject, tlTask, tlWorkspace } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import type { ProjectAccess } from "../access";
import { type ActivityEntry, recordActivity, recordSystemActivity, type SystemActor } from "../activity";
import { bumpRev, nextTaskNumber } from "../rev";
import { quotaError, quotaScope, quotasOf } from "../rules";
import * as tasks from "../tasks/repository";
import * as workflow from "../workflow/repository";
import { systemAccess } from "./scope";

/**
 * Recurring tasks on the server (Task 56, decision 0221). A series lives on its open
 * task: closing it (completed or canceled) creates the next one, due on the next
 * occurrence (`nextDue`), which takes the rule over; the daily job creates it when an
 * occurrence comes while the last task is still open (`dueByNow`). The next task is a
 * copy with its checklist unticked, its labels and field values, in the project's
 * first open status. It's made in a savepoint: if it can't be (the task quota), the
 * change that closed the task stands and the series stays where it was.
 */

/** Creates the series' next task, due `dueOn`; the closed (or late) one keeps no rule. */
async function createNext(
	tx: Tx,
	access: ProjectAccess,
	task: TlTaskRow,
	dueOn: string,
	actor: SystemActor | null,
): Promise<TlTaskRow | null> {
	const rule = task.recurrence;
	if (!rule) return null;
	try {
		return await tx.transaction(async (sp) => {
			await lockQuota(sp, quotaScope(access.workspace.id));
			const max = quotasOf(access).tasks;
			if ((await tasks.countTasks(sp, access.workspace.id)) >= max) throw quotaError("tasks", max);
			const statuses = await workflow.listStatuses(sp, access.project.id);
			const status = statuses.find((row) => row.category === "unstarted") ?? statuses[0];
			if (!status) return null;
			const parent = task.parentId ? await tasks.getById(sp, access.project.id, task.parentId) : null;
			const labelIds = (await tasks.labelIdsOf(sp, [task.id])).get(task.id) ?? [];
			const next = await tasks.insertTask(sp, {
				workspaceId: task.workspaceId,
				projectId: task.projectId,
				number: await nextTaskNumber(sp, access.project.id),
				title: task.title,
				descriptionHtml: task.descriptionHtml,
				descriptionText: task.descriptionText,
				type: task.type,
				statusId: status.id,
				position: await tasks.endOfStatus(sp, status.id),
				priority: task.priority,
				assigneeId: task.assigneeId,
				reporterId: task.reporterId,
				parentId: parent && !parent.deletedAt ? parent.id : null,
				startOn: shiftedStart(task.startOn, task.dueOn, dueOn),
				dueOn,
				checklist: task.checklist.map((item) => ({ ...item, id: crypto.randomUUID(), done: false })),
				points: task.points,
				estimateMinutes: task.estimateMinutes,
				fields: task.fields,
				recurrence: { ...rule, n: rule.n + 1 },
			});
			await tasks.setLabels(sp, next.id, labelIds);
			await tasks.addWatchers(sp, next.id, [next.reporterId, next.assigneeId]);
			await tasks.patchTask(sp, task.id, { recurrence: null });
			const key = access.project.key;
			const entries: ActivityEntry[] = [
				{ kind: "task.recurred", taskId: task.id, data: { ref: tasks.taskRef(key, next.number) } },
				{
					kind: "task.created",
					taskId: next.id,
					data: { title: next.title, recurredFrom: tasks.taskRef(key, task.number) },
				},
			];
			if (actor) await recordSystemActivity(sp, access, actor, ...entries);
			else await recordActivity(sp, access, ...entries);
			await bumpRev(sp, access.project.id);
			return next;
		});
	} catch (error) {
		log("warn", "taskline: repeating a task failed", { taskId: task.id, ...errorFields(error) });
		return null;
	}
}

/** A repeating task just closed: its series' next task (none when the series ends there). */
export async function repeatOnClose(
	tx: Tx,
	access: ProjectAccess,
	task: TlTaskRow,
	actor: SystemActor | null = null,
): Promise<TlTaskRow | null> {
	const rule = task.recurrence;
	if (!rule) return null;
	const today = todayInZone(access.settings.timeZone);
	const dueOn = nextDue(rule, task.dueOn ?? task.startOn ?? today, today, access.settings.weekStart);
	if (!dueOn) {
		// The series ended with this task: nothing carries its rule on.
		await tasks.patchTask(tx, task.id, { recurrence: null });
		return null;
	}
	return createNext(tx, access, task, dueOn, actor);
}

/**
 * The daily job's catch-up: each open repeating task whose next occurrence has come
 * gets its next task (the latest occurrence up to today, the missed ones skipped).
 * The late task stays open; the rule moves on, so a second run finds nothing.
 */
export async function catchUpRecurrences(db: Db, now = new Date()): Promise<{ created: number }> {
	let created = 0;
	const rows = await db
		.select({ task: tlTask, project: tlProject, workspace: tlWorkspace })
		.from(tlTask)
		.innerJoin(tlProject, eq(tlProject.id, tlTask.projectId))
		.innerJoin(tlWorkspace, eq(tlWorkspace.id, tlTask.workspaceId))
		.where(
			and(
				isNotNull(tlTask.recurrence),
				isNull(tlTask.deletedAt),
				isNull(tlTask.completedAt),
				isNull(tlProject.archivedAt),
				// Only a task whose day has gone by can be overtaken by the next occurrence.
				lt(sql`coalesce(${tlTask.dueOn}, ${tlTask.startOn})`, sql`(now() at time zone 'utc')::date + 1`),
			),
		);
	for (const { task, project, workspace } of rows) {
		const settings = workspaceSettings.parse(workspace.settings);
		const today = todayInZone(settings.timeZone, now);
		const base = task.dueOn ?? task.startOn;
		if (!task.recurrence || !base || base >= today) continue;
		const dueOn = dueByNow(task.recurrence, base, today, settings.weekStart);
		if (!dueOn) continue;
		const next = await db.transaction((tx) =>
			createNext(tx, systemAccess(workspace, project), task, dueOn, { via: "repeat" }),
		);
		if (next) created++;
	}
	return { created };
}
