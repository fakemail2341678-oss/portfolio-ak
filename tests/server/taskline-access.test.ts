import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { taskList } from "@/features/taskline/search";
import { isAppError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as automations from "@/server/taskline/automations/service";
import * as collab from "@/server/taskline/collab/service";
import * as fields from "@/server/taskline/fields/service";
import * as home from "@/server/taskline/home/service";
import * as projects from "@/server/taskline/projects/service";
import * as updates from "@/server/taskline/projects/updates";
import * as reports from "@/server/taskline/reports/service";
import { seedSandbox } from "@/server/taskline/sandbox";
import * as sprints from "@/server/taskline/sprints/service";
import * as imports from "@/server/taskline/tasks/import";
import * as tasks from "@/server/taskline/tasks/service";
import * as time from "@/server/taskline/time/service";
import * as timeline from "@/server/taskline/timeline/service";
import * as views from "@/server/taskline/views/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import * as workspaces from "@/server/taskline/workspace/service";
import { createTestDb } from "../utils/test-db";

/**
 * Taskline's access matrix (decision 0204, the table in docs/guides/taskline.md): every
 * app service, called by every kind of caller, against a team-visible project, a
 * private one and a guest's sandbox. Refusals of what the caller can't see are
 * NOT_FOUND; of what they can see but not change, FORBIDDEN. A new function adds its
 * operation to OPERATIONS (docs/guides/taskline.md, "Adding to Taskline").
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const USERS = ["lead", "member", "viewer", "spare", "deactivated", "outsider", "reader", "manager"] as const;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db
			.insert(schema.user)
			.values([
				...USERS.map((id) => ({ id, name: id === "spare" ? "Spare" : id, email: `${id}@example.com` })),
				{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
			]);
		await workspaceRepo.ensureTeamWorkspace(db);
	});
}, 60_000);
afterAll(() => env.close());

type Caller = (typeof USERS)[number] | "guest";
const as = (id: Caller): TasklineServices => ({
	db: env.db,
	user: {
		id,
		isGuest: id === "guest",
		permissions: id === "reader" ? ["taskline:read"] : id === "manager" ? ["taskline:manage", "taskline:read"] : [],
	},
});

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

/** The team (lead, member, viewer, spare and a deactivated member), its projects WEB (team) and SEC (private), and the guest's sandbox. */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(
			tx,
			(["lead", "member", "viewer", "spare", "deactivated"] as const).map((id) => ({
				workspaceId: team.id,
				userId: id,
				displayName: id === "spare" ? "Spare" : id,
				role: id === "viewer" ? ("viewer" as const) : ("member" as const),
			})),
		),
	);
	// Only an admin creates team projects by default; then the lead leads them.
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	await projects.createProject(as("lead"), { ws: "team", key: "WEB", name: "Website" });
	await projects.createProject(as("lead"), { ws: "team", key: "SEC", name: "Security", visibility: "private" });
	const deactivated = rows.find((row) => row.userId === "deactivated");
	if (!deactivated) throw new Error("no deactivated member");
	await projects.setProjectMember(as("lead"), { ws: "team", key: "SEC", memberId: deactivated.id, role: "member" });
	await env.db.transaction((tx) => workspaceRepo.setMemberDeactivated(tx, deactivated.id, new Date()));
	await env.db.update(schema.tlWorkspace).set({ settings: {} }).where(eq(schema.tlWorkspace.id, team.id));
	await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
	// The outsider has a sandbox of their own, with nothing in it.
	await env.db.transaction((tx) => workspaceRepo.insertSandbox(tx, "outsider", "Empty"));
}

type Context = { ws: string; key: string; owner: Caller };
type Need = "read" | "comment" | "edit" | "manage";
/** A rule any scope can hold (it names nothing of a project's). */
const AUTOMATION = () => ({
	name: unique("Rule").slice(0, 80),
	enabled: true,
	trigger: { type: "task_created" as const },
	conditions: [],
	actions: [{ type: "set_priority" as const, priority: 2 as const }],
});

type Operation = {
	name: string;
	need: Need;
	/** Only a workspace member can (comment, watch): an admin reading or managing through RBAC without a member row is FORBIDDEN. */
	memberOnly?: boolean;
	run: (context: Context, caller: TasklineServices) => Promise<unknown>;
};

/** Callers who reach team projects through `taskline:` permissions, with no member row. */
const NO_MEMBER: ReadonlySet<Caller> = new Set(["reader", "manager"]);

/** A pending upload of `owner`'s (what a confirmed upload leaves), for the file operations. */
const pendingUpload = async (owner: Caller) => {
	const [row] = await env.db
		.insert(schema.attachment)
		.values({
			publicId: `test/taskline/${crypto.randomUUID()}`,
			version: 1,
			resourceType: "image",
			format: "png",
			bytes: 1000,
			width: 10,
			height: 10,
			ownerId: owner,
		})
		.returning();
	if (!row) throw new Error("no attachment");
	return row.id;
};

