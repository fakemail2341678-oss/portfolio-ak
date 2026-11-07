import "@tanstack/react-start/server-only";
import {
	freshTemplateIds,
	ruleWithIds,
	type TemplateDefinition,
	templateCounts,
} from "@/features/taskline/template-definition";
import {
	BUILTIN_TEMPLATES,
	type BuiltinTemplate,
	isClosedCategory,
	type StatusCategory,
	type TasklineColor,
	type TaskPriority,
	type TemplateChoice,
} from "@/features/taskline/types";
import { generateKeysBetween } from "@/lib/fractional-index";
import { addDays } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { Db, Tx } from "@/server/db/types";
import { type ProjectAccess, resolveWorkspace, type TasklineServices, type WorkspaceAccess } from "../access";
import { recordActivity } from "../activity";
import { addAutomation } from "../automations/service";
import * as fieldRepo from "../fields/repository";
import { reserveTaskNumbers } from "../rev";
import { fieldError, quotaError, quotasOf } from "../rules";
import { plainDescription } from "../tasks/import";
import * as tasks from "../tasks/repository";
import * as timeline from "../timeline/repository";
import * as workflow from "../workflow/repository";
import { builtinTemplate } from "./builtin";
import * as repo from "./repository";

/**
 * Creating a project from a template (Task 57, decision 0224): a built-in or one of the
 * team's. Everything is written inside the project's transaction, through repositories:
 * nobody is notified and no automation fires, as with the CSV import. Sample tasks have
 * no assignee; their days count from the project's start.
 */

export type ChosenTemplate = {
	name: string;
	definition: TemplateDefinition;
	/** Each local id with the new id of the row it becomes. */
	ids: ReadonlyMap<string, string>;
};

const isBuiltin = (id: string): id is BuiltinTemplate => (BUILTIN_TEMPLATES as readonly string[]).includes(id);

/** The built-ins, then the workspace's own, as "New project" offers them. */
export async function templateChoices(db: Db, workspaceId: string, locale?: Locale): Promise<TemplateChoice[]> {
	const saved = await repo.listTemplates(db, workspaceId);
	return [
		...BUILTIN_TEMPLATES.map((id): TemplateChoice => {
			const { name, description, definition } = builtinTemplate(id, locale);
			return { id, name, description, builtin: true, counts: templateCounts(definition) };
		}),
		...saved.map(
			(row): TemplateChoice => ({
				id: row.id,
				name: row.name,
				description: row.description,
				builtin: false,
				counts: templateCounts(row.definition),
			}),
		),
	];
}

/** What "New project" offers the caller in a workspace they can reach. */
export async function listTemplates({ db, user }: TasklineServices, { ws }: { ws: string }): Promise<TemplateChoice[]> {
	const access = await resolveWorkspace(db, user, ws);
	return templateChoices(db, access.workspace.id);
}

/**
 * The template a new project starts from, checked against the workspace's quotas; the
 * caller holds the quota lock. A template that isn't the workspace's is a field error,
 * never someone else's: a sandbox has only the built-ins.
 */
export async function chooseTemplate(
	tx: Tx,
	access: WorkspaceAccess,
	id: string,
	locale?: Locale,
): Promise<ChosenTemplate> {
	const row = isBuiltin(id) ? null : await repo.getTemplate(tx, access.workspace.id, id);
	if (!isBuiltin(id) && !row) throw fieldError("BAD_REQUEST", "template", m.taskline_template_error_missing());
	const { name, definition } = isBuiltin(id)
		? builtinTemplate(id, locale)
		: { name: row?.name ?? "", definition: row?.definition as TemplateDefinition };
	const quotas = quotasOf(access);
	if (definition.statuses.length > quotas.statusesPerProject) throw quotaError("statuses", quotas.statusesPerProject);
	if ((await tasks.countTasks(tx, access.workspace.id)) + definition.tasks.length > quotas.tasks) {
		throw quotaError("tasks", quotas.tasks);
	}
	return { name, definition, ids: freshTemplateIds(definition) };
}

const newId = (template: ChosenTemplate, localId: string) => {
	const id = template.ids.get(localId);
	if (!id) throw new Error("Template: unknown local id");
	return id;
};

/** The statuses a project from this template starts with, with their new ids. */
export const templateStatuses = (
	template: ChosenTemplate,
): ReadonlyArray<{
	id: string;
	name: string;
	category: StatusCategory;
	color: TasklineColor;
	wipLimit: number | null;
}> => template.definition.statuses.map(({ id, ...status }) => ({ ...status, id: newId(template, id) }));

