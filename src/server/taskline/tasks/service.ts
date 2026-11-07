import "@tanstack/react-start/server-only";
import type { AutomationEvent } from "@/features/taskline/automation-rules";
import { activeFields, parseFieldFilters } from "@/features/taskline/fields";
import { storedRecurrence } from "@/features/taskline/recurrence";
import {
	type BulkTasksInput,
	type CreateTaskInput,
	type PatchTaskInput,
	parseTaskRef,
	type TaskListInput,
	type UpdateTaskInput,
} from "@/features/taskline/schema";
import { projectSettings } from "@/features/taskline/settings";
import {
	type BulkResult,
	type ChecklistItem,
	isClosedCategory,
	MAX_TASK_DEPTH,
	type ProjectActivity,
	type ProjectRev,
	type ProjectTasks,
	type TaskDetail,
	type TaskPriority,
	type TaskSummary,
	type TaskType,
	type TrashedTask,
} from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { generateKeysBetween } from "@/lib/fractional-index";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import type { Paged } from "@/lib/list/paging";
import { m } from "@/paraglide/messages";
import type { ImageStore } from "@/server/attachments/cloudinary";
import { notFound } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { type TlTaskRow, tlTask } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { sanitizeRichText } from "@/server/rich-text/sanitize";
import { assertCan, type ProjectAccess, resolveProject, type TasklineServices } from "../access";
import { type ActivityEntry, fieldChanges, recordActivity, taskActivity } from "../activity";
import { runAutomations } from "../automations/engine";
import { afterStatusChanges } from "../automations/hooks";
import * as collab from "../collab/repository";
import * as fieldRepo from "../fields/repository";
import { assertFieldsComplete, checkValues, projectFields, valueChanges } from "../fields/rules";
import { actorOf, type NotifyEvent, produce, taskData } from "../notify/produce";
import * as projects from "../projects/repository";
import { bumpRev, nextTaskNumber, saveVersioned } from "../rev";
import { fieldError, quotaError, quotaScope, quotasOf, richText } from "../rules";
import * as sprints from "../sprints/repository";
import { taskTime } from "../time/rules";
import * as timeline from "../timeline/repository";
import { assertCompletable, taskDependencies } from "../timeline/rules";
import * as workflow from "../workflow/repository";
import * as members from "../workspace/repository";
import * as repo from "./repository";

/**
 * Tasks (docs/guides/taskline.md, "Tasks"): numbers from the project's sequence,
 * `completed_at` from the status's category, subtasks two levels deep, a trash that
 * takes a task's subtasks with it, and a history entry for every change. The title
 * and description save with their version; everything else is last-write-wins.
 */

type Resolved = { access: ProjectAccess; task: TlTaskRow };

/** The task `ref` ("WEB-12") of workspace `ws`, with the caller's access; NOT_FOUND unless they may see it. */
export async function resolveTask(db: Db, user: TasklineServices["user"], ws: string, ref: string): Promise<Resolved> {
	const parsed = parseTaskRef(ref);
	if (!parsed) throw notFound("Task");
	const access = await resolveProject(db, user, ws, parsed.key);
	const task = await repo.getByNumber(db, access.project.id, parsed.number);
	if (!task) throw notFound("Task");
	return { access, task };
}

/** For changes: the caller may edit, and the task isn't in the trash. */
async function resolveEditable(tx: Tx, user: TasklineServices["user"], ws: string, ref: string): Promise<Resolved> {
	const resolved = await resolveTask(tx, user, ws, ref);
	assertCan(resolved.access, "edit");
	if (resolved.task.deletedAt) throw ruleError("CONFLICT", "Taskline: task in trash", m.taskline_error_in_trash());
	return resolved;
}

const summaryOf = async (db: Db, access: ProjectAccess, row: TlTaskRow): Promise<TaskSummary> =>
	(await repo.summaries(db, [row], access.project.key))[0] as TaskSummary;