/** A task the context's owner creates for an operation to act on. */
const ownerTask = async ({ ws, key, owner }: Context) => tasks.createTask(as(owner), { ws, key, title: "Fixture" });
const ownerBoard = ({ ws, key, owner }: Context) => tasks.listTasks(as(owner), ws, key);
/** A member of the context's workspace other than its owner: "Spare" in the team, a placeholder in a sandbox. */
const otherMember = async ({ ws, owner }: Context) => {
	const found = (await workspaces.listMembers(as(owner), ws)).find((row) => row.name === "Spare" || row.placeholder);
	if (!found) throw new Error("no other member");
	return found.id;
};
let counter = 0;
const unique = (prefix: string) => `${prefix} ${++counter}`;

/** Task 52's fixtures: a planned sprint of the owner's, and the project's active sprint (the sandbox already has one). */
const TWO_WEEKS = () => {
	const startOn = todayInZone(APP_TIME_ZONE);
	return { startOn, endOn: addDays(startOn, 13) };
};
const ownerSprint = ({ ws, key, owner }: Context) =>
	sprints.createSprint(as(owner), { ws, key, name: unique("Sprint"), ...TWO_WEEKS() });
const completeActive = async ({ ws, key, owner }: Context) => {
	const active = (await ownerBoard({ ws, key, owner })).sprints.find((sprint) => sprint.state === "active");
	if (active) await sprints.completeSprint(as(owner), { ws, key, id: active.id, carryTo: "backlog" });
};
const activeSprint = async (context: Context) => {
	await completeActive(context);
	const sprint = await ownerSprint(context);
	return sprints.startSprint(as(context.owner), context.ws, context.key, sprint.id);
};

