import "@tanstack/react-start/server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type {
	AdminCreateTemplateInput,
	AdminTemplate,
	AdminTemplates,
	AdminUpdateTemplateInput,
	SavedProjectTemplate,
	SaveProjectAsTemplateInput,
} from "@/features/taskline/admin/schema";
import { projectSettings } from "@/features/taskline/settings";
import {
	ruleFitsTemplate,
	TEMPLATE_TASK_DESCRIPTION_MAX,
	TEMPLATE_TASKS_MAX,
	TEMPLATES_MAX,
	templateCounts,
	templateDefinition,
} from "@/features/taskline/template-definition";
import { BUILTIN_TEMPLATES, type TemplateChoice } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { todayInZone } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { changes } from "@/server/audit/record";
import { notFound, uniqueViolation, withAudit } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import { type TlProjectRow, type TlTemplateRow, tlTask, tlTaskLabel, tlTemplate } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import type { Services } from "@/server/services";
import * as automationRepo from "../automations/repository";
import * as fieldRepo from "../fields/repository";
import { saveVersioned } from "../rev";
import { builtinTemplate } from "../templates/builtin";
import * as repo from "../templates/repository";
import { templateChoices } from "../templates/service";
import * as timeline from "../timeline/repository";
import * as workflow from "../workflow/repository";
import { team, teamProject } from "./team";

/**
 * /admin/taskline/templates (Task 57, decision 0224; `taskline:configure`, each change
 * audited): the team's templates beside the built-ins, which read only. Definitions are
 * checked by `templateDefinition` on the way in; "Save project as template" writes one
 * from a project's workflow, labels, fields, rules, milestones and, if asked, its tasks.
 */

const target = (row: Pick<TlTemplateRow, "id" | "name">) => ({
	type: "taskline-template" as const,
	id: row.id,
	label: row.name,
});

/** What the audit log keeps of a template: its name and how much it holds. */
const summary = (row: Pick<TlTemplateRow, "name" | "description" | "definition">) => ({
	name: row.name,
	description: row.description,
	...templateCounts(row.definition),
});

const nameTaken = () => ({
	tl_template_name_unique: { field: "name", message: m.taskline_template_error_name_taken },
});

const rowDto = (row: TlTemplateRow): AdminTemplate => ({
	id: row.id,
	name: row.name,
	description: row.description,
	builtin: false,
	version: row.version,
	updatedAt: row.updatedAt.toISOString(),
	definition: row.definition,
});

async function view(db: Db, workspaceId: string): Promise<AdminTemplates> {
	const saved = await repo.listTemplates(db, workspaceId);
	return {
		builtins: BUILTIN_TEMPLATES.map((id): AdminTemplate => {
			const template = builtinTemplate(id);
			return { ...template, id, builtin: true, version: 0, updatedAt: null };
		}),
		templates: saved.map(rowDto),
	};
}

export async function listTemplates({ db }: Pick<Services, "db">): Promise<AdminTemplates> {
	const { workspace } = await team(db);
	return view(db, workspace.id);
}

/** What the admin's "New project" offers. */
export async function listTemplateChoices({ db }: Pick<Services, "db">): Promise<TemplateChoice[]> {
	const { workspace } = await team(db);
	return templateChoices(db, workspace.id);
}

async function insert(tx: Tx, workspaceId: string, values: AdminCreateTemplateInput): Promise<TlTemplateRow> {
	await lockQuota(tx, `taskline:templates:${workspaceId}`);
	if ((await repo.countTemplates(tx, workspaceId)) >= TEMPLATES_MAX) {
		throw ruleError(
			"CONFLICT",
			"Taskline quota reached: templates",
			m.taskline_template_error_quota({ max: formatNumber(TEMPLATES_MAX) }),
		);
	}
	try {
		return await repo.insertTemplate(tx, { workspaceId, ...values });
	} catch (error) {
		throw uniqueViolation(error, nameTaken());
	}
}

/** A new template, typed or imported. */
export async function createTemplate({ db, actor }: Services, input: AdminCreateTemplateInput) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminTemplates> => {
		const { workspace } = await team(tx);
		const row = await insert(tx, workspace.id, input);
		audit({ action: "taskline.template.create", target: target(row), after: summary(row) });
		return view(tx, workspace.id);
	});
}

export async function updateTemplate({ db, actor }: Services, { id, version, ...values }: AdminUpdateTemplateInput) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminTemplates> => {
		const { workspace } = await team(tx);
		const before = await repo.getTemplate(tx, workspace.id, id);
		if (!before) throw notFound("Template");
		let after: TlTemplateRow;
		try {
			after = await saveVersioned(tx, tlTemplate, { id, version, what: "Template", set: values });
		} catch (error) {
			throw uniqueViolation(error, nameTaken());
		}
		const changed = changes(summary(before), summary(after), [
			"name",
			"description",
			"statuses",
			"labels",
			"fields",
			"automations",
			"milestones",
			"tasks",
		] as const);
		audit({ action: "taskline.template.update", target: target(after), ...(changed ?? {}) });
		return view(tx, workspace.id);
	});
}

export async function deleteTemplate({ db, actor }: Services, { id }: { id: string }) {
	return withAudit(db, actor, async (tx, audit): Promise<AdminTemplates> => {
		const { workspace } = await team(tx);
		const row = await repo.getTemplate(tx, workspace.id, id);
		if (!row) throw notFound("Template");
		await repo.deleteTemplate(tx, id);
		audit({ action: "taskline.template.delete", target: target(row), before: summary(row) });
		return view(tx, workspace.id);
	});
}

