import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/features/rbac/types";
import type { AutomationDefinition } from "@/features/taskline/automation-rules";
import { AUTOMATIONS_MAX, type TaskDetail } from "@/features/taskline/types";
import { FORM_ERROR_KEY, isAppError } from "@/lib/errors";
import { addDays, todayInZone, weekdayOf } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as adminAutomations from "@/server/taskline/admin/automations";
import { catchUpRecurrences } from "@/server/taskline/automations/recurrence";
import * as automations from "@/server/taskline/automations/service";
import * as collab from "@/server/taskline/collab/service";
import { automationTimeTriggers } from "@/server/taskline/cron";
import * as fields from "@/server/taskline/fields/service";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as sprints from "@/server/taskline/sprints/service";
import * as tasks from "@/server/taskline/tasks/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Automations and recurring tasks on PGlite (Task 56, decision 0221): rules per scope
 * and the references they may name, a run inside the change's transaction with its
 * history and notices, the savepoint that rolls a failed rule back while the change
 * stands, no chaining, conditions, each trigger, the daily job's time triggers once
 * per due date, the preview, a series moving from task to task (and the daily job's
 * catch-up), and the sandbox's seed and claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "account", name: "Arun Account", email: "account@example.com" },
			{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string): TasklineServices => ({ db: env.db, user: { id, isGuest: id === "guest", permissions: [] } });
const ALL = ["taskline:read", "taskline:manage", "taskline:configure", "taskline:time"] as const;
const admin = () => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: [...ALL] } as Actor,
	imageStore: null,
});
const ws = "team";
const key = "WEB";
const today = () => todayInZone(APP_TIME_ZONE);

const failure = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return { code: "ok", message: "", fields: undefined };
	} catch (error) {
		if (isAppError(error)) {
			return { code: error.code, message: error.fieldErrors?.[FORM_ERROR_KEY]?.[0] ?? "", fields: error.fieldErrors };
		}
		throw error;
	}
};
const code = async (promise: Promise<unknown>) => (await failure(promise)).code;

const rule = (overrides: Partial<AutomationDefinition>): AutomationDefinition => ({
	name: "A rule",
	enabled: true,
	trigger: { type: "task_created" },
	conditions: [],
	actions: [{ type: "set_priority", priority: 4 }],
	...overrides,
});

/** The team (lead, member, viewer) and WEB, with a label to add. */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead" },
			{ workspaceId: team.id, userId: "member", displayName: "Mohan Member" },
			{ workspaceId: team.id, userId: "viewer", displayName: "Vera Viewer", role: "viewer" },
		]),
	);
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	await projects.createProject(as("lead"), { ws, key, name: "Website" });
	const byUser = (id: string) => {
		const row = rows.find((each) => each.userId === id);
		if (!row) throw new Error(`no ${id}`);
		return row;
	};
	await projects.setProjectMember(as("lead"), { ws, key, memberId: byUser("member").id, role: "member" });
	const shipped = await workflow.createLabel(as("lead"), { ws, key, name: "Shipped", color: "green" });
	const board = await tasks.listTasks(as("lead"), ws, key);
	const status = (category: string) => {
		const found = board.statuses.find((each) => each.category === category);
		if (!found) throw new Error(`no ${category}`);
		return found;
	};
	return {
		team,
		lead: byUser("lead"),
		member: byUser("member"),
		viewer: byUser("viewer"),
		shipped,
		todo: status("unstarted"),
		started: status("started"),
		done: status("completed"),
		canceled: status("canceled"),
	};
}

const move = (caller: string, task: { ref: string }, statusId: string) =>
	tasks.moveTask(as(caller), { ws, ref: task.ref, statusId, position: "a0" });

const runsOf = (automationId: string) =>
	env.db.select().from(schema.tlAutomationRun).where(eq(schema.tlAutomationRun.automationId, automationId));

const detail = (ref: string): Promise<TaskDetail> => tasks.getTask(as("lead"), ws, ref);

