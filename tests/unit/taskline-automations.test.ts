import { describe, expect, it } from "vitest";
import {
	type AutomationTask,
	automationDefinition,
	matchesConditions,
	triggerMatches,
} from "@/features/taskline/automation-rules";
import { newAction, newCondition, previewConditions, toDefinition, toForm } from "@/features/taskline/automations/form";
import { dueByNow, nextDue, nextOccurrence, shiftedStart, storedRecurrence } from "@/features/taskline/recurrence";
import type { Automation, TaskField } from "@/features/taskline/types";
import { todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";

/**
 * Automations and recurrence, pure (Task 56, decision 0221): conditions on a task,
 * which events a trigger fires on, the builder's form both ways, and the next days of
 * a series in the workspace's calendar (Asia/Kathmandu, weeks from Sunday).
 */

const task = (overrides: Partial<AutomationTask> = {}): AutomationTask => ({
	type: "bug",
	priority: 3,
	category: "started",
	labelIds: ["l-bug"],
	assigneeId: "m-asha",
	fields: { "f-area": "o-design", "f-ok": true },
	...overrides,
});

const fields: TaskField[] = [
	{
		id: "f-area",
		projectId: null,
		name: "Area",
		type: "select",
		options: [{ id: "o-design", name: "Design", color: "violet" }],
		required: false,
		position: "a0",
		archived: false,
	},
	{
		id: "f-old",
		projectId: null,
		name: "Old",
		type: "text",
		options: [],
		required: false,
		position: "a1",
		archived: true,
	},
];
const context = { fields, today: "2026-11-04" };

describe("conditions", () => {
	it("matches every condition, as the task is", () => {
		expect(matchesConditions(task(), [], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "task_type", in: ["bug", "story"] }], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "task_type", in: ["epic"] }], context)).toBe(false);
		expect(matchesConditions(task(), [{ type: "priority", in: [3, 4] }], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "category", in: ["completed"] }], context)).toBe(false);
		expect(matchesConditions(task(), [{ type: "label", labelId: "l-bug", has: true }], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "label", labelId: "l-bug", has: false }], context)).toBe(false);
		expect(matchesConditions(task(), [{ type: "assignee", is: "any" }], context)).toBe(true);
		expect(matchesConditions(task({ assigneeId: null }), [{ type: "assignee", is: "none" }], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "assignee", is: "m-bikash" }], context)).toBe(false);
		expect(matchesConditions(task(), [{ type: "field", fieldId: "f-area", value: "o-design" }], context)).toBe(true);
		expect(matchesConditions(task(), [{ type: "field", fieldId: "f-area", value: "none" }], context)).toBe(false);
		// A field no longer offered matches nothing (unlike a filter, which it would be ignored as).
		expect(matchesConditions(task(), [{ type: "field", fieldId: "f-old", value: "none" }], context)).toBe(false);
		expect(
			matchesConditions(
				task(),
				[
					{ type: "task_type", in: ["bug"] },
					{ type: "priority", in: [0] },
				],
				context,
			),
		).toBe(false);
	});
});

describe("triggers", () => {
	it("fires on its own event, narrowed to a status, a category, a priority or a label", () => {
		const moved = {
			trigger: "status_changed" as const,
			taskId: "t",
			statusId: "s-done",
			category: "completed" as const,
		};
		expect(triggerMatches({ type: "status_changed" }, moved)).toBe(true);
		expect(triggerMatches({ type: "status_changed", statusId: "s-done" }, moved)).toBe(true);
		expect(triggerMatches({ type: "status_changed", statusId: "s-todo" }, moved)).toBe(false);
		expect(triggerMatches({ type: "status_changed", category: "completed" }, moved)).toBe(true);
		expect(triggerMatches({ type: "status_changed", category: "canceled" }, moved)).toBe(false);
		expect(triggerMatches({ type: "task_created" }, moved)).toBe(false);
		expect(
			triggerMatches(
				{ type: "priority_changed", priority: 4 },
				{ trigger: "priority_changed", taskId: "t", priority: 4 },
			),
		).toBe(true);
		expect(
			triggerMatches(
				{ type: "priority_changed", priority: 4 },
				{ trigger: "priority_changed", taskId: "t", priority: 2 },
			),
		).toBe(false);
		expect(triggerMatches({ type: "label_added" }, { trigger: "label_added", taskId: "t", labelId: "l" })).toBe(true);
		expect(
			triggerMatches({ type: "label_added", labelId: "x" }, { trigger: "label_added", taskId: "t", labelId: "l" }),
		).toBe(false);
	});

	it("refuses a status trigger naming both a status and a category, and a status action naming neither", () => {
		const base = { name: "R", enabled: true, conditions: [], actions: [{ type: "set_priority", priority: 1 }] };
		const id = "3f8a9d4e-2b1c-4d5e-8f6a-7b8c9d0e1f2a";
		expect(
			automationDefinition.safeParse({
				...base,
				trigger: { type: "status_changed", statusId: id, category: "completed" },
			}).success,
		).toBe(false);
		expect(
			automationDefinition.safeParse({ ...base, trigger: { type: "task_created" }, actions: [{ type: "set_status" }] })
				.success,
		).toBe(false);
		expect(
			automationDefinition.safeParse({
				...base,
				trigger: { type: "task_created" },
				actions: Array.from({ length: 11 }, () => ({ type: "set_priority", priority: 1 })),
			}).success,
		).toBe(false);
	});
});