const OPERATIONS: ReadonlyArray<Operation> = [
	// Reading
	{ name: "getProject", need: "read", run: ({ ws, key }, caller) => projects.getProject(caller, ws, key) },
	{ name: "listTasks", need: "read", run: ({ ws, key }, caller) => tasks.listTasks(caller, ws, key) },
	{
		name: "listProjectMembers",
		need: "read",
		run: ({ ws, key }, caller) => projects.listProjectMembers(caller, ws, key),
	},
	{ name: "listTrash", need: "read", run: ({ ws, key }, caller) => tasks.listTrash(caller, ws, key) },
	{
		name: "listTaskPage",
		need: "read",
		run: ({ ws, key }, caller) => tasks.listTaskPage(caller, { ...taskList.defaults, pageSize: 20, ws, key }),
	},
	{
		name: "listProjectActivity",
		need: "read",
		run: ({ ws, key }, caller) => tasks.listProjectActivity(caller, ws, key),
	},
	{ name: "getProjectRev", need: "read", run: ({ ws, key }, caller) => tasks.getProjectRev(caller, ws, key) },
	{
		name: "locateProject",
		need: "read",
		run: async ({ ws, key, owner }, caller) =>
			projects.locateProject(caller, (await projects.getProject(as(owner), ws, key)).id),
	},
	{
		name: "getTask",
		need: "read",
		run: async (context, caller) => tasks.getTask(caller, context.ws, (await ownerTask(context)).ref),
	},
	// Editing tasks
	{
		name: "createTask",
		need: "edit",
		run: ({ ws, key }, caller) => tasks.createTask(caller, { ws, key, title: "New" }),
	},
	{
		name: "updateTask",
		need: "edit",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			return tasks.updateTask(caller, {
				ws: context.ws,
				ref: task.ref,
				version: task.version,
				title: "Renamed",
				description: "<p>Body</p>",
			});
		},
	},
	{
		name: "patchTask",
		need: "edit",
		run: async (context, caller) =>
			tasks.patchTask(caller, { ws: context.ws, ref: (await ownerTask(context)).ref, priority: 3 }),
	},
	{
		name: "moveTask",
		need: "edit",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			const { statuses } = await ownerBoard(context);
			return tasks.moveTask(caller, {
				ws: context.ws,
				ref: task.ref,
				statusId: statuses[2]?.id ?? "",
				position: "a5",
			});
		},
	},
	{
		name: "setChecklist",
		need: "edit",
		run: async (context, caller) =>
			tasks.setChecklist(caller, {
				ws: context.ws,
				ref: (await ownerTask(context)).ref,
				checklist: [{ id: crypto.randomUUID(), text: "One", done: false }],
			}),
	},
	{
		name: "trashTask",
		need: "edit",
		run: async (context, caller) => tasks.trashTask(caller, context.ws, (await ownerTask(context)).ref),
	},
	{
		name: "restoreTask",
		need: "edit",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			await tasks.trashTask(as(context.owner), context.ws, task.ref);
			return tasks.restoreTask(caller, context.ws, task.ref);
		},
	},
	{
		name: "bulkUpdate",
		need: "edit",
		run: async (context, caller) =>
			tasks.bulkUpdate(caller, {
				ws: context.ws,
				key: context.key,
				ids: [(await ownerTask(context)).id],
				priority: 2,
			}),
	},
	// Collaboration (Task 50)
	{
		name: "addComment",
		need: "comment",
		memberOnly: true,
		run: async (context, caller) =>
			collab.addComment(caller, { ws: context.ws, ref: (await ownerTask(context)).ref, body: "<p>Hello</p>" }),
	},
	{
		name: "updateComment",
		need: "comment",
		memberOnly: true,
		run: async (context, caller) => {
			const task = await ownerTask(context);
			const added = await collab.addComment(caller, { ws: context.ws, ref: task.ref, body: "<p>Draft</p>" });
			const id = added.comments.at(-1)?.id ?? "";
			return collab.updateComment(caller, { ws: context.ws, ref: task.ref, id, body: "<p>Final</p>" });
		},
	},
	{
		name: "deleteComment (someone else's)",
		need: "manage",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			const added = await collab.addComment(as(context.owner), { ws: context.ws, ref: task.ref, body: "<p>Mine</p>" });
			return collab.deleteComment(caller, { ws: context.ws, ref: task.ref, id: added.comments.at(-1)?.id ?? "" });
		},
	},
	{
		name: "watchTask",
		need: "read",
		memberOnly: true,
		run: async (context, caller) =>
			collab.watchTask(caller, { ws: context.ws, ref: (await ownerTask(context)).ref, watching: true }),
	},
	{
		name: "addTaskFiles",
		need: "edit",
		run: async (context, caller) =>
			collab.addTaskFiles(caller, {
				ws: context.ws,
				ref: (await ownerTask(context)).ref,
				ids: [await pendingUpload(caller.user.id as Caller)],
			}),
	},
	{
		name: "removeTaskFile",
		need: "edit",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			const id = await pendingUpload(context.owner);
			await collab.addTaskFiles(as(context.owner), { ws: context.ws, ref: task.ref, ids: [id] });
			return collab.removeTaskFile(caller, { ws: context.ws, ref: task.ref, id });
		},
	},
	// Finding things (Task 51)
	{
		name: "listSavedViews",
		need: "read",
		run: ({ ws, key }, caller) => views.listViews(caller, { ws, key, view: "list" }),
	},
	{
		name: "saveView (own)",
		need: "read",
		memberOnly: true,
		run: ({ ws, key }, caller) =>
			views.saveView(caller, { ws, key, view: "list", name: unique("Mine"), search: "?due=week", shared: false }),
	},
	{
		name: "saveView (shared)",
		need: "edit",
		memberOnly: true,
		run: ({ ws, key }, caller) =>
			views.saveView(caller, { ws, key, view: "board", name: unique("Ours"), search: "", shared: true }),
	},
	{
		name: "deleteView (someone else's shared)",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const view = await views.saveView(as(owner), {
				ws,
				key,
				view: "calendar",
				name: unique("Team"),
				search: "?mode=week",
				shared: true,
			});
			return views.deleteView(caller, { ws, key, id: view.id });
		},
	},
	{
		name: "importTasks",
		need: "edit",
		run: ({ ws, key }, caller) =>
			imports.importTasks(caller, {
				ws,
				key,
				idempotencyKey: crypto.randomUUID(),
				rows: [
					{
						title: "Imported",
						description: "",
						type: null,
						status: "",
						assignee: "",
						priority: 0,
						labels: [],
						startOn: null,
						dueOn: null,
					},
				],
			}),
	},
	// Running the project (its lead's)
	{
		name: "purgeTask",
		need: "manage",
		run: async (context, caller) => {
			const task = await ownerTask(context);
			await tasks.trashTask(as(context.owner), context.ws, task.ref);
			return tasks.purgeTask(caller, context.ws, task.ref);
		},
	},
	{
		name: "updateProject",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const project = await projects.getProject(as(owner), ws, key);
			return projects.updateProject(caller, { ws, key, version: project.version, name: "Renamed" });
		},
	},
	{
		name: "setProjectState",
		need: "manage",
		run: ({ ws, key }, caller) => projects.setProjectState(caller, { ws, key, health: "at_risk" }),
	},
	{
		name: "setProjectArchived",
		need: "manage",
		run: async ({ ws, key }, caller) => {
			await projects.setProjectArchived(caller, { ws, key, archived: true });
			return projects.setProjectArchived(caller, { ws, key, archived: false });
		},
	},
	{
		name: "setProjectMember",
		need: "manage",
		run: async (context, caller) =>
			projects.setProjectMember(caller, {
				ws: context.ws,
				key: context.key,
				memberId: await otherMember(context),
				role: "viewer",
			}),
	},
	{
		name: "removeProjectMember",
		need: "manage",
		run: async (context, caller) => {
			const memberId = await otherMember(context);
			await projects.setProjectMember(as(context.owner), {
				ws: context.ws,
				key: context.key,
				memberId,
				role: "member",
			});
			return projects.removeProjectMember(caller, { ws: context.ws, key: context.key, memberId });
		},
	},
	{
		name: "createStatus",
		need: "manage",
		run: ({ ws, key }, caller) =>
			workflow.createStatus(caller, { ws, key, name: unique("Review"), category: "started" }),
	},
	{
		name: "updateStatus",
		need: "manage",
		run: async (context, caller) => {
			const { statuses } = await ownerBoard(context);
			return workflow.updateStatus(caller, {
				ws: context.ws,
				key: context.key,
				id: statuses[0]?.id ?? "",
				color: "pink",
			});
		},
	},
	{
		name: "deleteStatus",
		need: "manage",
		run: async (context, caller) => {
			const status = await workflow.createStatus(as(context.owner), {
				ws: context.ws,
				key: context.key,
				name: unique("Spare"),
				category: "started",
			});
			return workflow.deleteStatus(caller, { ws: context.ws, key: context.key, id: status.id });
		},
	},
	{
		name: "createLabel",
		need: "manage",
		run: ({ ws, key }, caller) => workflow.createLabel(caller, { ws, key, name: unique("Label") }),
	},
	{
		name: "updateLabel",
		need: "manage",
		run: async (context, caller) => {
			const label = await workflow.createLabel(as(context.owner), {
				ws: context.ws,
				key: context.key,
				name: unique("Label"),
			});
			return workflow.updateLabel(caller, { ws: context.ws, key: context.key, id: label.id, color: "green" });
		},
	},
	{
		name: "deleteLabel",
		need: "manage",
		run: async (context, caller) => {
			const label = await workflow.createLabel(as(context.owner), {
				ws: context.ws,
				key: context.key,
				name: unique("Label"),
			});
			return workflow.deleteLabel(caller, { ws: context.ws, key: context.key, id: label.id });
		},
	},
	// Sprints (Task 52)
	{
		name: "createSprint",
		need: "edit",
		run: ({ ws, key }, caller) => sprints.createSprint(caller, { ws, key, name: unique("Sprint"), ...TWO_WEEKS() }),
	},
	{
		name: "updateSprint",
		need: "edit",
		run: async (context, caller) => {
			const sprint = await ownerSprint(context);
			return sprints.updateSprint(caller, { ws: context.ws, key: context.key, id: sprint.id, goal: "Ship it" });
		},
	},
	{
		name: "deleteSprint",
		need: "edit",
		run: async (context, caller) => {
			const sprint = await ownerSprint(context);
			return sprints.deleteSprint(caller, context.ws, context.key, sprint.id);
		},
	},
	{
		name: "startSprint",
		need: "edit",
		run: async (context, caller) => {
			await completeActive(context);
			const sprint = await ownerSprint(context);
			return sprints.startSprint(caller, context.ws, context.key, sprint.id);
		},
	},
	{
		name: "completeSprint",
		need: "edit",
		run: async (context, caller) => {
			const sprint = await activeSprint(context);
			return sprints.completeSprint(caller, { ws: context.ws, key: context.key, id: sprint.id, carryTo: "backlog" });
		},
	},
	{
		name: "rankTask",
		need: "edit",
		run: async (context, caller) => {
			const [task, sprint] = await Promise.all([ownerTask(context), ownerSprint(context)]);
			return sprints.rankTask(caller, { ws: context.ws, ref: task.ref, sprintId: sprint.id, rank: "a0" });
		},
	},
	{
		name: "getSprintReport",
		need: "read",
		run: async (context, caller) => {
			const sprint = await ownerSprint(context);
			return sprints.getSprintReport(caller, context.ws, context.key, sprint.id);
		},
	},
	// Task 53: time is a member's (memberOnly), logged where they may edit.
	{
		name: "startTimer",
		need: "edit",
		memberOnly: true,
		run: async (context, caller) => time.startTimer(caller, context.ws, (await ownerTask(context)).ref),
	},
	{
		name: "logTime",
		need: "edit",
		memberOnly: true,
		run: async (context, caller) =>
			time.logTime(caller, { ws: context.ws, ref: (await ownerTask(context)).ref, onDay: TODAY(), minutes: 30 }),
	},
	{
		name: "updateTimeEntry (own)",
		need: "edit",
		memberOnly: true,
		run: async (context, caller) => {
			const ref = (await ownerTask(context)).ref;
			const entry = await time.logTime(caller, { ws: context.ws, ref, onDay: TODAY(), minutes: 30 });
			return time.updateEntry(caller, { ws: context.ws, id: entry.id, minutes: 45 });
		},
	},
	{
		name: "deleteTimeEntry (own)",
		need: "edit",
		memberOnly: true,
		run: async (context, caller) => {
			const ref = (await ownerTask(context)).ref;
			const entry = await time.logTime(caller, { ws: context.ws, ref, onDay: TODAY(), minutes: 30 });
			return time.deleteEntry(caller, context.ws, entry.id);
		},
	},
	{
		name: "setTimesheetCell",
		need: "edit",
		memberOnly: true,
		run: async (context, caller) =>
			time.setCell(caller, { ws: context.ws, ref: (await ownerTask(context)).ref, onDay: TODAY(), minutes: 60 }),
	},
	{
		name: "getProjectTime",
		need: "read",
		run: ({ ws, key }, caller) => time.getProjectTime(caller, ws, key),
	},
	// Task 54: milestones and dependencies are the editors'.
	{
		name: "createMilestone",
		need: "edit",
		run: ({ ws, key }, caller) => timeline.createMilestone(caller, { ws, key, name: unique("Milestone") }),
	},
	{
		name: "updateMilestone",
		need: "edit",
		run: async ({ ws, key, owner }, caller) => {
			const milestone = await timeline.createMilestone(as(owner), { ws, key, name: unique("Milestone") });
			return timeline.updateMilestone(caller, { ws, key, id: milestone.id, completed: true });
		},
	},
	{
		name: "deleteMilestone",
		need: "edit",
		run: async ({ ws, key, owner }, caller) => {
			const milestone = await timeline.createMilestone(as(owner), { ws, key, name: unique("Milestone") });
			return timeline.deleteMilestone(caller, ws, key, milestone.id);
		},
	},
	{
		name: "addDependency",
		need: "edit",
		run: async (context, caller) => {
			const [blocked, blocker] = [await ownerTask(context), await ownerTask(context)];
			return timeline.addDependency(caller, {
				ws: context.ws,
				ref: blocked.ref,
				relation: "blocked_by",
				other: blocker.ref,
			});
		},
	},
	{
		name: "removeDependency",
		need: "edit",
		run: async (context, caller) => {
			const [blocked, blocker] = [await ownerTask(context), await ownerTask(context)];
			const input = { ws: context.ws, ref: blocked.ref, relation: "blocked_by" as const, other: blocker.ref };
			await timeline.addDependency(as(context.owner), input);
			return timeline.removeDependency(caller, input);
		},
	},
	// Task 55: a project's own fields are its lead's.
	{
		name: "createField",
		need: "manage",
		run: ({ ws, key }, caller) =>
			fields.createField(caller, {
				ws,
				key,
				field: { type: "text", name: unique("Field").slice(0, 40), required: false },
			}),
	},
	{
		name: "updateField",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const field = await fields.createField(as(owner), {
				ws,
				key,
				field: { type: "text", name: unique("Field").slice(0, 40), required: false },
			});
			return fields.updateField(caller, { ws, key, id: field.id, required: true });
		},
	},
	{
		name: "deleteField",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const field = await fields.createField(as(owner), {
				ws,
				key,
				field: { type: "checkbox", name: unique("Field").slice(0, 40), required: false },
			});
			return fields.deleteField(caller, { ws, key, id: field.id });
		},
	},
	// Task 56: a project's automations are its lead's, the preview and the run log too.
	{
		name: "listAutomations",
		need: "manage",
		run: ({ ws, key }, caller) => automations.listAutomations(caller, ws, key),
	},
	{
		name: "createAutomation",
		need: "manage",
		run: ({ ws, key }, caller) => automations.createAutomation(caller, { ws, key, automation: AUTOMATION() }),
	},
	{
		name: "updateAutomation",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const rule = await automations.createAutomation(as(owner), { ws, key, automation: AUTOMATION() });
			return automations.updateAutomation(caller, {
				ws,
				key,
				id: rule.id,
				version: rule.version,
				automation: AUTOMATION(),
			});
		},
	},
	{
		name: "toggleAutomation",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const rule = await automations.createAutomation(as(owner), { ws, key, automation: AUTOMATION() });
			return automations.toggleAutomation(caller, { ws, key, id: rule.id, enabled: false });
		},
	},
	{
		name: "deleteAutomation",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const rule = await automations.createAutomation(as(owner), { ws, key, automation: AUTOMATION() });
			return automations.deleteAutomation(caller, { ws, key, id: rule.id });
		},
	},
	{
		name: "previewAutomation",
		need: "manage",
		run: ({ ws, key }, caller) => automations.previewAutomation(caller, { ws, key, conditions: [] }),
	},
	// Task 57: anyone who sees a project reads its reports and updates; whoever may run it posts and deletes.
	{
		name: "projectReports",
		need: "read",
		run: ({ ws, key }, caller) => reports.getProjectReports(caller, { ws, key, range: "4w" }),
	},
	{
		name: "listProjectUpdates",
		need: "read",
		run: ({ ws, key }, caller) => updates.listProjectUpdates(caller, { ws, key }),
	},
	{
		name: "postProjectUpdate",
		need: "manage",
		run: ({ ws, key }, caller) =>
			updates.postProjectUpdate(caller, { ws, key, health: "on_track", body: "<p>Going well</p>" }),
	},
	{
		name: "deleteProjectUpdate",
		need: "manage",
		run: async ({ ws, key, owner }, caller) => {
			const update = await updates.postProjectUpdate(as(owner), { ws, key, health: "at_risk", body: "<p>A risk</p>" });
			return updates.deleteProjectUpdate(caller, { ws, key, id: update.id });
		},
	},
];