describe("definitions", () => {
	it("keeps a project's rules its lead's, names only what the scope has, and saves against the version", async () => {
		const { shipped, done } = await setUp();
		expect(await code(automations.createAutomation(as("member"), { ws, key, automation: rule({}) }))).toBe("FORBIDDEN");
		expect(await code(automations.createAutomation(as("viewer"), { ws, key, automation: rule({}) }))).toBe("FORBIDDEN");
		const created = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				name: "Ship it",
				trigger: { type: "status_changed", statusId: done.id },
				actions: [{ type: "add_label", labelId: shipped.id }],
			}),
		});
		expect(created).toMatchObject({ name: "Ship it", enabled: true, version: 1, lastRun: null });

		// Another project's status, an unknown label, a stranger: refused on the part that names them.
		await projects.createProject(as("lead"), { ws, key: "APP", name: "App" });
		const other = (await tasks.listTasks(as("lead"), ws, "APP")).statuses[0];
		const refused = await failure(
			automations.createAutomation(as("lead"), {
				ws,
				key,
				automation: rule({ trigger: { type: "status_changed", statusId: other?.id } }),
			}),
		);
		expect(refused.code).toBe("BAD_REQUEST");
		expect(Object.keys(refused.fields ?? {})).toEqual(["trigger"]);
		expect(
			await code(
				automations.createAutomation(as("lead"), {
					ws,
					key,
					automation: rule({ actions: [{ type: "assign", to: crypto.randomUUID() }] }),
				}),
			),
		).toBe("BAD_REQUEST");

		// The builder's save is versioned; switching on and off isn't.
		const toggled = await automations.toggleAutomation(as("lead"), { ws, key, id: created.id, enabled: false });
		expect(toggled).toMatchObject({ enabled: false, version: 1 });
		const saved = await automations.updateAutomation(as("lead"), {
			ws,
			key,
			id: created.id,
			version: 1,
			automation: rule({ name: "Ship it now", enabled: true }),
		});
		expect(saved).toMatchObject({ name: "Ship it now", version: 2 });
		expect(
			await code(
				automations.updateAutomation(as("lead"), { ws, key, id: created.id, version: 1, automation: rule({}) }),
			),
		).toBe("CONFLICT");

		const list = await automations.listAutomations(as("lead"), ws, key);
		expect(list.automations.map((each) => each.name)).toEqual(["Ship it now"]);
		const history = await tasks.listProjectActivity(as("lead"), ws, key);
		expect(history.filter((entry) => entry.kind.startsWith("automation.")).map((entry) => entry.kind)).toEqual([
			"automation.updated",
			"automation.updated",
			"automation.created",
		]);
		await automations.deleteAutomation(as("lead"), { ws, key, id: created.id });
		expect((await automations.listAutomations(as("lead"), ws, key)).automations).toEqual([]);
	});

	it("keeps the workspace's rules the admin's (audited): categories, workspace labels and members only, capped", async () => {
		const { team, shipped, done } = await setUp();
		const view = await adminAutomations.createAutomation(admin(), {
			automation: rule({
				name: "Done means done",
				trigger: { type: "status_changed", category: "completed" },
				actions: [{ type: "set_due", days: 0 }],
			}),
		});
		expect(view.automations).toHaveLength(1);
		expect(
			await code(
				adminAutomations.createAutomation(admin(), {
					automation: rule({ trigger: { type: "status_changed", statusId: done.id } }),
				}),
			),
		).toBe("BAD_REQUEST");
		// A project's label isn't every project's.
		expect(
			await code(
				adminAutomations.createAutomation(admin(), {
					automation: rule({ actions: [{ type: "add_label", labelId: shipped.id }] }),
				}),
			),
		).toBe("BAD_REQUEST");
		const audit = await env.db
			.select({ action: schema.auditEvent.action })
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.action, "taskline.automation.create"));
		expect(audit).toHaveLength(1);
		// The lead sees it, read-only, beside the project's own.
		expect((await automations.listAutomations(as("lead"), ws, key)).workspace.map((each) => each.name)).toEqual([
			"Done means done",
		]);
		await env.db.insert(schema.tlAutomation).values(
			Array.from({ length: AUTOMATIONS_MAX - 1 }, (_, index) => ({
				workspaceId: team.id,
				name: `Rule ${index}`,
				trigger: { type: "task_created" as const },
				actions: [{ type: "set_priority" as const, priority: 1 as const }],
				enabled: false,
			})),
		);
		expect(await code(adminAutomations.createAutomation(admin(), { automation: rule({}) }))).toBe("CONFLICT");
	});
});