/** A task as its page shows it: the fields, subtasks, history, and (Task 50) the conversation, files and watchers. */
export async function taskDetail(
	db: Db,
	access: ProjectAccess,
	row: TlTaskRow,
	{ imageStore: store, user }: { imageStore: ImageStore | null | undefined; user: TasklineServices["user"] },
): Promise<TaskDetail> {
	const [summary, subtasks, activity, comments, watcherIds, files, time, dependencies] = await Promise.all([
		summaryOf(db, access, row),
		repo.subtasksOf(db, row.id).then((rows) => repo.summaries(db, rows, access.project.key)),
		taskActivity(db, row.id),
		collab.listComments(db, row.id),
		collab.watcherIds(db, row.id),
		collab.filesOf(db, store, collab.TASK_FILES, [row.id]),
		taskTime(db, access, user, row.id),
		taskDependencies(db, access, row.id),
	]);
	const commentFiles = await collab.filesOf(
		db,
		store,
		collab.COMMENT_FILES,
		comments.map((comment) => comment.id),
	);
	const me = access.member?.id ?? null;
	const open = row.deletedAt === null;
	return {
		...summary,
		description: row.descriptionHtml,
		checklistItems: row.checklist,
		reporterId: row.reporterId,
		subtasks,
		deletedAt: row.deletedAt?.toISOString() ?? null,
		version: row.version,
		activity,
		can: access.can,
		comments: comments.map((comment) => ({
			id: comment.id,
			authorId: comment.authorId,
			automation: comment.automation,
			html: sanitizeRichText(comment.bodyHtml),
			mentions: comment.mentions,
			attachments: commentFiles.get(comment.id) ?? [],
			createdAt: comment.createdAt.toISOString(),
			editedAt: comment.editedAt?.toISOString() ?? null,
			canEdit: open && access.can.comment && me !== null && comment.authorId === me,
			canDelete: access.can.comment && ((me !== null && comment.authorId === me) || access.can.manage),
		})),
		attachments: files.get(row.id) ?? [],
		watching: me !== null && watcherIds.includes(me),
		watcherIds,
		time,
		dependencies,
	};
}

/** Hands a write's instant notifications to the deliverer, after its transaction committed. */
function deliverAfter(services: TasklineServices, ids: string[]) {
	if (ids.length > 0) services.deliver?.(ids);
}

/** The status-change notices of tasks that moved: their watchers hear the new status's name. */
async function statusEvents(
	db: Db,
	access: ProjectAccess,
	moved: ReadonlyArray<{ task: TlTaskRow; statusName: string }>,
): Promise<NotifyEvent[]> {
	const events: NotifyEvent[] = [];
	for (const { task, statusName } of moved) {
		events.push({
			kind: "status",
			taskId: task.id,
			to: await collab.watcherIds(db, task.id),
			data: { ...taskData(access, task), status: statusName },
		});
	}
	return events;
}

/** An active member of the task's workspace (assignees can't be deactivated members). */
async function checkAssignee(db: Db, access: ProjectAccess, memberId: string | null | undefined) {
	if (!memberId) return;
	const member = await members.memberById(db, access.workspace.id, memberId);
	if (!member || member.deactivatedAt) throw notFound("Member");
}

/** Labels of the project or its workspace. */
async function checkLabels(db: Db, access: ProjectAccess, labelIds: ReadonlyArray<string> | undefined) {
	if (!labelIds || labelIds.length === 0) return;
	const allowed = new Set(
		(await workflow.listLabels(db, access.workspace.id, access.project.id)).map((label) => label.id),
	);
	if (labelIds.some((id) => !allowed.has(id))) throw notFound("Label");
}

/**
 * A parent in the same project, outside the trash, that isn't the task or one of its
 * subtasks, and leaves the whole subtree within MAX_TASK_DEPTH.
 */
