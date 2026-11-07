import { z } from "zod";
import { optionalText, required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { matchesFieldFilter } from "./fields";
import {
	AUTOMATION_ACTIONS_MAX,
	AUTOMATION_CONDITIONS_MAX,
	type AutomationAction,
	type AutomationCondition,
	type AutomationTrigger,
	type FieldValue,
	STATUS_CATEGORIES,
	type StatusCategory,
	TASK_TYPES,
	type TaskField,
	type TaskPriority,
	type TaskType,
} from "./types";

/**
 * Automations (Task 56, decision 0221): what one is, checked the same in the builder
 * and on the server, and whether a task matches its conditions. The server checks
 * the ids it names against the scope (a project's statuses, labels, sprints and
 * fields, or for a workspace rule only what every team project shares).
 */

export const AUTOMATION_NAME_MAX = 80;
export const AUTOMATION_COMMENT_MAX = 1000;
export const AUTOMATION_MESSAGE_MAX = 200;
export const AUTOMATION_SUBTASKS_MAX = 10;
export const AUTOMATION_SUBTASK_TITLE_MAX = 240;
export const AUTOMATION_DUE_DAYS_MAX = 365;
export const AUTOMATION_SOON_DAYS_MAX = 30;

const id = z.uuid();
const priority = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const category = z.enum(STATUS_CATEGORIES);

export const automationTrigger = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("task_created") }),
	z.strictObject({ type: z.literal("status_changed"), statusId: id.optional(), category: category.optional() }),
	z.strictObject({ type: z.literal("assignee_changed") }),
	z.strictObject({ type: z.literal("priority_changed"), priority: priority.optional() }),
	z.strictObject({ type: z.literal("label_added"), labelId: id.optional() }),
	z.strictObject({ type: z.literal("comment_added") }),
	z.strictObject({ type: z.literal("subtasks_done") }),
	z.strictObject({ type: z.literal("sprint_started") }),
	z.strictObject({ type: z.literal("due_soon"), days: z.number().int().min(1).max(AUTOMATION_SOON_DAYS_MAX) }),
	z.strictObject({ type: z.literal("overdue") }),
]) satisfies z.ZodType<AutomationTrigger>;

export const automationCondition = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("task_type"), in: z.array(z.enum(TASK_TYPES)).min(1).max(TASK_TYPES.length) }),
	z.strictObject({ type: z.literal("priority"), in: z.array(priority).min(1).max(5) }),
	z.strictObject({ type: z.literal("category"), in: z.array(category).min(1).max(STATUS_CATEGORIES.length) }),
	z.strictObject({ type: z.literal("label"), labelId: id, has: z.boolean() }),
	z.strictObject({ type: z.literal("assignee"), is: z.union([id, z.enum(["none", "any"])]) }),
	z.strictObject({ type: z.literal("field"), fieldId: id, value: z.string().min(1).max(80) }),
]) satisfies z.ZodType<AutomationCondition>;

export const automationAction = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("set_status"), statusId: id.optional(), category: category.optional() }),
	z.strictObject({ type: z.literal("assign"), to: z.union([id, z.enum(["none", "lead", "reporter"])]) }),
	z.strictObject({ type: z.literal("set_priority"), priority }),
	z.strictObject({ type: z.literal("add_label"), labelId: id }),
	z.strictObject({ type: z.literal("remove_label"), labelId: id }),
	z.strictObject({ type: z.literal("set_sprint"), to: z.union([id, z.enum(["active", "none"])]) }),
	z.strictObject({ type: z.literal("set_due"), days: z.number().int().min(0).max(AUTOMATION_DUE_DAYS_MAX) }),
	z.strictObject({ type: z.literal("comment"), text: required({ max: AUTOMATION_COMMENT_MAX }) }),
	z.strictObject({
		type: z.literal("notify"),
		to: z.union([id, z.enum(["assignee", "reporter", "watchers", "lead"])]),
		message: optionalText({ max: AUTOMATION_MESSAGE_MAX }),
	}),
	z.strictObject({
		type: z.literal("subtasks"),
		titles: z
			.array(required({ max: AUTOMATION_SUBTASK_TITLE_MAX }))
			.min(1)
			.max(AUTOMATION_SUBTASKS_MAX),
	}),
]) satisfies z.ZodType<AutomationAction>;