describe("the builder's form", () => {
	it("turns a rule into rows and back", () => {
		const rule: Automation = {
			id: "a",
			projectId: "p",
			name: "Ship it",
			enabled: true,
			trigger: { type: "status_changed", category: "completed" },
			conditions: [
				{ type: "task_type", in: ["bug"] },
				{ type: "label", labelId: "l-bug", has: false },
			],
			actions: [
				{ type: "assign", to: "lead" },
				{ type: "notify", to: "watchers", message: "Done" },
				{ type: "subtasks", titles: ["Test", "Release"] },
			],
			version: 3,
			lastRun: null,
			createdAt: "2026-11-01T00:00:00.000Z",
		};
		const { id: _id, projectId: _p, version: _v, lastRun: _l, createdAt: _c, ...definition } = rule;
		expect(toDefinition(toForm(rule))).toEqual(definition);
	});

	it("leaves rows not filled in out of the preview, and says what a new rule starts with", () => {
		const form = toForm(null);
		expect(form.trigger).toMatchObject({ type: "status_changed", status: "c:completed" });
		expect(toDefinition(form).trigger).toEqual({ type: "status_changed", category: "completed" });
		expect(previewConditions([newCondition("task_type"), { ...newCondition("priority"), values: ["4"] }])).toEqual([
			{ type: "priority", in: [4] },
		]);
		expect(toDefinition({ ...form, actions: [{ ...newAction("subtasks"), titles: " One \n\nTwo " }] }).actions).toEqual(
			[{ type: "subtasks", titles: ["One", "Two"] }],
		);
	});
});

describe("recurrence", () => {
	it("steps days, weeks on chosen days from the week's start, and months on the anchor's day", () => {
		const daily = storedRecurrence({ freq: "daily", interval: 2 }, "2026-11-04");
		expect(nextOccurrence(daily, "2026-11-04")).toBe("2026-11-06");
		// 2026-11-04 is a Wednesday. Every 2 weeks on Sunday and Thursday: Thursday this week, then Sunday two weeks on.
		const weekly = storedRecurrence({ freq: "weekly", interval: 2, weekdays: [0, 4] }, "2026-11-04");
		expect(nextOccurrence(weekly, "2026-11-04")).toBe("2026-11-05");
		expect(nextOccurrence(weekly, "2026-11-05")).toBe("2026-11-15");
		// With Monday as the week's first day, Sunday closes the week: it comes before the jump.
		expect(nextOccurrence(weekly, "2026-11-05", 1)).toBe("2026-11-08");
		// A weekly rule without days takes the anchor's weekday.
		expect(storedRecurrence({ freq: "weekly", interval: 1 }, "2026-11-04").weekdays).toEqual([3]);
		// The 31st: the last day of a shorter month, then back to the 31st.
		const monthly = storedRecurrence({ freq: "monthly", interval: 1 }, "2026-01-31");
		expect(nextOccurrence(monthly, "2026-01-31")).toBe("2026-02-28");
		expect(nextOccurrence(monthly, "2026-02-28")).toBe("2026-03-31");
		const yearly = storedRecurrence({ freq: "yearly", interval: 1 }, "2028-02-29");
		expect(nextOccurrence(yearly, "2028-02-29")).toBe("2029-02-28");
		expect(nextOccurrence(yearly, "2031-02-28")).toBe("2032-02-29");
	});

	it("never makes a late next task when one closes, and catches a late series up to today", () => {
		const daily = storedRecurrence({ freq: "daily", interval: 1 }, "2026-10-01");
		expect(nextDue(daily, "2026-11-04", "2026-11-04")).toBe("2026-11-05");
		expect(nextDue(daily, "2026-10-01", "2026-11-04")).toBe("2026-11-04");
		const weekly = storedRecurrence({ freq: "weekly", interval: 1, weekdays: [1] }, "2026-10-19");
		// Closed on a Wednesday, two weeks late: next Monday, not a Monday gone by.
		expect(nextDue(weekly, "2026-10-19", "2026-11-04")).toBe("2026-11-09");
		// Open and late: the latest Monday up to today, the missed one skipped.
		expect(dueByNow(weekly, "2026-10-19", "2026-11-04")).toBe("2026-11-02");
		expect(dueByNow(weekly, "2026-11-02", "2026-11-04")).toBeNull();
	});

	it("ends on its last day or after its count", () => {
		const until = storedRecurrence({ freq: "daily", interval: 1, until: "2026-11-05" }, "2026-11-04");
		expect(nextDue(until, "2026-11-04", "2026-11-04")).toBe("2026-11-05");
		expect(nextDue(until, "2026-11-05", "2026-11-05")).toBeNull();
		expect(
			nextDue(storedRecurrence({ freq: "daily", interval: 1, count: 3 }, "2026-11-04", 3), "2026-11-04", "2026-11-04"),
		).toBeNull();
		expect(
			nextDue(storedRecurrence({ freq: "daily", interval: 1, count: 3 }, "2026-11-04", 2), "2026-11-04", "2026-11-04"),
		).toBe("2026-11-05");
	});

	it("keeps the start as far before the due day, and counts days in Kathmandu", () => {
		expect(shiftedStart("2026-11-02", "2026-11-04", "2026-11-11")).toBe("2026-11-09");
		expect(shiftedStart(null, "2026-11-04", "2026-11-11")).toBeNull();
		// 19:00 UTC on 3 November is a quarter to one on the 4th in Kathmandu: a daily task due on the 3rd is late.
		const today = todayInZone(APP_TIME_ZONE, new Date("2026-11-03T19:00:00Z"));
		expect(today).toBe("2026-11-04");
		expect(dueByNow(storedRecurrence({ freq: "daily", interval: 1 }, "2026-11-03"), "2026-11-03", today)).toBe(
			"2026-11-04",
		);
		expect(todayInZone(APP_TIME_ZONE, new Date("2026-11-03T18:00:00Z"))).toBe("2026-11-03");
	});
});