const dayGap = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * A project as a definition. Its own labels, fields and rules go; what belongs to the
 * workspace or to people doesn't, so a rule naming a workspace label or field, a member
 * or a sprint is left out, and counted. Days count from the project's start, else its
 * earliest date. Tasks go first by depth, so a parent is always before its subtasks.
 */
async function definitionOf(db: Db, project: TlProjectRow, withTasks: boolean, timeZone: string) {
	const scope = { workspaceId: project.workspaceId, projectId: project.id };
	const statuses = await workflow.listStatuses(db, project.id);
	const labels = (await workflow.listLabels(db, project.workspaceId, project.id)).filter(
		(label) => label.projectId === project.id,
	);
	const fields = (await fieldRepo.scopeFields(db, scope)).filter((field) => field.archivedAt === null);
	const rules = await automationRepo.listScope(db, scope);
	const milestones = await timeline.listMilestones(db, project.id);
	const tasks = withTasks
		? await db
				.select()
				.from(tlTask)
				.where(and(eq(tlTask.projectId, project.id), isNull(tlTask.deletedAt)))
				.orderBy(asc(tlTask.number))
		: [];

	const names = {
		statusIds: new Set(statuses.map((status) => status.id)),
		labelIds: new Set(labels.map((label) => label.id)),
		fields: fields.map(fieldRepo.fieldDto),
	};
	const kept = rules
		.map(({ name, enabled, trigger, conditions, actions }) => ({ name, enabled, trigger, conditions, actions }))
		.filter((rule) => ruleFitsTemplate(rule, names));

	const depthOf = new Map<string, number>();
	const byId = new Map(tasks.map((task) => [task.id, task]));
	const depth = (id: string): number => {
		const known = depthOf.get(id);
		if (known !== undefined) return known;
		const parent = byId.get(id)?.parentId;
		const value = parent && byId.has(parent) ? depth(parent) + 1 : 0;
		depthOf.set(id, value);
		return value;
	};
	const ordered = [...tasks]
		.sort((a, b) => depth(a.id) - depth(b.id) || a.number - b.number)
		.slice(0, TEMPLATE_TASKS_MAX);
	const placeOf = new Map(ordered.map((task, index) => [task.id, index]));

	const days = [
		...ordered.flatMap((task) => [task.startOn, task.dueOn]),
		...milestones.map((milestone) => milestone.dueOn),
	].filter((day): day is string => day !== null);
	const base = project.startOn ?? days.sort()[0] ?? todayInZone(timeZone);
	const offsetOf = (day: string | null) => (day === null ? null : dayGap(base, day));

	const taskLabels = ordered.length
		? await db
				.select({ taskId: tlTaskLabel.taskId, labelId: tlTaskLabel.labelId })
				.from(tlTaskLabel)
				.innerJoin(tlTask, eq(tlTask.id, tlTaskLabel.taskId))
				.where(eq(tlTask.projectId, project.id))
		: [];

	return {
		leftOut: rules.length - kept.length,
		parsed: templateDefinition.safeParse({
			statuses: statuses.map(({ id, name, category, color, wipLimit }) => ({ id, name, category, color, wipLimit })),
			labels: labels.map(({ id, name, color }) => ({ id, name, color })),
			fields: fields.map(({ id, name, type, required, options }) => ({ id, name, type, required, options })),
			automations: kept,
			settings: projectSettings.parse(project.settings),
			milestones: milestones.map(({ id, name, description, dueOn }) => ({
				id,
				name,
				description,
				dueOffset: offsetOf(dueOn),
			})),
			tasks: ordered.map((task) => ({
				title: task.title,
				description: task.descriptionText.slice(0, TEMPLATE_TASK_DESCRIPTION_MAX),
				type: task.type,
				priority: task.priority,
				status: task.statusId,
				labels: taskLabels
					.filter((link) => link.taskId === task.id && names.labelIds.has(link.labelId))
					.map((link) => link.labelId),
				milestone: task.milestoneId,
				parent: task.parentId ? (placeOf.get(task.parentId) ?? null) : null,
				startOffset: offsetOf(task.startOn),
				dueOffset: offsetOf(task.dueOn),
				checklist: task.checklist.map((item) => item.text),
				points: task.points,
				estimateMinutes: task.estimateMinutes,
			})),
		}),
	};
}

/** "Save project as template": a new template from a team project. */
export async function saveProjectAsTemplate(
	{ db, actor }: Services,
	{ projectId, name, description, tasks }: SaveProjectAsTemplateInput,
): Promise<SavedProjectTemplate> {
	return withAudit(db, actor, async (tx, audit) => {
		const { workspace, settings } = await team(tx);
		const project = await teamProject(tx, workspace.id, projectId);
		const { parsed, leftOut } = await definitionOf(tx, project, tasks, settings.timeZone);
		if (!parsed.success) {
			throw ruleError(
				"CONFLICT",
				"Taskline: project can't be a template",
				parsed.error.issues[0]?.message ?? m.taskline_template_error_invalid(),
			);
		}
		const row = await insert(tx, workspace.id, { name, description, definition: parsed.data });
		audit({
			action: "taskline.template.create",
			target: target(row),
			after: { ...summary(row), from: project.key, leftOut },
		});
		return { id: row.id, name: row.name, leftOut };
	});
}