/** "Into a status" names one status or one category, not both; "set status" names exactly one. */
const oneTarget = (value: { statusId?: string; category?: StatusCategory }) => !(value.statusId && value.category);

/** An automation as the builder saves it. */
export const automationDefinition = z
	.strictObject({
		name: required({ max: AUTOMATION_NAME_MAX }),
		enabled: z.boolean(),
		trigger: automationTrigger,
		conditions: z.array(automationCondition).max(AUTOMATION_CONDITIONS_MAX),
		actions: z.array(automationAction).min(1).max(AUTOMATION_ACTIONS_MAX),
	})
	.superRefine((value, context) => {
		if (value.trigger.type === "status_changed" && !oneTarget(value.trigger)) {
			context.addIssue({ code: "custom", path: ["trigger"], message: m.taskline_automation_error_one_status() });
		}
		for (const [index, action] of value.actions.entries()) {
			if (action.type === "set_status" && (!oneTarget(action) || (!action.statusId && !action.category))) {
				context.addIssue({
					code: "custom",
					path: ["actions", index],
					message: m.taskline_automation_error_one_status(),
				});
			}
		}
	});
export type AutomationDefinition = z.infer<typeof automationDefinition>;

/** What the conditions look at: the task as it is after the change. */
export type AutomationTask = {
	type: TaskType;
	priority: TaskPriority;
	category: StatusCategory;
	labelIds: ReadonlyArray<string>;
	assigneeId: string | null;
	fields: Readonly<Record<string, FieldValue>>;
};

/** One condition; a field no longer offered (archived, deleted) matches nothing. */
export function matchesCondition(
	task: AutomationTask,
	condition: AutomationCondition,
	{ fields, today }: { fields: ReadonlyArray<TaskField>; today: string },
): boolean {
	switch (condition.type) {
		case "task_type":
			return condition.in.includes(task.type);
		case "priority":
			return condition.in.includes(task.priority);
		case "category":
			return condition.in.includes(task.category);
		case "label":
			return task.labelIds.includes(condition.labelId) === condition.has;
		case "assignee":
			return condition.is === "none"
				? task.assigneeId === null
				: condition.is === "any"
					? task.assigneeId !== null
					: task.assigneeId === condition.is;
		case "field": {
			const field = fields.find((each) => each.id === condition.fieldId && !each.archived);
			return field ? matchesFieldFilter(field, task.fields[field.id], condition.value, { me: null, today }) : false;
		}
	}
}

/** Every condition (none: every task). */
export const matchesConditions = (
	task: AutomationTask,
	conditions: ReadonlyArray<AutomationCondition>,
	context: { fields: ReadonlyArray<TaskField>; today: string },
) => conditions.every((condition) => matchesCondition(task, condition, context));

/** What a change says happened to a task, for the triggers to match. */
export type AutomationEvent = {
	trigger: AutomationTrigger["type"];
	taskId: string;
	statusId?: string;
	category?: StatusCategory;
	priority?: TaskPriority;
	labelId?: string;
};

/** Whether a trigger fires on an event: its type, and what it narrows to (a status or category, a priority, a label). */
export function triggerMatches(trigger: AutomationTrigger, event: AutomationEvent): boolean {
	if (trigger.type !== event.trigger) return false;
	switch (trigger.type) {
		case "status_changed":
			if (trigger.statusId) return event.statusId === trigger.statusId;
			if (trigger.category) return event.category === trigger.category;
			return true;
		case "priority_changed":
			return trigger.priority === undefined || event.priority === trigger.priority;
		case "label_added":
			return trigger.labelId === undefined || event.labelId === trigger.labelId;
		default:
			return true;
	}
}