describe("runs", () => {
	it("acts in the change's transaction: its actions, their history, a notice, and the run", async () => {
		const { shipped, done } = await setUp();
		const created = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				name: "Ship it",
				trigger: { type: "status_changed", category: "completed" },
				actions: [
					{ type: "add_label", labelId: shipped.id },
					{ type: "comment", text: "Shipped. Thanks!" },
					{ type: "notify", to: "reporter", message: "Check the release notes." },
				],
			}),
		});
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Write the notes" });
		await move("member", task, done.id);
		const after = await detail(task.ref);
		expect(after.labelIds).toEqual([shipped.id]);
		expect(after.comments).toMatchObject([{ authorId: null, automation: "Ship it" }]);
		const automated = after.activity.filter((entry) => entry.data.via === "automation");
		expect(automated.map((entry) => entry.kind).sort()).toEqual(["comment.added", "task.updated"]);
		expect(automated[0]?.data.automation).toBe("Ship it");
		const notices = await env.db
			.select()
			.from(schema.tlNotification)
			.where(and(eq(schema.tlNotification.userId, "lead"), eq(schema.tlNotification.kind, "automation")));
		expect(notices).toHaveLength(1);
		expect(notices[0]?.data).toMatchObject({ automation: "Ship it", message: "Check the release notes." });
		// The member who moved it isn't told what the rule did for them.
		const mine = await env.db.select().from(schema.tlNotification).where(eq(schema.tlNotification.userId, "member"));
		expect(mine.filter((row) => row.kind === "automation")).toEqual([]);
		expect((await runsOf(created.id)).map((run) => [run.outcome, run.detail])).toEqual([["ok", { applied: 3 }]]);
	});

	it("rolls a failed rule back in its savepoint while the change stands, and logs why", async () => {
		const { shipped } = await setUp();
		await fields.createField(as("lead"), {
			ws,
			key,
			field: { type: "checkbox", name: "Signed off", required: true },
		});
		const created = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				trigger: { type: "priority_changed", priority: 4 },
				actions: [
					{ type: "add_label", labelId: shipped.id },
					{ type: "set_status", category: "completed" },
				],
			}),
		});
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Urgent fix" });
		const patched = await tasks.patchTask(as("member"), { ws, ref: task.ref, priority: 4 });
		expect(patched.priority).toBe(4);
		expect(patched.labelIds).toEqual([]);
		expect(patched.completedAt).toBeNull();
		const [run] = await runsOf(created.id);
		expect(run?.outcome).toBe("failed");
		expect(run?.detail.message).toContain("Signed off");
	});

	it("doesn't chain: what a rule changes fires no rule", async () => {
		const { shipped } = await setUp();
		const first = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({ name: "Urgent", actions: [{ type: "set_priority", priority: 4 }] }),
		});
		const second = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				name: "Label urgent",
				trigger: { type: "priority_changed" },
				actions: [{ type: "add_label", labelId: shipped.id }],
			}),
		});
		const task = await tasks.createTask(as("member"), { ws, key, title: "Fire" });
		expect(task.priority).toBe(4);
		expect(task.labelIds).toEqual([]);
		expect(await runsOf(first.id)).toHaveLength(1);
		expect(await runsOf(second.id)).toHaveLength(0);
	});

	it("checks conditions on the task as it is now, and logs a skip", async () => {
		await setUp();
		const created = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({ conditions: [{ type: "task_type", in: ["bug"] }] }),
		});
		const plain = await tasks.createTask(as("member"), { ws, key, title: "Plain" });
		const bug = await tasks.createTask(as("member"), { ws, key, title: "Broken", type: "bug" });
		expect(plain.priority).toBe(0);
		expect(bug.priority).toBe(4);
		const runs = await runsOf(created.id);
		expect(runs.map((run) => [run.taskId, run.outcome, run.detail.reason ?? null]).sort()).toEqual(
			[
				[plain.id, "skipped", "conditions"],
				[bug.id, "ok", null],
			].sort(),
		);
		// A disabled rule doesn't run at all.
		await automations.toggleAutomation(as("lead"), { ws, key, id: created.id, enabled: false });
		await tasks.createTask(as("member"), { ws, key, title: "Another bug", type: "bug" });
		expect(await runsOf(created.id)).toHaveLength(2);
	});

	it("fires on subtasks all done, a comment (with the rule's rights), a label, and a sprint's start", async () => {
		const { member, shipped, done } = await setUp();
		await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				trigger: { type: "subtasks_done" },
				actions: [{ type: "set_status", category: "completed" }],
			}),
		});
		await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({ trigger: { type: "comment_added" }, actions: [{ type: "assign", to: member.id }] }),
		});
		await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				trigger: { type: "label_added", labelId: shipped.id },
				actions: [{ type: "set_priority", priority: 1 }],
			}),
		});
		await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({ trigger: { type: "sprint_started" }, actions: [{ type: "set_due", days: 0 }] }),
		});
		const parent = await tasks.createTask(as("lead"), { ws, key, title: "Parent" });
		const one = await tasks.createTask(as("lead"), { ws, key, title: "One", parentId: parent.id });
		const two = await tasks.createTask(as("lead"), { ws, key, title: "Two", parentId: parent.id });
		await move("lead", one, done.id);
		expect((await detail(parent.ref)).completedAt).toBeNull();
		await move("lead", two, done.id);
		expect((await detail(parent.ref)).statusId).toBe(done.id);

		// A viewer may comment but not assign: the rule assigns anyway.
		const talk = await tasks.createTask(as("lead"), { ws, key, title: "Talk" });
		await collab.addComment(as("viewer"), { ws, ref: talk.ref, body: "<p>Looks good</p>" });
		expect((await detail(talk.ref)).assigneeId).toBe(member.id);

		const labelled = await tasks.patchTask(as("lead"), { ws, ref: talk.ref, labelIds: [shipped.id] });
		expect(labelled.priority).toBe(1);

		const sprint = await sprints.createSprint(as("lead"), {
			ws,
			key,
			name: "Sprint 1",
			startOn: today(),
			endOn: addDays(today(), 13),
		});
		const planned = await tasks.createTask(as("lead"), { ws, key, title: "Planned", sprintId: sprint.id });
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		expect((await detail(planned.ref)).dueOn).toBe(today());
	});

	it("runs the daily job's time triggers once per task and due date", async () => {
		const { member } = await setUp();
		const soon = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({
				trigger: { type: "due_soon", days: 2 },
				actions: [{ type: "notify", to: "assignee", message: "Due soon" }],
			}),
		});
		const late = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: rule({ trigger: { type: "overdue" }, actions: [{ type: "set_priority", priority: 4 }] }),
		});
		const due = await tasks.createTask(as("lead"), {
			ws,
			key,
			title: "Due tomorrow",
			assigneeId: member.id,
			dueOn: addDays(today(), 1),
		});
		const overdue = await tasks.createTask(as("lead"), { ws, key, title: "Late", dueOn: addDays(today(), -1) });
		await tasks.createTask(as("lead"), { ws, key, title: "Later", dueOn: addDays(today(), 10) });
		expect((await automationTimeTriggers(env.db)).runs).toBe(2);
		expect((await automationTimeTriggers(env.db)).runs).toBe(2);
		expect(await runsOf(soon.id)).toHaveLength(1);
		expect(await runsOf(late.id)).toHaveLength(1);
		expect((await detail(overdue.ref)).priority).toBe(4);
		const told = await env.db
			.select()
			.from(schema.tlNotification)
			.where(and(eq(schema.tlNotification.userId, "member"), eq(schema.tlNotification.taskId, due.id)));
		expect(told.filter((row) => row.kind === "automation")).toHaveLength(1);
		// A new due date is a new occasion.
		await tasks.patchTask(as("lead"), { ws, ref: due.ref, dueOn: today() });
		await automationTimeTriggers(env.db);
		expect(await runsOf(soon.id)).toHaveLength(2);
	});

	it("previews how many open tasks the conditions match", async () => {
		await setUp();
		await tasks.createTask(as("lead"), { ws, key, title: "Bug", type: "bug" });
		await tasks.createTask(as("lead"), { ws, key, title: "Bug 2", type: "bug", priority: 3 });
		await tasks.createTask(as("lead"), { ws, key, title: "Task" });
		const preview = (conditions: AutomationDefinition["conditions"]) =>
			automations.previewAutomation(as("lead"), { ws, key, conditions });
		expect(await preview([])).toEqual({ count: 3, capped: false });
		expect(await preview([{ type: "task_type", in: ["bug"] }])).toEqual({ count: 2, capped: false });
		expect(
			await preview([
				{ type: "task_type", in: ["bug"] },
				{ type: "priority", in: [3] },
			]),
		).toEqual({ count: 1, capped: false });
		expect(await code(automations.previewAutomation(as("member"), { ws, key, conditions: [] }))).toBe("FORBIDDEN");
		expect((await adminAutomations.previewAutomation(admin(), { conditions: [] })).count).toBe(3);
	});
});