async function checkParent(db: Db, access: ProjectAccess, parentId: string | null | undefined, task?: TlTaskRow) {
	if (!parentId) return;
	const parent = await repo.getById(db, access.project.id, parentId);
	if (!parent || parent.deletedAt) throw notFound("Task");
	const below = task ? await repo.descendantsOf(db, task.id) : [];
	if (task && (parent.id === task.id || below.some((row) => row.id === parent.id))) throw parentError();
	const height = below.length === 0 ? 0 : below.some((row) => row.parentId !== task?.id) ? 2 : 1;
	if ((await repo.depthOf(db, parent)) + 1 + height > MAX_TASK_DEPTH) throw parentError();
}

const parentError = () => ruleError("CONFLICT", "Taskline: bad parent", m.taskline_error_parent());

/** A milestone of the task's project (Task 54). */
async function checkMilestone(db: Db, access: ProjectAccess, milestoneId: string | null | undefined) {
	if (!milestoneId) return;
	if (!(await timeline.getMilestone(db, access.project.id, milestoneId))) throw notFound("Milestone");
}

/**
 * The type a task may be given: one the workspace offers (Task 49). Unnamed, it is
 * `task`, or the first one offered when the admin turned `task` off.
 */
function taskType(access: ProjectAccess, type: TaskType | undefined): TaskType {
	const offered = access.settings.taskTypes;
	if (type === undefined) return offered.includes("task") ? "task" : (offered[0] ?? "task");
	if (!offered.includes(type)) throw fieldError("BAD_REQUEST", "type", m.taskline_error_type_off());
	return type;
}

export async function listTasks({ db, user }: TasklineServices, ws: string, key: string): Promise<ProjectTasks> {
	const access = await resolveProject(db, user, ws, key);
	const [statuses, labels, memberRows, rows, stars, counts, planning, milestones, dependencies, fields] =
		await Promise.all([
			workflow.listStatuses(db, access.project.id),
			workflow.listLabels(db, access.workspace.id, access.project.id),
			members.listMembers(db, access.workspace.id, { deactivated: true }),
			repo.listTasks(db, access.project.id),
			projects.starsOf(db, access.member?.id ?? null, [access.project.id]),
			projects.openTaskCounts(db, [access.project.id]),
			sprints.projectSprints(db, access.project.id),
			timeline.listMilestones(db, access.project.id),
			timeline.projectDependencies(db, access.project.id),
			fieldRepo.listFields(db, access.workspace.id, access.project.id),
		]);
	return {
		project: projects.projectDetail(access.project, {
			starred: stars.has(access.project.id),
			openTasks: counts.get(access.project.id) ?? 0,
			role: access.projectRole,
			can: access.can,
		}),
		statuses: statuses.map(workflow.statusDto),
		labels: labels.map(workflow.labelDto),
		members: memberRows.map(members.memberDto),
		tasks: await repo.summaries(db, rows, access.project.key),
		today: todayInZone(access.settings.timeZone),
		doneColumnDays: projectSettings.parse(access.project.settings).doneColumnDays ?? access.settings.doneColumnDays,
		taskTypes: access.settings.taskTypes,
		readAt: new Date().toISOString(),
		sprints: planning.sprints,
		velocity: planning.velocity,
		sprintCount: planning.sprintCount,
		milestones: milestones.map(timeline.milestoneDto),
		dependencies,
		fields: fields.map(fieldRepo.fieldDto),
	};
}

/**
 * The list view's filters for the server: `me` is the caller's member row, dates are
 * the workspace's, `active` is the project's active sprint (none: nothing matches).
 */