const TODAY = () => todayInZone(APP_TIME_ZONE);

type Level = "none" | "read" | "comment" | "edit" | "manage";
const RANK: Record<Level, number> = { none: 0, read: 1, comment: 2, edit: 3, manage: 4 };
const expected = (level: Level, need: Need) =>
	RANK[level] >= RANK[need] ? "ok" : level === "none" ? "NOT_FOUND" : "FORBIDDEN";

/** What each caller may do, per context: the table in docs/guides/taskline.md. */
const MATRIX: ReadonlyArray<{ context: Context; title: string; levels: Partial<Record<Caller, Level>> }> = [
	{
		title: "a team-visible project",
		context: { ws: "team", key: "WEB", owner: "lead" },
		levels: {
			lead: "manage",
			member: "edit",
			viewer: "comment",
			deactivated: "none",
			outsider: "none",
			guest: "none",
			reader: "read",
			manager: "manage",
		},
	},
	{
		title: "a private project",
		context: { ws: "team", key: "SEC", owner: "lead" },
		levels: {
			lead: "manage",
			member: "none",
			viewer: "none",
			deactivated: "none",
			outsider: "none",
			guest: "none",
			reader: "read",
			manager: "manage",
		},
	},
	{
		title: "a guest's sandbox",
		context: { ws: "sandbox", key: "WEB", owner: "guest" },
		levels: { guest: "manage", outsider: "none", lead: "none", reader: "none", manager: "none" },
	},
];