describe("recurring tasks", () => {
	it("moves the series to a copy when the task closes, due on the next occurrence", async () => {
		const { shipped, done, member } = await setUp();
		const due = addDays(today(), 2);
		const task = await tasks.createTask(as("lead"), {
			ws,
			key,
			title: "Weekly report",
			assigneeId: member.id,
			labelIds: [shipped.id],
			startOn: addDays(due, -1),
			dueOn: due,
		});
		await tasks.setChecklist(as("lead"), {
			ws,
			ref: task.ref,
			checklist: [{ id: crypto.randomUUID(), text: "Numbers", done: true }],
		});
		const repeating = await tasks.patchTask(as("lead"), {
			ws,
			ref: task.ref,
			recurrence: { freq: "weekly", interval: 1, count: 2 },
		});
		expect(repeating.recurrence).toEqual({
			freq: "weekly",
			interval: 1,
			weekdays: [weekdayOf(due)],
			count: 2,
			anchor: due,
			n: 1,
		});
		await move("member", task, done.id);
		const closed = await detail(task.ref);
		expect(closed.recurrence).toBeNull();
		expect(closed.activity.some((entry) => entry.kind === "task.recurred")).toBe(true);
		const board = await tasks.listTasks(as("lead"), ws, key);
		const next = board.tasks.find((each) => each.title === "Weekly report" && each.id !== task.id);
		expect(next).toMatchObject({
			dueOn: addDays(due, 7),
			startOn: addDays(due, 6),
			assigneeId: member.id,
			labelIds: [shipped.id],
			completedAt: null,
			checklist: { done: 0, total: 1 },
		});
		expect(next?.recurrence).toMatchObject({ n: 2, count: 2 });
		// The series had two tasks: the second one closing ends it.
		if (!next) throw new Error("no next task");
		await move("member", next, done.id);
		expect(
			(await tasks.listTasks(as("lead"), ws, key)).tasks.filter((each) => each.title === "Weekly report"),
		).toHaveLength(2);
		expect((await detail(next.ref)).recurrence).toBeNull();
	});

	it("lets the daily job catch a late series up to today, once", async () => {
		await setUp();
		const task = await tasks.createTask(as("lead"), {
			ws,
			key,
			title: "Water the plants",
			dueOn: addDays(today(), -3),
		});
		await tasks.patchTask(as("lead"), { ws, ref: task.ref, recurrence: { freq: "daily", interval: 1 } });
		expect(await catchUpRecurrences(env.db)).toEqual({ created: 1 });
		expect(await catchUpRecurrences(env.db)).toEqual({ created: 0 });
		const series = (await tasks.listTasks(as("lead"), ws, key)).tasks.filter(
			(each) => each.title === "Water the plants",
		);
		expect(series.map((each) => each.dueOn).sort()).toEqual([addDays(today(), -3), today()].sort());
		// The late one stays open; the rule moved on.
		expect(series.find((each) => each.id === task.id)?.recurrence).toBeNull();
		const history = await detail(series.find((each) => each.id !== task.id)?.ref ?? "");
		expect(history.activity.find((entry) => entry.kind === "task.created")?.data).toMatchObject({
			recurredFrom: task.ref,
			via: "repeat",
		});
	});
});