async function listFilters(db: Db, access: ProjectAccess, input: TaskListInput): Promise<repo.TaskListFilters> {
	const today = todayInZone(access.settings.timeZone);
	const offered = activeFields(input.cf.length > 0 ? await projectFields(db, access) : []);
	const fields = parseFieldFilters(input.cf).flatMap(({ fieldId, value }) => {
		const field = offered.find((each) => each.id === fieldId);
		// `me` is the caller's member row; a caller without one matches nothing (null).
		return field ? [{ field, value: value === "me" ? (access.member?.id ?? null) : value }] : [];
	});
	const sprint =
		input.sprint === "all"
			? undefined
			: input.sprint === "active"
				? ((await sprints.activeSprint(db, access.project.id))?.id ?? "nobody")
				: input.sprint;
	return {
		sprint,
		q: input.q,
		statusId: input.status === "all" ? undefined : input.status,
		assignee:
			input.assignee === "all" ? undefined : input.assignee === "me" ? (access.member?.id ?? "nobody") : input.assignee,
		labelId: input.label === "all" ? undefined : input.label,
		priority: input.priority === "all" ? undefined : Number(input.priority),
		type: input.type === "all" ? undefined : input.type,
		due: input.due === "all" ? undefined : input.due,
		milestone: input.milestone === "all" ? undefined : input.milestone,
		blocked: input.blocked === "all" ? undefined : input.blocked === "yes",
		fields,
		today,
		weekEnd: addDays(today, 6),
	};
}

/** A page of the list view (the list contract: filters, sort, grouping, page). */
export async function listTaskPage({ db, user }: TasklineServices, input: TaskListInput): Promise<Paged<TaskSummary>> {
	const access = await resolveProject(db, user, input.ws, input.key);
	return repo.listPage(db, access.project.id, access.project.key, {
		filters: await listFilters(db, access, input),
		sort: input.sort,
		group: input.group,
		page: input.page,
		pageSize: input.pageSize,
	});
}

/**
 * One change to many tasks of a project (the list's bulk actions), in one
 * transaction: each task's history gets its entry, and the project's rev moves once.
 * A task that isn't the project's, or is in the trash, is NOT_FOUND (nothing changes).
 */
export async function bulkUpdate(services: TasklineServices, input: BulkTasksInput): Promise<BulkResult> {
	const { db, user } = services;
	const { result, notify } = await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, input.ws, input.key);
		assertCan(access, "edit");
		const rows = await repo.getByIds(tx, access.project.id, input.ids);
		if (rows.length !== new Set(input.ids).size || rows.some((row) => row.deletedAt)) throw notFound("Task");
		const ids = rows.map((row) => row.id);
		const entries: ActivityEntry[] = [];
		const events: NotifyEvent[] = [];
		const fired: AutomationEvent[] = [];
		if (input.trash) {
			const at = new Date();
			for (const row of rows) {
				const below = (await repo.descendantsOf(tx, row.id)).filter((child) => !child.deletedAt);
				await repo.setDeleted(tx, [row.id, ...below.map((child) => child.id)], at);
				entries.push({ kind: "task.trashed", taskId: row.id, data: { subtasks: below.length } });
			}
		} else if (input.statusId) {
			const status = await workflow.getStatus(tx, access.project.id, input.statusId);
			if (!status) throw notFound("Status");
			const moving = rows.filter((row) => row.statusId !== status.id);
			await assertCompletable(tx, access, moving, status.category);
			await assertFieldsComplete(tx, access, moving, status.category);
			const keys = generateKeysBetween(await repo.lastInStatus(tx, status.id), null, moving.length);
			const moved: Array<{ before: TlTaskRow; after: TlTaskRow; status: typeof status }> = [];
			for (const [index, row] of moving.entries()) {
				const after = await repo.patchTask(tx, row.id, {
					statusId: status.id,
					position: keys[index] ?? row.position,
					completedAt: isClosedCategory(status.category) ? (row.completedAt ?? new Date()) : null,
				});
				moved.push({ before: row, after, status });
				entries.push({ kind: "task.moved", taskId: row.id, data: { from: row.statusId, to: status.id } });
			}
			fired.push(...(await afterStatusChanges(tx, access, moved)));
			events.push(
				...(await statusEvents(
					tx,
					access,
					moving.map((task) => ({ task, statusName: status.name })),
				)),
			);
		} else if (input.assigneeId !== undefined || input.priority !== undefined) {
			const fields = input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : { priority: input.priority };
			if (input.assigneeId !== undefined) await checkAssignee(tx, access, input.assigneeId);
			for (const row of rows) {
				const changes = fieldChanges(row.id, row, fields);
				if (changes.length === 0) continue;
				await repo.patchTask(tx, row.id, fields);
				entries.push(...changes);
				fired.push(
					input.assigneeId !== undefined
						? { trigger: "assignee_changed", taskId: row.id }
						: { trigger: "priority_changed", taskId: row.id, priority: input.priority as TaskPriority },
				);
				if (input.assigneeId) {
					events.push({ kind: "assigned", taskId: row.id, to: [input.assigneeId], data: taskData(access, row) });
				}
			}
			if (input.assigneeId) for (const id of ids) await repo.addWatchers(tx, id, [input.assigneeId]);
		} else {
			const labelId = input.addLabelId ?? input.removeLabelId;
			if (!labelId) throw notFound("Label");
			await checkLabels(tx, access, [labelId]);
			const before = await repo.labelIdsOf(tx, ids);
			if (input.addLabelId) await repo.addLabel(tx, ids, labelId);
			else await repo.removeLabel(tx, ids, labelId);
			for (const id of ids) {
				const from = before.get(id) ?? [];
				const to = input.addLabelId ? [...new Set([...from, labelId])].sort() : from.filter((each) => each !== labelId);
				if (from.length === to.length) continue;
				entries.push({ kind: "task.updated", taskId: id, data: { field: "labels", from, to } });
				if (input.addLabelId) fired.push({ trigger: "label_added", taskId: id, labelId });
			}
		}
		await recordActivity(tx, access, ...entries);
		if (entries.length > 0) await bumpRev(tx, access.project.id);
		const actor = actorOf(access, user.id);
		const notify = await produce(tx, access, actor, events);
		notify.push(...(await runAutomations(tx, access, actor, fired)));
		return { result: { count: entries.length }, notify };
	});
	deliverAfter(services, notify);
	return result;
}

