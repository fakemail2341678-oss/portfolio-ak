import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { fieldFilterChoices } from "../fields";
import { CATEGORY_LABELS, PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import type {
	AutomationAction,
	AutomationActionType,
	AutomationCondition,
	AutomationConditionType,
	AutomationRun,
	AutomationTrigger,
	AutomationTriggerType,
	TaskField,
	TasklineLabel,
	TasklineMember,
	TasklineStatus,
} from "../types";

/**
 * Automations in words (Task 56): the builder's choices and each rule's sentence ("When
 * a task moves to Done · if it's a bug · add the label Shipped, notify the lead"),
 * with the names of what it points at, or "a deleted label" once it's gone.
 */

/** What a scope offers a rule: a project's statuses, labels, sprints and fields, or the workspace's. */
export type AutomationOptions = {
	scope: "project" | "workspace";
	statuses: ReadonlyArray<TasklineStatus>;
	labels: ReadonlyArray<TasklineLabel>;
	members: ReadonlyArray<TasklineMember>;
	fields: ReadonlyArray<TaskField>;
	sprints: ReadonlyArray<{ id: string; name: string }>;
};

export const TRIGGER_LABELS: Record<AutomationTriggerType, () => string> = {
	task_created: () => m.taskline_automation_trigger_task_created(),
	status_changed: () => m.taskline_automation_trigger_status_changed(),
	assignee_changed: () => m.taskline_automation_trigger_assignee_changed(),
	priority_changed: () => m.taskline_automation_trigger_priority_changed(),
	label_added: () => m.taskline_automation_trigger_label_added(),
	comment_added: () => m.taskline_automation_trigger_comment_added(),
	subtasks_done: () => m.taskline_automation_trigger_subtasks_done(),
	sprint_started: () => m.taskline_automation_trigger_sprint_started(),
	due_soon: () => m.taskline_automation_trigger_due_soon(),
	overdue: () => m.taskline_automation_trigger_overdue(),
};

export const CONDITION_LABELS: Record<AutomationConditionType, () => string> = {
	task_type: () => m.taskline_automation_condition_task_type(),
	priority: () => m.taskline_automation_condition_priority(),
	category: () => m.taskline_automation_condition_category(),
	label: () => m.taskline_automation_condition_label(),
	assignee: () => m.taskline_automation_condition_assignee(),
	field: () => m.taskline_automation_condition_field(),
};

export const ACTION_LABELS: Record<AutomationActionType, () => string> = {
	set_status: () => m.taskline_automation_action_set_status(),
	assign: () => m.taskline_automation_action_assign(),
	set_priority: () => m.taskline_automation_action_set_priority(),
	add_label: () => m.taskline_automation_action_add_label(),
	remove_label: () => m.taskline_automation_action_remove_label(),
	set_sprint: () => m.taskline_automation_action_set_sprint(),
	set_due: () => m.taskline_automation_action_set_due(),
	comment: () => m.taskline_automation_action_comment(),
	notify: () => m.taskline_automation_action_notify(),
	subtasks: () => m.taskline_automation_action_subtasks(),
};

const statusName = (id: string, options: AutomationOptions) =>
	options.statuses.find((status) => status.id === id)?.name ?? m.taskline_automation_gone_status();
const labelName = (id: string, options: AutomationOptions) =>
	options.labels.find((label) => label.id === id)?.name ?? m.taskline_automation_gone_label();
const memberName = (id: string, options: AutomationOptions) =>
	options.members.find((member) => member.id === id)?.name ?? m.taskline_automation_gone_member();

/** Choices of "who" for assigning and notifying, the people first. */
export const ASSIGN_TARGETS = ["lead", "reporter", "none"] as const;
export const NOTIFY_TARGETS = ["assignee", "lead", "reporter", "watchers"] as const;

export const TARGET_LABELS: Record<(typeof ASSIGN_TARGETS)[number] | (typeof NOTIFY_TARGETS)[number], () => string> = {
	lead: () => m.taskline_automation_target_lead(),
	reporter: () => m.taskline_automation_target_reporter(),
	none: () => m.taskline_automation_target_none(),
	assignee: () => m.taskline_automation_target_assignee(),
	watchers: () => m.taskline_automation_target_watchers(),
};

const targetName = (to: string, options: AutomationOptions) =>
	to in TARGET_LABELS ? TARGET_LABELS[to as keyof typeof TARGET_LABELS]() : memberName(to, options);

const or = (words: ReadonlyArray<string>) => words.join(m.taskline_automation_or());

export function triggerSentence(trigger: AutomationTrigger, options: AutomationOptions): string {
	switch (trigger.type) {
		case "status_changed":
			if (trigger.statusId) return m.taskline_automation_when_status({ status: statusName(trigger.statusId, options) });
			if (trigger.category) {
				return m.taskline_automation_when_category({ category: CATEGORY_LABELS[trigger.category]() });
			}
			return m.taskline_automation_when_status_any();
		case "priority_changed":
			return trigger.priority === undefined
				? m.taskline_automation_when_priority_any()
				: m.taskline_automation_when_priority({ priority: PRIORITY_LABELS[trigger.priority]() });
		case "label_added":
			return trigger.labelId
				? m.taskline_automation_when_label({ label: labelName(trigger.labelId, options) })
				: m.taskline_automation_when_label_any();
		case "due_soon":
			return m.taskline_automation_when_due_soon({ days: formatNumber(trigger.days) });
		default:
			return m.taskline_automation_when({ event: TRIGGER_LABELS[trigger.type]() });
	}
}

/** A condition's value as words (a field's choice, a member, a list of types). */
export function conditionSentence(condition: AutomationCondition, options: AutomationOptions): string {
	switch (condition.type) {
		case "task_type":
			return m.taskline_automation_if_type({ types: or(condition.in.map((type) => TYPE_LABELS[type]())) });
		case "priority":
			return m.taskline_automation_if_priority({
				priorities: or(condition.in.map((priority) => PRIORITY_LABELS[priority]())),
			});
		case "category":
			return m.taskline_automation_if_category({
				categories: or(condition.in.map((category) => CATEGORY_LABELS[category]())),
			});
		case "label":
			return condition.has
				? m.taskline_automation_if_label({ label: labelName(condition.labelId, options) })
				: m.taskline_automation_if_no_label({ label: labelName(condition.labelId, options) });
		case "assignee":
			return condition.is === "none"
				? m.taskline_automation_if_unassigned()
				: condition.is === "any"
					? m.taskline_automation_if_assigned()
					: m.taskline_automation_if_assignee({ name: memberName(condition.is, options) });
		case "field": {
			const field = options.fields.find((each) => each.id === condition.fieldId);
			if (!field) return m.taskline_automation_gone_field();
			const value =
				fieldFilterChoices(field, options.members, { member: false }).find((choice) => choice.value === condition.value)
					?.label ?? m.taskline_automation_gone_value();
			return m.taskline_automation_if_field({ field: field.name, value });
		}
	}
}

export function actionSentence(action: AutomationAction, options: AutomationOptions): string {
	switch (action.type) {
		case "set_status":
			return action.statusId
				? m.taskline_automation_do_status({ status: statusName(action.statusId, options) })
				: m.taskline_automation_do_category({
						category: action.category ? CATEGORY_LABELS[action.category]() : "",
					});
		case "assign":
			return action.to === "none"
				? m.taskline_automation_do_unassign()
				: m.taskline_automation_do_assign({ name: targetName(action.to, options) });
		case "set_priority":
			return m.taskline_automation_do_priority({ priority: PRIORITY_LABELS[action.priority]() });
		case "add_label":
			return m.taskline_automation_do_add_label({ label: labelName(action.labelId, options) });
		case "remove_label":
			return m.taskline_automation_do_remove_label({ label: labelName(action.labelId, options) });
		case "set_sprint":
			return action.to === "active"
				? m.taskline_automation_do_sprint_active()
				: action.to === "none"
					? m.taskline_automation_do_backlog()
					: m.taskline_automation_do_sprint({
							sprint:
								options.sprints.find((sprint) => sprint.id === action.to)?.name ?? m.taskline_automation_gone_sprint(),
						});
		case "set_due":
			return action.days === 0
				? m.taskline_automation_do_due_today()
				: m.taskline_automation_do_due({ days: formatNumber(action.days) });
		case "comment":
			return m.taskline_automation_do_comment();
		case "notify":
			return m.taskline_automation_do_notify({ name: targetName(action.to, options) });
		case "subtasks":
			return m.taskline_automation_do_subtasks({ count: formatNumber(action.titles.length) });
	}
}

/** A rule as one line: when, if, then. */
export function automationSummary(
	rule: {
		trigger: AutomationTrigger;
		conditions: ReadonlyArray<AutomationCondition>;
		actions: ReadonlyArray<AutomationAction>;
	},
	options: AutomationOptions,
): { when: string; conditions: string[]; actions: string[] } {
	return {
		when: triggerSentence(rule.trigger, options),
		conditions: rule.conditions.map((condition) => conditionSentence(condition, options)),
		actions: rule.actions.map((action) => actionSentence(action, options)),
	};
}

/** What came of a run, for the log. */
export function runDetailText(run: Pick<AutomationRun, "outcome" | "detail">): string {
	if (run.outcome === "failed") return run.detail.message ?? m.taskline_automation_error_failed();
	if (run.outcome === "ok") return m.taskline_automation_run_applied({ count: formatNumber(run.detail.applied ?? 0) });
	switch (run.detail.reason) {
		case "unchanged":
			return m.taskline_automation_run_unchanged();
		case "limit":
			return m.taskline_automation_run_limit();
		default:
			return m.taskline_automation_run_conditions();
	}
}

export const OUTCOME_LABELS: Record<AutomationRun["outcome"], () => string> = {
	ok: () => m.taskline_automation_outcome_ok(),
	skipped: () => m.taskline_automation_outcome_skipped(),
	failed: () => m.taskline_automation_outcome_failed(),
};