describe("the sandbox", () => {
	it("seeds rules with a run and a monthly task, and the claim moves them to the account", async () => {
		await env.reset();
		await workspaceRepo.ensureTeamWorkspace(env.db);
		const sandbox = await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const rules = await env.db
			.select()
			.from(schema.tlAutomation)
			.where(eq(schema.tlAutomation.workspaceId, sandbox.id));
		expect(rules).toHaveLength(3);
		expect(rules.map((each) => each.name)).toContain("नयाँ बग विकासलाई");
		const repeating = await env.db.select().from(schema.tlTask).where(eq(schema.tlTask.workspaceId, sandbox.id));
		expect(repeating.filter((task) => task.recurrence?.freq === "monthly")).toHaveLength(1);
		const runs = await env.db.select().from(schema.tlAutomationRun);
		expect(runs.map((run) => run.outcome)).toEqual(["ok"]);

		// An account with a sandbox of its own takes the guest's in: its rules come along, its creator remapped.
		const target = await env.db.transaction((tx) => seedSandbox(tx, "account", "en"));
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const moved = await env.db.select().from(schema.tlAutomation).where(eq(schema.tlAutomation.workspaceId, target.id));
		expect(moved).toHaveLength(6);
		const accountMember = await workspaceRepo.memberOf(env.db, target.id, "account");
		expect(new Set(moved.map((each) => each.createdById))).toEqual(new Set([accountMember?.id]));
		const list = await automations.listAutomations(as("account"), "sandbox", "WEB2");
		expect(list.automations).toHaveLength(3);
		expect(list.runs).toHaveLength(1);
	});
});