/**
 * The rest of the template, once the project and its statuses exist: labels (a workspace
 * label with the same name is used instead of a second one), fields, rules, milestones
 * and the sample tasks.
 */
export async function applyTemplate(
	tx: Tx,
	access: ProjectAccess,
	template: ChosenTemplate,
	startOn: string,
): Promise<void> {
	const { definition } = template;
	const workspaceId = access.workspace.id;
	const projectId = access.project.id;
	const ids = new Map(template.ids);

	const shared = new Map(
		(await workflow.listWorkspaceLabels(tx, workspaceId)).map((label) => [label.name.toLowerCase(), label.id]),
	);
	const ownLabels = definition.labels.filter((label) => {
		const existing = shared.get(label.name.toLowerCase());
		if (existing) ids.set(label.id, existing);
		return !existing;
	});
	await workflow.insertLabels(
		tx,
		ownLabels.map((label) => ({
			id: newId(template, label.id),
			workspaceId,
			projectId,
			name: label.name,
			color: label.color,
		})),
	);

	const fieldPositions = generateKeysBetween(null, null, definition.fields.length);
	for (const [index, field] of definition.fields.entries()) {
		await fieldRepo.insertField(tx, {
			id: newId(template, field.id),
			workspaceId,
			projectId,
			name: field.name,
			type: field.type,
			options: field.options,
			required: field.required,
			position: fieldPositions[index] ?? `a${index}`,
		});
	}

	for (const rule of definition.automations) {
		await addAutomation(tx, { workspaceId, projectId }, ruleWithIds(rule, ids), access.member?.id ?? null);
	}

	const dayOf = (offset: number | null) => (offset === null ? null : addDays(startOn, offset));
	const milestonePositions = generateKeysBetween(null, null, definition.milestones.length);
	for (const [index, milestone] of definition.milestones.entries()) {
		await timeline.insertMilestone(tx, {
			id: newId(template, milestone.id),
			projectId,
			name: milestone.name,
			description: milestone.description,
			dueOn: dayOf(milestone.dueOffset),
			position: milestonePositions[index] ?? `a${index}`,
		});
	}

	if (definition.tasks.length === 0) return;
	const categoryOf = new Map(definition.statuses.map((status) => [status.id, status.category]));
	const positions = new Map<string, string[]>();
	for (const status of definition.statuses) {
		const inIt = definition.tasks.filter((task) => task.status === status.id).length;
		positions.set(status.id, generateKeysBetween(null, null, inIt));
	}
	const ranks = generateKeysBetween(null, null, definition.tasks.length);
	const firstNumber = await reserveTaskNumbers(tx, projectId, definition.tasks.length);
	const taskIds = definition.tasks.map(() => crypto.randomUUID());
	const offered = access.settings.taskTypes;
	const fallbackType = offered.includes("task") ? "task" : (offered[0] ?? "task");
	const reporterId = access.member?.id ?? null;
	const now = new Date();
	const rows = definition.tasks.map((task, index) => {
		const text = plainDescription(task.description);
		const category = categoryOf.get(task.status);
		return {
			id: taskIds[index],
			workspaceId,
			projectId,
			number: firstNumber + index,
			title: task.title,
			descriptionHtml: text.html,
			descriptionText: text.text,
			type: offered.includes(task.type) ? task.type : fallbackType,
			statusId: newId(template, task.status),
			position: positions.get(task.status)?.shift() ?? "a0",
			rank: ranks[index] ?? "a0",
			priority: task.priority as TaskPriority,
			reporterId,
			parentId: task.parent === null ? null : (taskIds[task.parent] ?? null),
			milestoneId: task.milestone ? newId(template, task.milestone) : null,
			startOn: dayOf(task.startOffset),
			dueOn: dayOf(task.dueOffset),
			checklist: task.checklist.map((text) => ({ id: crypto.randomUUID(), text, done: false })),
			points: task.points,
			estimateMinutes: task.estimateMinutes,
			completedAt: category && isClosedCategory(category) ? now : null,
		};
	});
	await tasks.insertTasks(tx, rows);
	await tasks.linkTasks(
		tx,
		definition.tasks.flatMap((task, index) => {
			const taskId = taskIds[index];
			return taskId ? task.labels.flatMap((label) => [{ taskId, labelId: ids.get(label) ?? label }]) : [];
		}),
		reporterId ? taskIds.flatMap((taskId) => (taskId ? [{ taskId, memberId: reporterId }] : [])) : [],
	);
	await recordActivity(
		tx,
		access,
		...rows.flatMap((row) =>
			row.id ? [{ kind: "task.created" as const, taskId: row.id, data: { title: row.title, imported: true } }] : [],
		),
	);
}