/**
 * Deletes a trashed task for good, with its subtasks (the lead's: the trash in the
 * project's settings). What's left is one project entry naming it.
 */
export async function purgeTask({ db, user }: TasklineServices, ws: string, ref: string): Promise<void> {
	await db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, ws, ref);
		assertCan(access, "manage");
		if (!task.deletedAt) throw ruleError("CONFLICT", "Taskline: not in trash", m.taskline_error_not_in_trash());
		const below = await repo.descendantsOf(tx, task.id);
		await collab.removeTaskFiles(tx, [task.id, ...below.map((row) => row.id)]);
		await repo.deleteTasks(tx, [task.id]);
		await recordActivity(tx, access, {
			kind: "task.deleted",
			data: { ref: repo.taskRef(access.project.key, task.number), title: task.title },
		});
		await bumpRev(tx, access.project.id);
	});
}

/** The project's latest history, for its overview. */
export async function listProjectActivity(
	{ db, user }: TasklineServices,
	ws: string,
	key: string,
): Promise<ProjectActivity[]> {
	const access = await resolveProject(db, user, ws, key);
	return repo.projectActivity(db, access.project.id, access.project.key, 30);
}

/** What open pages poll (0209): one small read, resolved like any other. */
export async function getProjectRev({ db, user }: TasklineServices, ws: string, key: string): Promise<ProjectRev> {
	const access = await resolveProject(db, user, ws, key);
	return { rev: access.project.rev };
}

/** One task with its subtasks and history; a trashed one too (the trash opens it). */
export async function getTask(
	{ db, user, imageStore }: TasklineServices,
	ws: string,
	ref: string,
): Promise<TaskDetail> {
	const { access, task } = await resolveTask(db, user, ws, ref);
	return taskDetail(db, access, task, { imageStore, user });
}

