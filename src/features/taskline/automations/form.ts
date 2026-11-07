import { z } from "zod";
import { formatNumber } from "@/lib/i18n/intl";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import {
	AUTOMATION_COMMENT_MAX,
	AUTOMATION_DUE_DAYS_MAX,
	AUTOMATION_MESSAGE_MAX,
	AUTOMATION_NAME_MAX,
	AUTOMATION_SOON_DAYS_MAX,
	AUTOMATION_SUBTASKS_MAX,
	type AutomationDefinition,
} from "../automation-rules";
import {
	AUTOMATION_ACTIONS_MAX,
	AUTOMATION_CONDITIONS_MAX,
	AUTOMATION_TRIGGERS,
	type Automation,
	type AutomationAction,
	type AutomationActionType,
	type AutomationCondition,
	type AutomationConditionType,
	type AutomationTrigger,
	type AutomationTriggerType,
	STATUS_CATEGORIES,
	type StatusCategory,
	TASK_TYPES,
	type TaskPriority,
	type TaskType,
} from "../types";

/**
 * The builder's form (Task 56): flat rows the fields can bind to (every row has every
 * part; the type shows the ones it uses), turned into a rule on submit and back when
 * a rule is edited. A status is `s:<id>` (a project's) or `c:<category>`; a trigger's
 * "any" is `any` (a select has no empty choice), and a choice not made yet is "".
 */

export type TriggerForm = {
	type: AutomationTriggerType;
	status: string;
	priority: string;
	labelId: string;
	days: number;
};

export type ConditionForm = {
	key: string;
	type: AutomationConditionType;
	/** Task types, priorities (as text) or categories: any of them. */
	values: string[];
	labelId: string;
	has: "has" | "lacks";
	/** A member's id, `none` or `any`. */
	is: string;
	fieldId: string;
	value: string;
};

export type ActionForm = {
	key: string;
	type: AutomationActionType;
	status: string;
	/** Assign: a member, `lead`, `reporter`, `none`; notify: a member, `assignee`, `lead`, `reporter`, `watchers`; sprint: one, `active`, `none`. */
	to: string;
	priority: string;
	labelId: string;
	days: number;
	text: string;
	message: string;
	/** The subtasks' titles, one per line. */
	titles: string;
};

export type AutomationForm = {
	name: string;
	enabled: boolean;
	trigger: TriggerForm;
	conditions: ConditionForm[];
	actions: ActionForm[];
};

const newKey = () => crypto.randomUUID();

/** A trigger's "any status", "any priority", "any label". */
export const ANY = "any";

export const newCondition = (type: AutomationConditionType = "task_type"): ConditionForm => ({
	key: newKey(),
	type,
	values: [],
	labelId: "",
	has: "has",
	is: "any",
	fieldId: "",
	value: "",
});

export const newAction = (type: AutomationActionType = "assign"): ActionForm => ({
	key: newKey(),
	type,
	status: "",
	to: "",
	priority: "3",
	labelId: "",
	days: 3,
	text: "",
	message: "",
	titles: "",
});

const statusRef = (value: { statusId?: string; category?: StatusCategory }) =>
	value.statusId ? `s:${value.statusId}` : value.category ? `c:${value.category}` : "";

const parseStatus = (ref: string): { statusId?: string; category?: StatusCategory } => {
	if (ref.startsWith("s:")) return { statusId: ref.slice(2) };
	if (ref.startsWith("c:") && (STATUS_CATEGORIES as ReadonlyArray<string>).includes(ref.slice(2))) {
		return { category: ref.slice(2) as StatusCategory };
	}
	return {};
};

