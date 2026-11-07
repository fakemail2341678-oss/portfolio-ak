import { z } from "zod";
import { formatNumber } from "@/lib/i18n/intl";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { type AutomationDefinition, automationDefinition } from "./automation-rules";
import { FIELD_NAME_MAX, fieldDefinition, fieldFilterChoices, fieldOption } from "./fields";
import { CHECKLIST_MAX, LABEL_NAME_MAX, STATUS_NAME_MAX, TASK_TITLE_MAX } from "./schema";
import { projectSettings } from "./settings";
import {
	AUTOMATIONS_MAX,
	ESTIMATE_MAX_MINUTES,
	FIELD_OPTIONS_MAX,
	FIELD_TYPES,
	FIELDS_MAX,
	isClosedCategory,
	POINTS_MAX,
	STATUS_CATEGORIES,
	TASK_PRIORITIES,
	TASK_TYPES,
	TASKLINE_COLORS,
	type TaskField,
	type TemplateCounts,
} from "./types";

/**
 * What a project template holds (Task 57, decision 0224), the same for the built-ins in
 * code, the admin's templates in `tl_template` and a template's JSON file: statuses,
 * labels, fields, automations, settings, milestones and sample tasks with dates relative
 * to the start. Nothing in it belongs to a project. Statuses, labels, fields and
 * milestones carry a local `id` (a uuid, which automations can name unchanged) that the
 * rest of the definition refers to; creating a project gives each a new id. A rule can't
 * name a member or a sprint: neither exists yet. Pure and shared: the admin's dialog
 * checks what's typed with this, and the server checks it again.
 */

export const TEMPLATE_NAME_MAX = 80;
export const TEMPLATE_DESCRIPTION_MAX = 500;
export const TEMPLATE_TASK_DESCRIPTION_MAX = 2000;
export const TEMPLATE_STATUSES_MAX = 50;
export const TEMPLATE_LABELS_MAX = 100;
export const TEMPLATE_MILESTONES_MAX = 50;
export const TEMPLATE_TASKS_MAX = 200;
/** Templates the team keeps. */
export const TEMPLATES_MAX = 100;
/** How far from the start a template's day may be (ten years either way). */
const OFFSET_MAX = 3650;
const MILESTONE_NAME_MAX = 80;
const MILESTONE_DESCRIPTION_MAX = 2000;

const ref = z.uuid();
const color = z.enum(TASKLINE_COLORS);
const offset = z.number().int().min(-OFFSET_MAX).max(OFFSET_MAX);

const templateStatus = z.strictObject({
	id: ref,
	name: required({ max: STATUS_NAME_MAX }),
	category: z.enum(STATUS_CATEGORIES),
	color,
	wipLimit: z.number().int().min(1).max(999).nullable().default(null),
});

const templateLabel = z.strictObject({ id: ref, name: required({ max: LABEL_NAME_MAX }), color });

const templateField = z.strictObject({
	id: ref,
	name: required({ max: FIELD_NAME_MAX }),
	type: z.enum(FIELD_TYPES),
	required: z.boolean().default(false),
	options: z.array(fieldOption).max(FIELD_OPTIONS_MAX).default([]),
});

const templateMilestone = z.strictObject({
	id: ref,
	name: required({ max: MILESTONE_NAME_MAX }),
	description: optionalText({ max: MILESTONE_DESCRIPTION_MAX }).default(""),
	dueOffset: offset.nullable().default(null),
});

const templateTask = z.strictObject({
	title: required({ max: TASK_TITLE_MAX }),
	/** Plain text: a paragraph per line. */
	description: optionalText({ max: TEMPLATE_TASK_DESCRIPTION_MAX }).default(""),
	type: z.enum(TASK_TYPES).default("task"),
	priority: z
		.number()
		.int()
		.refine((value) => (TASK_PRIORITIES as readonly number[]).includes(value))
		.default(0),
	status: ref,
	labels: z.array(ref).max(20).default([]),
	milestone: ref.nullable().default(null),
	/** An earlier task of this list, by its place in it (0 is the first). */
	parent: z.number().int().min(0).nullable().default(null),
	startOffset: offset.nullable().default(null),
	dueOffset: offset.nullable().default(null),
	checklist: z
		.array(required({ max: TASK_TITLE_MAX }))
		.max(CHECKLIST_MAX)
		.default([]),
	points: z.number().int().min(0).max(POINTS_MAX).nullable().default(null),
	estimateMinutes: z.number().int().min(0).max(ESTIMATE_MAX_MINUTES).nullable().default(null),
});

const uuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** What a template's rules may name: its own statuses, labels and fields. */
export type TemplateNames = {
	statusIds: ReadonlySet<string>;
	labelIds: ReadonlySet<string>;
	fields: ReadonlyArray<TaskField>;
};

/** A template's field as the task field it becomes, for the helpers that read one. */
const asTaskField = (field: z.output<typeof templateField>): TaskField => ({
	...field,
	projectId: null,
	position: "",
	archived: false,
});

/** Whether a rule names only what the template has: never a member or a sprint. */
export function ruleFitsTemplate(rule: AutomationDefinition, names: TemplateNames): boolean {
	const { trigger } = rule;
	if (trigger.type === "status_changed" && trigger.statusId && !names.statusIds.has(trigger.statusId)) return false;
	if (trigger.type === "label_added" && trigger.labelId && !names.labelIds.has(trigger.labelId)) return false;
	for (const condition of rule.conditions) {
		if (condition.type === "label" && !names.labelIds.has(condition.labelId)) return false;
		if (condition.type === "assignee" && uuidLike(condition.is)) return false;
		if (condition.type === "field") {
			const field = names.fields.find((each) => each.id === condition.fieldId);
			if (!field) return false;
			const choices = fieldFilterChoices(field, [], { member: false }).map((choice) => choice.value);
			if (!choices.includes(condition.value)) return false;
		}
	}
	for (const action of rule.actions) {
		switch (action.type) {
			case "set_status":
				if (action.statusId && !names.statusIds.has(action.statusId)) return false;
				break;
			case "add_label":
			case "remove_label":
				if (!names.labelIds.has(action.labelId)) return false;
				break;
			case "assign":
			case "notify":
			case "set_sprint":
				if (uuidLike(action.to)) return false;
				break;
		}
	}
	return true;
}

/** Whether a name repeats, in any case. */
const repeats = (names: ReadonlyArray<string>) =>
	new Set(names.map((name) => name.toLowerCase())).size !== names.length;