export async function createTask(
	services: TasklineServices,
	{ ws, key, id, labelIds = [], description, fields: values, ...input }: CreateTaskInput,
): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	const { detail, notify } = await db.transaction(async (tx) => {
		const access = await resolveProject(tx, user, ws, key);
		assertCan(access, "edit");
		await lockQuota(tx, quotaScope(access.workspace.id));
		const max = quotasOf(access).tasks;
		if ((await repo.countTasks(tx, access.workspace.id)) >= max) throw quotaError("tasks", max);
		const statuses = await workflow.listStatuses(tx, access.project.id);
		const status = input.statusId
			? statuses.find((row) => row.id === input.statusId)
			: (statuses.find((row) => row.category === "unstarted") ?? statuses[0]);
		if (!status) throw notFound("Status");
		const type = taskType(access, input.type);
		await checkAssignee(tx, access, input.assigneeId);
		await checkParent(tx, access, input.parentId);
		await checkLabels(tx, access, labelIds);
		if (input.sprintId) await sprints.checkSprint(tx, access.project.id, input.sprintId);
		await checkMilestone(tx, access, input.milestoneId);
		const checked = values ? await checkValues(tx, access, await projectFields(tx, access), values) : null;
		const text = richText(description);
		const task = await repo.insertTask(tx, {
			...(id ? { id } : {}),
			workspaceId: access.workspace.id,
			projectId: access.project.id,
			number: await nextTaskNumber(tx, access.project.id),
			title: input.title,
			descriptionHtml: text.html,
			descriptionText: text.text,
			type,
			statusId: status.id,
			position: input.position ?? (await repo.endOfStatus(tx, status.id)),
			priority: input.priority,
			assigneeId: input.assigneeId ?? null,
			reporterId: access.member?.id ?? null,
			parentId: input.parentId ?? null,
			startOn: input.startOn ?? null,
			dueOn: input.dueOn ?? null,
			completedAt: isClosedCategory(status.category) ? new Date() : null,
			sprintId: input.sprintId ?? null,
			points: input.points ?? null,
			estimateMinutes: input.estimateMinutes ?? null,
			milestoneId: input.milestoneId ?? null,
			fields: checked?.set ?? {},
		});
		await repo.setLabels(tx, task.id, labelIds);
		await repo.addWatchers(tx, task.id, [task.reporterId, task.assigneeId]);
		await recordActivity(tx, access, { kind: "task.created", taskId: task.id, data: { title: task.title } });
		await bumpRev(tx, access.project.id);
		const actor = actorOf(access, user.id);
		const notify = await produce(tx, access, actor, [
			{ kind: "assigned", taskId: task.id, to: [task.assigneeId], data: taskData(access, task) },
		]);
		notify.push(...(await runAutomations(tx, access, actor, [{ trigger: "task_created", taskId: task.id }])));
		const after = (await repo.getById(tx, access.project.id, task.id)) ?? task;
		return { detail: await taskDetail(tx, access, after, { imageStore, user }), notify };
	});
	deliverAfter(services, notify);
	return detail;
}

/** The title and description, from the version the edit started at. */
export async function updateTask(
	{ db, user, imageStore }: TasklineServices,
	{ ws, ref, version, title, description }: UpdateTaskInput,
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task: before } = await resolveEditable(tx, user, ws, ref);
		const text = richText(description);
		const task = await saveVersioned(tx, tlTask, {
			id: before.id,
			version,
			what: "Task",
			set: { title, descriptionHtml: text.html, descriptionText: text.text },
		});
		const entries: ActivityEntry[] = [];
		if (before.title !== task.title) {
			entries.push({
				kind: "task.updated",
				taskId: task.id,
				data: { field: "title", from: before.title, to: task.title },
			});
		}
		if (before.descriptionHtml !== task.descriptionHtml) {
			entries.push({ kind: "task.updated", taskId: task.id, data: { field: "description" } });
		}
		await recordActivity(tx, access, ...entries);
		await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