export function toForm(rule: Automation | null): AutomationForm {
	if (!rule) {
		return {
			name: "",
			enabled: true,
			trigger: { type: "status_changed", status: "c:completed", priority: ANY, labelId: ANY, days: 2 },
			conditions: [],
			actions: [newAction("notify")],
		};
	}
	const { trigger } = rule;
	return {
		name: rule.name,
		enabled: rule.enabled,
		trigger: {
			type: trigger.type,
			status: trigger.type === "status_changed" ? statusRef(trigger) || ANY : ANY,
			priority: trigger.type === "priority_changed" && trigger.priority !== undefined ? String(trigger.priority) : ANY,
			labelId: trigger.type === "label_added" ? (trigger.labelId ?? ANY) : ANY,
			days: trigger.type === "due_soon" ? trigger.days : 2,
		},
		conditions: rule.conditions.map((condition) => {
			const row = newCondition(condition.type);
			switch (condition.type) {
				case "task_type":
				case "category":
					return { ...row, values: [...condition.in] };
				case "priority":
					return { ...row, values: condition.in.map(String) };
				case "label":
					return { ...row, labelId: condition.labelId, has: condition.has ? "has" : "lacks" };
				case "assignee":
					return { ...row, is: condition.is };
				case "field":
					return { ...row, fieldId: condition.fieldId, value: condition.value };
				default:
					return row;
			}
		}),
		actions: rule.actions.map((action) => {
			const row = newAction(action.type);
			switch (action.type) {
				case "set_status":
					return { ...row, status: statusRef(action) };
				case "assign":
				case "set_sprint":
					return { ...row, to: action.to };
				case "notify":
					return { ...row, to: action.to, message: action.message };
				case "set_priority":
					return { ...row, priority: String(action.priority) };
				case "add_label":
				case "remove_label":
					return { ...row, labelId: action.labelId };
				case "set_due":
					return { ...row, days: action.days };
				case "comment":
					return { ...row, text: action.text };
				case "subtasks":
					return { ...row, titles: action.titles.join("\n") };
				default:
					return row;
			}
		}),
	};
}

const priorityOf = (text: string) => Number(text) as TaskPriority;

function triggerOf({ type, status, priority, labelId, days }: TriggerForm): AutomationTrigger {
	switch (type) {
		case "status_changed":
			return { type, ...parseStatus(status) };
		case "priority_changed":
			return priority === ANY || priority === "" ? { type } : { type, priority: priorityOf(priority) };
		case "label_added":
			return labelId && labelId !== ANY ? { type, labelId } : { type };
		case "due_soon":
			return { type, days };
		default:
			return { type } as AutomationTrigger;
	}
}

/** A condition row as a condition; a row not filled in yet is left out (the schema then says what's missing). */
export function conditionOf(row: ConditionForm): AutomationCondition | null {
	switch (row.type) {
		case "task_type":
			return {
				type: row.type,
				in: row.values.filter((value): value is TaskType => (TASK_TYPES as ReadonlyArray<string>).includes(value)),
			};
		case "priority":
			return { type: row.type, in: row.values.map(priorityOf) };
		case "category":
			return {
				type: row.type,
				in: row.values.filter((value): value is StatusCategory =>
					(STATUS_CATEGORIES as ReadonlyArray<string>).includes(value),
				),
			};
		case "label":
			return row.labelId ? { type: row.type, labelId: row.labelId, has: row.has === "has" } : null;
		case "assignee":
			return { type: row.type, is: row.is || "any" };
		case "field":
			return row.fieldId && row.value ? { type: row.type, fieldId: row.fieldId, value: row.value } : null;
	}
}

function actionOf(row: ActionForm): AutomationAction {
	switch (row.type) {
		case "set_status":
			return { type: row.type, ...parseStatus(row.status) };
		case "assign":
		case "set_sprint":
			return { type: row.type, to: row.to };
		case "notify":
			return { type: row.type, to: row.to, message: row.message.trim() };
		case "set_priority":
			return { type: row.type, priority: priorityOf(row.priority) };
		case "add_label":
		case "remove_label":
			return { type: row.type, labelId: row.labelId };
		case "set_due":
			return { type: row.type, days: row.days };
		case "comment":
			return { type: row.type, text: row.text.trim() };
		case "subtasks":
			return {
				type: row.type,
				titles: row.titles
					.split("\n")
					.map((title) => title.trim())
					.filter(Boolean),
			};
	}
}

/** The form as a rule, for the server's schema to check. */
export function toDefinition(form: AutomationForm): AutomationDefinition {
	return {
		name: form.name.trim(),
		enabled: form.enabled,
		trigger: triggerOf(form.trigger),
		conditions: form.conditions.flatMap((row) => {
			const condition = conditionOf(row);
			return condition ? [condition] : [];
		}),
		actions: form.actions.map(actionOf),
	};
}