describe("the Taskline access matrix", () => {
	for (const { title, context, levels } of MATRIX) {
		describe(title, () => {
			for (const [caller, level] of Object.entries(levels) as Array<[Caller, Level]>) {
				// Every operation once with its fixtures, some seventy writes on PGlite: slow under the full suite.
				it(`${caller}: ${level}`, async () => {
					await setUp();
					const outcomes: Record<string, string> = {};
					const wanted: Record<string, string> = {};
					for (const operation of OPERATIONS) {
						outcomes[operation.name] = await code(operation.run(context, as(caller)));
						const allowed = expected(level, operation.need);
						wanted[operation.name] =
							operation.memberOnly && allowed === "ok" && NO_MEMBER.has(caller) ? "FORBIDDEN" : allowed;
					}
					expect(outcomes).toEqual(wanted);
				}, 60_000);
			}
		});
	}
});

describe("the workspace", () => {
	beforeEach(setUp);

	it("lists the team only for its active members and the taskline: permissions, and each caller's own sandbox", async () => {
		const segments = async (caller: Caller) =>
			(await workspaces.listWorkspaces(as(caller))).map((workspace) => workspace.segment);
		expect(await segments("lead")).toEqual(["team"]);
		expect(await segments("viewer")).toEqual(["team"]);
		expect(await segments("reader")).toEqual(["team"]);
		expect(await segments("deactivated")).toEqual([]);
		expect(await segments("outsider")).toEqual(["sandbox"]);
		expect(await segments("guest")).toEqual(["sandbox"]);
	});

	it("opens the team to members and admins, and to nobody else", async () => {
		expect((await workspaces.getWorkspace(as("viewer"), "team")).me?.role).toBe("viewer");
		expect((await workspaces.getWorkspace(as("reader"), "team")).me).toBeNull();
		for (const caller of ["deactivated", "outsider", "guest"] as const) {
			expect(await code(workspaces.getWorkspace(as(caller), "team"))).toBe("NOT_FOUND");
			expect(await code(workspaces.listMembers(as(caller), "team"))).toBe("NOT_FOUND");
			expect(await code(projects.listProjects(as(caller), { ws: "team" }))).toBe("NOT_FOUND");
		}
		expect(await code(workspaces.getWorkspace(as("lead"), "sandbox"))).toBe("NOT_FOUND");
		expect(await code(workspaces.getWorkspace(as("lead"), "elsewhere"))).toBe("NOT_FOUND");
	});

	it("lists the projects each caller may see", async () => {
		const keys = async (caller: Caller) =>
			(await projects.listProjects(as(caller), { ws: "team" })).map((project) => project.key);
		expect(await keys("lead")).toEqual(["SEC", "WEB"]);
		expect(await keys("member")).toEqual(["WEB"]);
		expect(await keys("viewer")).toEqual(["WEB"]);
		expect(await keys("reader")).toEqual(["SEC", "WEB"]);
		expect(await keys("manager")).toEqual(["SEC", "WEB"]);
	});

	it("lets admins create team projects, and members only when the settings say so", async () => {
		expect(await code(projects.createProject(as("member"), { ws: "team", key: "NEW", name: "New" }))).toBe("FORBIDDEN");
		expect(await code(projects.createProject(as("reader"), { ws: "team", key: "NEW", name: "New" }))).toBe("FORBIDDEN");
		expect(await code(projects.createProject(as("manager"), { ws: "team", key: "NEW", name: "New" }))).toBe("ok");
		await env.db
			.update(schema.tlWorkspace)
			.set({ settings: { projectCreation: "members" } })
			.where(eq(schema.tlWorkspace.kind, "team"));
		expect(await code(projects.createProject(as("member"), { ws: "team", key: "MEM", name: "Mine" }))).toBe("ok");
		expect(await code(projects.createProject(as("viewer"), { ws: "team", key: "VIEW", name: "Mine" }))).toBe(
			"FORBIDDEN",
		);
		expect(await code(projects.createProject(as("guest"), { ws: "sandbox", key: "TRY", name: "Mine" }))).toBe("ok");
	});

	it("lets team members join team-visible projects when allowed, and stars only for members", async () => {
		expect((await projects.joinProject(as("member"), { ws: "team", key: "WEB" })).role).toBe("member");
		expect(await code(projects.joinProject(as("viewer"), { ws: "team", key: "WEB" }))).toBe("FORBIDDEN");
		expect(await code(projects.joinProject(as("member"), { ws: "team", key: "SEC" }))).toBe("NOT_FOUND");
		expect(await code(projects.joinProject(as("reader"), { ws: "team", key: "WEB" }))).toBe("FORBIDDEN");
		await env.db
			.update(schema.tlWorkspace)
			.set({ settings: { membersCanJoin: false } })
			.where(eq(schema.tlWorkspace.kind, "team"));
		expect(await code(projects.joinProject(as("spare"), { ws: "team", key: "WEB" }))).toBe("FORBIDDEN");

		await projects.setProjectStar(as("viewer"), { ws: "team", key: "WEB", starred: true });
		expect((await projects.getProject(as("viewer"), "team", "WEB")).starred).toBe(true);
		expect((await projects.getProject(as("lead"), "team", "WEB")).starred).toBe(false);
		expect(await code(projects.setProjectStar(as("reader"), { ws: "team", key: "WEB", starred: true }))).toBe(
			"FORBIDDEN",
		);
	});

	it("refuses ids from another project or workspace as not found", async () => {
		const sandbox = await tasks.listTasks(as("guest"), "sandbox", "WEB");
		const security = await tasks.listTasks(as("lead"), "team", "SEC");
		const placeholder = sandbox.members.find((member) => member.placeholder)?.id ?? "";
		const task = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Mine" });
		const foreignTask = sandbox.tasks[0]?.id ?? "";
		const ws = "team";
		expect(await code(tasks.patchTask(as("lead"), { ws, ref: task.ref, assigneeId: placeholder }))).toBe("NOT_FOUND");
		expect(await code(tasks.patchTask(as("lead"), { ws, ref: task.ref, parentId: foreignTask }))).toBe("NOT_FOUND");
		expect(
			await code(tasks.patchTask(as("lead"), { ws, ref: task.ref, labelIds: [sandbox.labels[0]?.id ?? ""] })),
		).toBe("NOT_FOUND");
		expect(
			await code(
				tasks.moveTask(as("lead"), { ws, ref: task.ref, statusId: security.statuses[0]?.id ?? "", position: "a1" }),
			),
		).toBe("NOT_FOUND");
		expect(
			await code(projects.setProjectMember(as("lead"), { ws, key: "WEB", memberId: placeholder, role: "member" })),
		).toBe("NOT_FOUND");
		expect(await code(tasks.getTask(as("lead"), ws, "WEB-999"))).toBe("NOT_FOUND");
		expect(await code(tasks.getTask(as("lead"), ws, "not-a-ref"))).toBe("NOT_FOUND");
	});
});