/** Single fields (type, priority, assignee, parent, labels, dates); each change goes in the history. */
export async function patchTask(
	services: TasklineServices,
	{ ws, ref, labelIds, fields: values, recurrence, ...fields }: PatchTaskInput,
): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	const { detail, notify } = await db.transaction(async (tx) => {
		const { access, task: before } = await resolveEditable(tx, user, ws, ref);
		if (fields.type !== undefined && fields.type !== before.type) taskType(access, fields.type);
		if (fields.assigneeId !== undefined) await checkAssignee(tx, access, fields.assigneeId);
		if (fields.parentId !== undefined) await checkParent(tx, access, fields.parentId, before);
		if (fields.sprintId && fields.sprintId !== before.sprintId) {
			await sprints.checkSprint(tx, access.project.id, fields.sprintId);
		}
		if (fields.milestoneId && fields.milestoneId !== before.milestoneId) {
			await checkMilestone(tx, access, fields.milestoneId);
		}
		const entries: ActivityEntry[] = [];
		const fired: AutomationEvent[] = [];
		let task = before;
		if (Object.keys(fields).length > 0) {
			task = await repo.patchTask(tx, before.id, fields);
			const changes = fieldChanges(task.id, before, fields);
			entries.push(...changes);
			const changed = new Set(changes.map((entry) => entry.data?.field));
			if (changed.has("assigneeId")) fired.push({ trigger: "assignee_changed", taskId: task.id });
			if (changed.has("priority")) {
				fired.push({ trigger: "priority_changed", taskId: task.id, priority: task.priority as TaskPriority });
			}
		}
		if (labelIds) {
			await checkLabels(tx, access, labelIds);
			const current = (await repo.labelIdsOf(tx, [task.id])).get(task.id) ?? [];
			const next = [...labelIds].sort();
			if (JSON.stringify(current) !== JSON.stringify(next)) {
				await repo.setLabels(tx, task.id, next);
				entries.push({ kind: "task.updated", taskId: task.id, data: { field: "labels", from: current, to: next } });
				for (const labelId of next.filter((each) => !current.includes(each))) {
					fired.push({ trigger: "label_added", taskId: task.id, labelId });
				}
			}
		}
		if (recurrence !== undefined) {
			// Task 56: a rule counts from the due day (else today); a changed rule keeps the task's place in its series.
			const anchor = task.dueOn ?? task.startOn ?? todayInZone(access.settings.timeZone);
			const stored = recurrence ? storedRecurrence(recurrence, anchor, task.recurrence?.n ?? 1) : null;
			if (JSON.stringify(stored) !== JSON.stringify(task.recurrence)) {
				task = await repo.patchTask(tx, task.id, { recurrence: stored });
				entries.push({
					kind: "task.updated",
					taskId: task.id,
					data: { field: "recurrence", to: stored ? stored.freq : null, interval: stored?.interval ?? null },
				});
			}
		}
		if (values && Object.keys(values).length > 0) {
			const defs = await projectFields(tx, access);
			const checked = await checkValues(tx, access, defs, values);
			const changed = valueChanges(task.id, defs, task.fields, checked);
			if (changed.length > 0) {
				await fieldRepo.patchValues(tx, task.id, checked.set, checked.remove);
				task = (await repo.getById(tx, access.project.id, task.id)) ?? task;
				entries.push(...changed);
			}
		}
		if (fields.assigneeId) await repo.addWatchers(tx, task.id, [fields.assigneeId]);
		await recordActivity(tx, access, ...entries);
		if (entries.length > 0) await bumpRev(tx, access.project.id);
		const reassigned = fields.assigneeId && fields.assigneeId !== before.assigneeId ? fields.assigneeId : null;
		const actor = actorOf(access, user.id);
		const notify = await produce(tx, access, actor, [
			{ kind: "assigned", taskId: task.id, to: [reassigned], data: taskData(access, task) },
		]);
		notify.push(...(await runAutomations(tx, access, actor, fired)));
		if (fired.length > 0) task = (await repo.getById(tx, access.project.id, task.id)) ?? task;
		return { detail: await taskDetail(tx, access, task, { imageStore, user }), notify };
	});
	deliverAfter(services, notify);
	return detail;
}