/** The conditions as they stand, for the preview: rows not filled in yet don't count. */
export const previewConditions = (rows: ReadonlyArray<ConditionForm>): AutomationCondition[] =>
	rows.flatMap((row) => {
		const condition = conditionOf(row);
		if (!condition) return [];
		if ("in" in condition && condition.in.length === 0) return [];
		return [condition];
	});

/**
 * What the form checks before it saves: each row's parts for its type, named as the
 * form names them (`actions[1].to`), so a missing choice shows under its field.
 */
export const automationFormSchema = z
	.object({
		name: required({ max: AUTOMATION_NAME_MAX }),
		enabled: z.boolean(),
		trigger: z.object({
			type: z.enum(AUTOMATION_TRIGGERS),
			status: z.string(),
			priority: z.string(),
			labelId: z.string(),
			days: z.number(),
		}),
		conditions: z.array(z.custom<ConditionForm>()).max(AUTOMATION_CONDITIONS_MAX),
		actions: z.array(z.custom<ActionForm>()).min(1).max(AUTOMATION_ACTIONS_MAX),
	})
	.superRefine((form, context) => {
		const choose = (path: Array<string | number>) =>
			context.addIssue({ code: "custom", path, message: m.taskline_automation_error_choose() });
		if (
			form.trigger.type === "due_soon" &&
			!(form.trigger.days >= 1 && form.trigger.days <= AUTOMATION_SOON_DAYS_MAX)
		) {
			context.addIssue({
				code: "custom",
				path: ["trigger", "days"],
				message: m.taskline_automation_error_days({ max: formatNumber(AUTOMATION_SOON_DAYS_MAX) }),
			});
		}
		for (const [index, row] of form.conditions.entries()) {
			if ((row.type === "task_type" || row.type === "priority" || row.type === "category") && row.values.length === 0) {
				choose(["conditions", index, "values"]);
			}
			if (row.type === "label" && !row.labelId) choose(["conditions", index, "labelId"]);
			if (row.type === "field" && !row.fieldId) choose(["conditions", index, "fieldId"]);
			if (row.type === "field" && row.fieldId && !row.value) choose(["conditions", index, "value"]);
		}
		for (const [index, row] of form.actions.entries()) {
			if (row.type === "set_status" && !row.status) choose(["actions", index, "status"]);
			if ((row.type === "assign" || row.type === "notify" || row.type === "set_sprint") && !row.to) {
				choose(["actions", index, "to"]);
			}
			if ((row.type === "add_label" || row.type === "remove_label") && !row.labelId) {
				choose(["actions", index, "labelId"]);
			}
			if (row.type === "set_due" && !(row.days >= 0 && row.days <= AUTOMATION_DUE_DAYS_MAX)) {
				context.addIssue({
					code: "custom",
					path: ["actions", index, "days"],
					message: m.taskline_automation_error_days({ max: formatNumber(AUTOMATION_DUE_DAYS_MAX) }),
				});
			}
			if (row.type === "comment" && (!row.text.trim() || row.text.length > AUTOMATION_COMMENT_MAX)) {
				context.addIssue({ code: "custom", path: ["actions", index, "text"], message: m.validation_required() });
			}
			if (row.type === "notify" && row.message.length > AUTOMATION_MESSAGE_MAX) {
				context.addIssue({
					code: "custom",
					path: ["actions", index, "message"],
					message: m.taskline_automation_error_long({ max: formatNumber(AUTOMATION_MESSAGE_MAX) }),
				});
			}
			if (row.type === "subtasks") {
				const titles = row.titles
					.split("\n")
					.map((title) => title.trim())
					.filter(Boolean);
				if (titles.length === 0 || titles.length > AUTOMATION_SUBTASKS_MAX) {
					context.addIssue({
						code: "custom",
						path: ["actions", index, "titles"],
						message: m.taskline_automation_error_subtasks({ max: formatNumber(AUTOMATION_SUBTASKS_MAX) }),
					});
				}
			}
		}
	});
