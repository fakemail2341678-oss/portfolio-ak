import "@tanstack/react-start/server-only";
import { type AutomationEvent, matchesConditions, triggerMatches } from "@/features/taskline/automation-rules";
import {
	type AutomationAction,
	type AutomationRunDetail,
	isClosedCategory,
	MAX_TASK_DEPTH,
	type TaskField,
	type TaskPriority,
} from "@/features/taskline/types";
import { AppError, FORM_ERROR_KEY, ruleError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { lockQuota } from "@/server/db/quota";
import type { TlAutomationRow, TlStatusRow, TlTaskRow } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import type { ProjectAccess } from "../access";
import { type ActivityEntry, fieldChanges, recordSystemActivity } from "../activity";
import * as collab from "../collab/repository";
import { assertFieldsComplete, projectFields } from "../fields/rules";
import { type NotifyActor, type NotifyEvent, produce, taskData } from "../notify/produce";
import { bumpRev, nextTaskNumber } from "../rev";
import { quotaError, quotaScope, quotasOf, richText } from "../rules";
import * as sprints from "../sprints/repository";
import * as tasks from "../tasks/repository";
import { assertCompletable } from "../timeline/rules";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";
import { repeatOnClose } from "./recurrence";
import * as repo from "./repository";

/**
 * The automation engine (PLAN 11.5; decision 0221). A change hands it what happened
 * (`AutomationEvent`s) inside its own transaction, after its activity and
 * notifications. For each enabled rule of the workspace and the project whose trigger
 * fires, the task as it is now is checked against the conditions, and the actions run
 * in a savepoint of their own: a refused action (a blocked task, a required field, a
 * label since deleted) rolls back that rule's actions alone, the run is logged as
 * failed, and the change that triggered it stands.
 *
 * - No chaining: what an automation changes fires no automation (the engine writes
 *   through the repositories, never the services), so one savepoint deep is all.
 * - Its history entries name the automation (`{ via: "automation" }`), its
 *   notifications say it caused them, and its comments are its own.
 * - Every run is logged (`tl_automation_run`): ok, skipped (didn't match, changed
 *   nothing, or past the limit per change) or failed with the reason.
 */

/** Tasks one rule acts on in one change (a sprint start may name many); past it, one skipped run says so. */
export const RUNS_PER_RULE_MAX = 100;

type Context = {
	access: ProjectAccess;
	actor: NotifyActor;
	statuses: TlStatusRow[];
	fields: TaskField[];
	today: string;
};

/** What a rule's actions did: history entries, notifications, and how many actions changed something. */
type Applied = { entries: ActivityEntry[]; events: NotifyEvent[]; changed: number };

const missing = (what: string) =>
	ruleError("NOT_FOUND", `Automation: ${what} not found`, m.taskline_automation_error_missing());

/** The member-facing reason of a refusal, for the run log. */
function reasonOf(error: unknown): string {
	if (error instanceof AppError) {
		const messages = Object.values(error.fieldErrors ?? {}).flat();
		const first = error.fieldErrors?.[FORM_ERROR_KEY]?.[0] ?? messages[0];
		if (first) return first;
		if (error.code === "NOT_FOUND") return m.taskline_automation_error_missing();
	}
	return m.taskline_automation_error_failed();
}

const escapeHtml = (text: string) =>
	text.replace(
		/[&<>"']/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
	);

/** A comment's paragraphs from plain text. */
const paragraphs = (text: string) =>
	text
		.split(/\n{2,}/)
		.map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
		.join("");

/** One action on the task; returns the task as it is after it. */
async function act(
	sp: Tx,
	context: Context,
	rule: TlAutomationRow,
	task: TlTaskRow,
	action: AutomationAction,
	out: Applied,
): Promise<TlTaskRow> {
	const { access } = context;
	const project = access.project;
	const data = { ...taskData(access, task), automation: rule.name };
	switch (action.type) {
		case "set_status": {
			const status = action.statusId
				? context.statuses.find((each) => each.id === action.statusId)
				: context.statuses.find((each) => each.category === action.category);
			if (!status) throw missing("status");
			if (status.id === task.statusId) return task;
			await assertCompletable(sp, access, [task], status.category);
			await assertFieldsComplete(sp, access, [task], status.category);
			const closing = isClosedCategory(status.category);
			const after = await tasks.patchTask(sp, task.id, {
				statusId: status.id,
				position: await tasks.endOfStatus(sp, status.id),
				completedAt: closing ? (task.completedAt ?? new Date()) : null,
			});
			out.entries.push({ kind: "task.moved", taskId: task.id, data: { from: task.statusId, to: status.id } });
			out.events.push({
				kind: "status",
				taskId: task.id,
				to: await collab.watcherIds(sp, task.id),
				data: { ...data, status: status.name },
			});
			out.changed++;
			if (closing && !task.completedAt && after.recurrence) {
				await repeatOnClose(sp, access, after, { via: "automation", automation: rule.name });
				return (await tasks.getById(sp, project.id, task.id)) ?? after;
			}
			return after;
		}
		case "assign": {
			const to =
				action.to === "none"
					? null
					: action.to === "lead"
						? project.leadId
						: action.to === "reporter"
							? task.reporterId
							: action.to;
			// "The lead" or "the reporter" when there's none: the rule can't act (not a request to unassign).
			if (!to && action.to !== "none") throw missing("member");
			if (to) {
				const member = await members.memberById(sp, access.workspace.id, to);
				if (!member || member.deactivatedAt) throw missing("member");
			}
			if (to === task.assigneeId) return task;
			const after = await tasks.patchTask(sp, task.id, { assigneeId: to });
			out.entries.push(...fieldChanges(task.id, task, { assigneeId: to }));
			if (to) {
				await tasks.addWatchers(sp, task.id, [to]);
				out.events.push({ kind: "assigned", taskId: task.id, to: [to], data });
			}
			out.changed++;
			return after;
		}
		case "set_priority": {
			if (action.priority === task.priority) return task;
			out.entries.push(...fieldChanges(task.id, task, { priority: action.priority }));
			out.changed++;
			return tasks.patchTask(sp, task.id, { priority: action.priority });
		}
		case "add_label":
		case "remove_label": {
			const labels = await workflow.listLabels(sp, access.workspace.id, project.id);
			if (!labels.some((label) => label.id === action.labelId)) throw missing("label");
			const from = (await tasks.labelIdsOf(sp, [task.id])).get(task.id) ?? [];
			const adding = action.type === "add_label";
			if (from.includes(action.labelId) === adding) return task;
			if (adding) await tasks.addLabel(sp, [task.id], action.labelId);
			else await tasks.removeLabel(sp, [task.id], action.labelId);
			const to = adding ? [...from, action.labelId].sort() : from.filter((each) => each !== action.labelId);
			out.entries.push({ kind: "task.updated", taskId: task.id, data: { field: "labels", from, to } });
			out.changed++;
			return task;
		}
		case "set_sprint": {
			let sprintId: string | null = null;
			if (action.to === "active") {
				const active = await sprints.activeSprint(sp, project.id);
				if (!active)
					throw ruleError("CONFLICT", "Automation: no active sprint", m.taskline_automation_error_no_sprint());
				sprintId = active.id;
			} else if (action.to !== "none") {
				await sprints.checkSprint(sp, project.id, action.to);
				sprintId = action.to;
			}
			if (sprintId === task.sprintId) return task;
			out.entries.push(...fieldChanges(task.id, task, { sprintId }));
			out.changed++;
			return tasks.patchTask(sp, task.id, { sprintId });
		}
		case "set_due": {
			const dueOn = addDays(context.today, action.days);
			if (dueOn === task.dueOn) return task;
			out.entries.push(...fieldChanges(task.id, task, { dueOn }));
			out.changed++;
			return tasks.patchTask(sp, task.id, { dueOn });
		}
		case "comment": {
			const body = richText(paragraphs(action.text));
			const comment = await collab.insertComment(sp, {
				projectId: project.id,
				taskId: task.id,
				authorId: null,
				automation: rule.name,
				bodyHtml: body.html,
				bodyText: body.text,
				mentions: [],
			});
			out.entries.push({ kind: "comment.added", taskId: task.id, data: { commentId: comment.id } });
			out.events.push({
				kind: "comment",
				taskId: task.id,
				to: await collab.watcherIds(sp, task.id),
				data: { ...data, excerpt: body.text.slice(0, 280) },
			});
			out.changed++;
			return task;
		}
		case "notify": {
			const to =
				action.to === "assignee"
					? [task.assigneeId]
					: action.to === "reporter"
						? [task.reporterId]
						: action.to === "lead"
							? [project.leadId]
							: action.to === "watchers"
								? await collab.watcherIds(sp, task.id)
								: [action.to];
			out.events.push({
				kind: "automation",
				taskId: task.id,
				to,
				data: { ...data, ...(action.message ? { message: action.message } : {}) },
			});
			out.changed++;
			return task;
		}
		case "subtasks": {
			if ((await tasks.depthOf(sp, task)) + 1 > MAX_TASK_DEPTH) {
				throw ruleError("CONFLICT", "Automation: too deep", m.taskline_error_parent());
			}
			await lockQuota(sp, quotaScope(access.workspace.id));
			const max = quotasOf(access).tasks;
			if ((await tasks.countTasks(sp, access.workspace.id)) + action.titles.length > max) {
				throw quotaError("tasks", max);
			}
			const status = context.statuses.find((each) => each.category === "unstarted") ?? context.statuses[0];
			if (!status) throw missing("status");
			for (const title of action.titles) {
				const subtask = await tasks.insertTask(sp, {
					workspaceId: access.workspace.id,
					projectId: project.id,
					number: await nextTaskNumber(sp, project.id),
					title,
					type: "task",
					statusId: status.id,
					position: await tasks.endOfStatus(sp, status.id),
					parentId: task.id,
					sprintId: task.sprintId,
				});
				out.entries.push({ kind: "task.created", taskId: subtask.id, data: { title } });
			}
			out.changed++;
			return task;
		}
	}
}

/**
 * One rule on one task: the conditions, then the actions in a savepoint; the run is logged
 * either way. A time rule (with a `key`) that doesn't match leaves no trace, so it can
 * still fire when the task later matches: only a match claims the task's one run.
 */
async function runRule(
	tx: Tx,
	context: Context,
	rule: TlAutomationRow,
	taskId: string,
	{ key }: { key?: string } = {},
): Promise<string[]> {
	const { access } = context;
	const task = await tasks.getById(tx, access.project.id, taskId);
	if (!task || task.deletedAt) return [];
	const labelIds = (await tasks.labelIdsOf(tx, [task.id])).get(task.id) ?? [];
	const category = context.statuses.find((status) => status.id === task.statusId)?.category ?? "unstarted";
	const matched = matchesConditions(
		{
			type: task.type,
			priority: task.priority as TaskPriority,
			category,
			labelIds,
			assigneeId: task.assigneeId,
			fields: task.fields,
		},
		rule.conditions,
		context,
	);
	if (!matched) {
		if (!key) {
			await repo.insertRun(tx, { automationId: rule.id, taskId, outcome: "skipped", detail: { reason: "conditions" } });
		}
		return [];
	}
	const runId = key
		? await repo.claimRun(tx, { automationId: rule.id, taskId, outcome: "skipped", detail: {}, key })
		: null;
	if (key && !runId) return [];
	const record = async (outcome: "ok" | "skipped" | "failed", detail: AutomationRunDetail) => {
		if (runId) await repo.finishRun(tx, runId, { outcome, detail });
		else await repo.insertRun(tx, { automationId: rule.id, taskId, outcome, detail });
	};
	try {
		const { changed, notify } = await tx.transaction(async (sp) => {
			const out: Applied = { entries: [], events: [], changed: 0 };
			let current = task;
			for (const action of rule.actions) current = await act(sp, context, rule, current, action, out);
			await recordSystemActivity(sp, access, { via: "automation", automation: rule.name }, ...out.entries);
			if (out.changed > 0) await bumpRev(sp, access.project.id);
			// A rule's own "notify" first: one notice per person per change, and that's the one it means.
			const events = [...out.events].sort((a, b) => Number(b.kind === "automation") - Number(a.kind === "automation"));
			const notify = await produce(sp, access, { ...context.actor, name: null }, events);
			return { changed: out.changed, notify };
		});
		await record(changed > 0 ? "ok" : "skipped", changed > 0 ? { applied: changed } : { reason: "unchanged" });
		return notify;
	} catch (error) {
		// A refusal is the rule meeting the task; anything else is a fault worth a log line.
		if (!(error instanceof AppError)) {
			log("error", "taskline: automation failed", { automationId: rule.id, taskId: task.id, ...errorFields(error) });
		}
		await record("failed", { message: reasonOf(error) });
		return [];
	}
}

/**
 * Runs the rules a change fires, in its transaction, after its own activity and
 * notifications. `actor` caused the change (null for the daily job): they aren't told
 * about what the automation then did for them. Returns the instant emails to send
 * after the commit, with the change's own.
 */
export async function runAutomations(
	tx: Tx,
	access: ProjectAccess,
	actor: NotifyActor,
	events: ReadonlyArray<AutomationEvent>,
): Promise<string[]> {
	if (events.length === 0) return [];
	const rules = await repo.enabledFor(tx, access.workspace.id, access.project.id, [
		...new Set(events.map((event) => event.trigger)),
	]);
	if (rules.length === 0) return [];
	const context: Context = {
		access,
		actor,
		statuses: await workflow.listStatuses(tx, access.project.id),
		fields: await projectFields(tx, access),
		today: todayInZone(access.settings.timeZone),
	};
	const notify: string[] = [];
	for (const rule of rules) {
		const fired = events.filter((event) => triggerMatches(rule.trigger, event));
		for (const [index, event] of fired.entries()) {
			if (index === RUNS_PER_RULE_MAX) {
				await repo.insertRun(tx, {
					automationId: rule.id,
					taskId: null,
					outcome: "skipped",
					detail: { reason: "limit" },
				});
				break;
			}
			notify.push(...(await runRule(tx, context, rule, event.taskId)));
		}
	}
	return notify;
}

/**
 * The daily job's triggers on one task of one rule: once per task and due date (the
 * run's key), with nobody as the actor.
 */
export async function runTimeRule(
	tx: Tx,
	access: ProjectAccess,
	rule: TlAutomationRow,
	task: Pick<TlTaskRow, "id" | "dueOn">,
): Promise<string[]> {
	const context: Context = {
		access,
		actor: { memberId: null, userId: null, name: null },
		statuses: await workflow.listStatuses(tx, access.project.id),
		fields: await projectFields(tx, access),
		today: todayInZone(access.settings.timeZone),
	};
	return runRule(tx, context, rule, task.id, { key: `${rule.trigger.type}:${task.id}:${task.dueOn ?? ""}` });
}