/** A drop on the board: into a status (closing or reopening the task by its category) at a position. */
export async function moveTask(
	services: TasklineServices,
	{ ws, ref, statusId, position }: { ws: string; ref: string; statusId: string; position: string },
): Promise<TaskSummary> {
	const { db, user } = services;
	const { summary, notify } = await db.transaction(async (tx) => {
		const { access, task: before } = await resolveEditable(tx, user, ws, ref);
		const status = await workflow.getStatus(tx, access.project.id, statusId);
		if (!status) throw notFound("Status");
		if (before.statusId !== statusId) {
			await assertCompletable(tx, access, [before], status.category);
			await assertFieldsComplete(tx, access, [before], status.category);
		}
		const completedAt = isClosedCategory(status.category) ? (before.completedAt ?? new Date()) : null;
		let task = await repo.patchTask(tx, before.id, { statusId, position, completedAt });
		let notify: string[] = [];
		if (before.statusId !== statusId) {
			await recordActivity(tx, access, {
				kind: "task.moved",
				taskId: task.id,
				data: { from: before.statusId, to: statusId },
			});
			const actor = actorOf(access, user.id);
			notify = await produce(tx, access, actor, await statusEvents(tx, access, [{ task, statusName: status.name }]));
			const fired = await afterStatusChanges(tx, access, [{ before, after: task, status }]);
			notify.push(...(await runAutomations(tx, access, actor, fired)));
			task = (await repo.getById(tx, access.project.id, task.id)) ?? task;
		}
		await bumpRev(tx, access.project.id);
		return { summary: await summaryOf(tx, access, task), notify };
	});
	deliverAfter(services, notify);
	return summary;
}

export async function setChecklist(
	{ db, user, imageStore }: TasklineServices,
	{ ws, ref, checklist }: { ws: string; ref: string; checklist: ChecklistItem[] },
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task: before } = await resolveEditable(tx, user, ws, ref);
		const task = await repo.patchTask(tx, before.id, { checklist });
		const done = checklist.filter((item) => item.done).length;
		await recordActivity(tx, access, {
			kind: "task.checklist",
			taskId: task.id,
			data: { done, total: checklist.length },
		});
		await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

/** Puts a task in the trash, with its subtasks that aren't there yet (restored together). */
export async function trashTask({ db, user }: TasklineServices, ws: string, ref: string): Promise<void> {
	await db.transaction(async (tx) => {
		const { access, task } = await resolveEditable(tx, user, ws, ref);
		const below = (await repo.descendantsOf(tx, task.id)).filter((row) => !row.deletedAt);
		await repo.setDeleted(tx, [task.id, ...below.map((row) => row.id)], new Date());
		await recordActivity(tx, access, { kind: "task.trashed", taskId: task.id, data: { subtasks: below.length } });
		await bumpRev(tx, access.project.id);
	});
}

/**
 * Takes a task out of the trash with the subtasks that went in with it. If its parent
 * is still in the trash, it comes back as a top-level task.
 */
export async function restoreTask(
	{ db, user, imageStore }: TasklineServices,
	ws: string,
	ref: string,
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, ws, ref);
		assertCan(access, "edit");
		if (!task.deletedAt) return taskDetail(tx, access, task, { imageStore, user });
		const trashedAt = task.deletedAt.getTime();
		const together = (await repo.descendantsOf(tx, task.id)).filter((row) => row.deletedAt?.getTime() === trashedAt);
		await repo.setDeleted(tx, [task.id, ...together.map((row) => row.id)], null);
		let restored: TlTaskRow = { ...task, deletedAt: null };
		if (task.parentId) {
			const parent = await repo.getById(tx, access.project.id, task.parentId);
			if (parent?.deletedAt) restored = await repo.patchTask(tx, task.id, { parentId: null });
		}
		await recordActivity(tx, access, { kind: "task.restored", taskId: task.id, data: { subtasks: together.length } });
		await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, restored, { imageStore, user });
	});
}

export async function listTrash({ db, user }: TasklineServices, ws: string, key: string): Promise<TrashedTask[]> {
	const access = await resolveProject(db, user, ws, key);
	return repo.listTrash(db, access.project.id, access.project.key);
}