describe("home and the shell's navigation", () => {
	beforeEach(setUp);

	const memberId = async (caller: Caller) => {
		const found = (await workspaces.listMembers(as("lead"), "team")).find((row) => row.userId === caller);
		if (!found) throw new Error(`no member ${caller}`);
		return found.id;
	};

	it("lists only the projects each caller may see, in every workspace they have", async () => {
		const nav = async (caller: Caller) => {
			const { workspaces: found, recent } = await home.getNav(as(caller));
			return { workspaces: found.map((row) => row.segment), recent: recent.map((row) => `${row.ws}/${row.key}`) };
		};
		expect(await nav("lead")).toEqual({ workspaces: ["team"], recent: ["team/SEC", "team/WEB"] });
		expect(await nav("member")).toEqual({ workspaces: ["team"], recent: ["team/WEB"] });
		expect(await nav("reader")).toEqual({ workspaces: ["team"], recent: ["team/SEC", "team/WEB"] });
		expect(await nav("deactivated")).toEqual({ workspaces: [], recent: [] });
		expect(await nav("guest")).toEqual({ workspaces: ["sandbox"], recent: ["sandbox/WEB"] });
		expect(await nav("outsider")).toEqual({ workspaces: ["sandbox"], recent: [] });
	});

	it("puts the projects a caller worked on first, and lists their stars", async () => {
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Touch" });
		const lead = await home.getNav(as("lead"));
		expect(lead.recent.map((row) => row.key)).toEqual(["WEB", "SEC"]);
		await projects.setProjectStar(as("member"), { ws: "team", key: "WEB", starred: true });
		expect((await home.getNav(as("member"))).starred.map((row) => row.key)).toEqual(["WEB"]);
		expect((await home.getNav(as("lead"))).starred).toEqual([]);
		// An archived project leaves the navigation, even when it was worked on.
		await projects.setProjectArchived(as("lead"), { ws: "team", key: "SEC", archived: true });
		expect((await home.getNav(as("lead"))).recent.map((row) => row.key)).toEqual(["WEB"]);
	});

	it("lists a caller's open tasks across workspaces, soonest due first, and none they can't see", async () => {
		const member = await memberId("member");
		const lead = await memberId("lead");
		const later = await tasks.createTask(as("lead"), {
			ws: "team",
			key: "WEB",
			title: "Later",
			assigneeId: member,
			dueOn: "2030-01-02",
		});
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Undated", assigneeId: member });
		await tasks.createTask(as("lead"), {
			ws: "team",
			key: "WEB",
			title: "Sooner",
			assigneeId: member,
			dueOn: "2030-01-01",
		});
		const done = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Done", assigneeId: member });
		const { statuses } = await tasks.listTasks(as("lead"), "team", "WEB");
		const completed = statuses.find((status) => status.category === "completed");
		await tasks.moveTask(as("lead"), { ws: "team", ref: done.ref, statusId: completed?.id ?? "", position: "a0" });
		const trashed = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Gone", assigneeId: member });
		await tasks.trashTask(as("lead"), "team", trashed.ref);
		await tasks.createTask(as("lead"), { ws: "team", key: "SEC", title: "Secret", assigneeId: lead });

		const mine = await home.listMyTasks(as("member"));
		expect(mine.tasks.map((task) => task.title)).toEqual(["Sooner", "Later", "Undated"]);
		expect(mine.tasks[1]).toMatchObject({ ref: later.ref, project: { key: "WEB", ws: "team" } });
		// My work (Task 51): the lead's own task, and the open ones they watch (they created them), soonest due first.
		const leads = (await home.listMyTasks(as("lead"))).tasks;
		expect(leads.filter((task) => task.assigned).map((task) => task.title)).toEqual(["Secret"]);
		expect(leads.filter((task) => !task.assigned).map((task) => task.title)).toEqual(["Sooner", "Later", "Undated"]);
		expect(leads.every((task) => task.watching)).toBe(true);
		expect(mine.weekEnd >= mine.today).toBe(true);
		expect((await home.listMyTasks(as("reader"))).tasks).toEqual([]);
		expect((await home.listMyTasks(as("deactivated"))).tasks).toEqual([]);
		const sandbox = await home.listMyTasks(as("guest"));
		expect(sandbox.tasks.every((task) => task.project.ws === "sandbox")).toBe(true);
	});
});