export const templateDefinition = z
	.strictObject({
		statuses: z.array(templateStatus).min(2).max(TEMPLATE_STATUSES_MAX),
		labels: z.array(templateLabel).max(TEMPLATE_LABELS_MAX).default([]),
		fields: z.array(templateField).max(FIELDS_MAX).default([]),
		automations: z.array(automationDefinition).max(AUTOMATIONS_MAX).default([]),
		settings: projectSettings,
		milestones: z.array(templateMilestone).max(TEMPLATE_MILESTONES_MAX).default([]),
		tasks: z.array(templateTask).max(TEMPLATE_TASKS_MAX).default([]),
	})
	.superRefine((value, context) => {
		const problem = (path: PropertyKey[], message: string) => context.addIssue({ code: "custom", path, message });
		const reference = (path: PropertyKey[]) => problem(path, m.taskline_template_error_reference());
		const closed = value.statuses.filter((status) => isClosedCategory(status.category));
		if (closed.length === value.statuses.length || !closed.some((status) => status.category === "completed")) {
			problem(["statuses"], m.taskline_template_error_statuses());
		}
		for (const [where, names] of [
			["statuses", value.statuses.map((status) => status.name)],
			["labels", value.labels.map((label) => label.name)],
			["fields", value.fields.map((field) => field.name)],
		] as const) {
			if (repeats(names)) problem([where], m.taskline_template_error_names());
		}
		const ids = [...value.statuses, ...value.labels, ...value.fields, ...value.milestones].map((each) => each.id);
		if (new Set(ids).size !== ids.length) problem([], m.taskline_template_error_ids());
		for (const [index, field] of value.fields.entries()) {
			const { id: _id, options, ...rest } = field;
			const typed = field.type === "select" || field.type === "multi_select" ? { ...rest, options } : rest;
			const valid = fieldDefinition.safeParse(typed);
			if (!valid.success)
				problem(["fields", index], valid.error.issues[0]?.message ?? m.taskline_template_error_invalid());
		}
		const names: TemplateNames = {
			statusIds: new Set(value.statuses.map((status) => status.id)),
			labelIds: new Set(value.labels.map((label) => label.id)),
			fields: value.fields.map(asTaskField),
		};
		const milestoneIds = new Set(value.milestones.map((milestone) => milestone.id));
		for (const [index, rule] of value.automations.entries()) {
			if (!ruleFitsTemplate(rule, names)) reference(["automations", index]);
		}
		for (const [index, task] of value.tasks.entries()) {
			if (!names.statusIds.has(task.status)) reference(["tasks", index, "status"]);
			if (task.milestone && !milestoneIds.has(task.milestone)) reference(["tasks", index, "milestone"]);
			if (task.labels.some((label) => !names.labelIds.has(label))) reference(["tasks", index, "labels"]);
			if (task.parent !== null) {
				const parent = value.tasks[task.parent];
				if (task.parent >= index || !parent) reference(["tasks", index, "parent"]);
				// Three levels at most (MAX_TASK_DEPTH): a task, its subtask, and that one's.
				else if (parent.parent !== null && value.tasks[parent.parent]?.parent != null) {
					reference(["tasks", index, "parent"]);
				}
			}
		}
	});
export type TemplateDefinition = z.output<typeof templateDefinition>;
export type TemplateDefinitionInput = z.input<typeof templateDefinition>;

const templateName = () => required({ max: TEMPLATE_NAME_MAX });
const templateDescription = () => optionalText({ max: TEMPLATE_DESCRIPTION_MAX });

/** A template as a file: what "Export" saves and "Import" reads. */
export const templateFile = z.strictObject({
	name: templateName(),
	description: templateDescription().default(""),
	definition: templateDefinition,
});
export type TemplateFile = z.output<typeof templateFile>;

/** The numbers a picker shows of a template. */
export const templateCounts = (definition: TemplateDefinition): TemplateCounts => ({
	statuses: definition.statuses.length,
	labels: definition.labels.length,
	fields: definition.fields.length,
	automations: definition.automations.length,
	milestones: definition.milestones.length,
	tasks: definition.tasks.length,
});

/** Reads JSON text with a schema; the first problem says where it is. */
export function parseTemplateJson<T>(
	schema: z.ZodType<T>,
	text: string,
): { ok: true; value: T } | { ok: false; message: string } {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return { ok: false, message: m.taskline_template_error_json() };
	}
	const parsed = schema.safeParse(json);
	if (parsed.success) return { ok: true, value: parsed.data };
	const issue = parsed.error.issues[0];
	if (!issue) return { ok: false, message: m.taskline_template_error_invalid() };
	const path = issue.path.map((part) => (typeof part === "number" ? formatNumber(part + 1) : String(part))).join(" › ");
	return { ok: false, message: path ? `${path}: ${issue.message}` : issue.message };
}

/** The local ids a definition's rows carry, each with a new one: creating a project uses these. */
export function freshTemplateIds(definition: TemplateDefinition): Map<string, string> {
	const rows = [...definition.statuses, ...definition.labels, ...definition.fields, ...definition.milestones];
	return new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
}

/** Points a rule at new ids (uuids, so a text replace is exact; a field's options keep theirs). */
export function ruleWithIds(rule: AutomationDefinition, ids: ReadonlyMap<string, string>): AutomationDefinition {
	const text = JSON.stringify(rule).replace(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
		(id) => ids.get(id) ?? id,
	);
	return automationDefinition.parse(JSON.parse(text));
}
