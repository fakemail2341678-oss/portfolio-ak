import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bulkTasksInput, type TaskListInput } from "@/features/taskline/schema";
import { taskList } from "@/features/taskline/search";
import { isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as projects from "@/server/taskline/projects/service";
import { seedSandbox } from "@/server/taskline/sandbox";
import * as tasks from "@/server/taskline/tasks/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Taskline's views on PGlite (Task 48): the list's page (filters, sort, grouping,
 * pages), bulk changes, deleting from the trash for good, the project's feed, the rev
 * open pages poll, and finding a project by id (the old Kanban URLs). Who may call
 * each is in tests/server/taskline-access.test.ts.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "guest", name: "Anonymous", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
		const team = await workspaceRepo.ensureTeamWorkspace(db);
		await db.transaction((tx) =>
			workspaceRepo.insertMembers(tx, [
				{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead" },
				{ workspaceId: team.id, userId: "member", displayName: "Mohan Member" },
			]),
		);
	});
}, 60_000);
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.kind, "team"));
});

const as = (id: string): TasklineServices => ({
	db: env.db,
	user: { id, isGuest: id.startsWith("guest"), permissions: [] },
});
const lead = () => as("lead");
const ws = "team";

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

/** WEB with a few tasks: two assigned to the member, one overdue, one with a label. */
async function setUp() {
	await projects.createProject(lead(), { ws, key: "WEB", name: "Website" });
	const board = await tasks.listTasks(lead(), ws, "WEB");
	const member = board.members.find((each) => each.userId === "member");
	const [backlog, todo, doing, done] = board.statuses;
	if (!member || !backlog || !todo || !doing || !done) throw new Error("no fixtures");
	const { id: labelId } = await workflow.createLabel(lead(), { ws, key: "WEB", name: "Design", color: "violet" });
	const create = (title: string, extra: Partial<Parameters<typeof tasks.createTask>[1]> = {}) =>
		tasks.createTask(lead(), { ws, key: "WEB", title, ...extra });
	const alpha = await create("Alpha homepage", { assigneeId: member.id, priority: 4, dueOn: "2020-01-01" });
	const beta = await create("Beta navigation", { assigneeId: member.id, priority: 1, labelIds: [labelId] });
	const gamma = await create("Gamma footer", { statusId: doing.id, priority: 3 });
	const delta = await create("Delta launch", { statusId: done.id });
	return { board, member, statuses: { backlog, todo, doing, done }, labelId, alpha, beta, gamma, delta };
}

const page = (input: Partial<TaskListInput> = {}) =>
	tasks.listTaskPage(lead(), { ...taskList.defaults, pageSize: 20, ws, key: "WEB", ...input });
const refs = async (input: Partial<TaskListInput> = {}) => (await page(input)).items.map((task) => task.title);

describe("the list view", () => {
	it("filters by text, reference, status, assignee, label, priority, type and due date", async () => {
		const { member, statuses, labelId } = await setUp();
		expect(await refs({ q: "nav" })).toEqual(["Beta navigation"]);
		expect(await refs({ q: "WEB-3" })).toEqual(["Gamma footer"]);
		expect(await refs({ q: "4" })).toEqual(["Delta launch"]);
		expect(await refs({ status: statuses.doing.id })).toEqual(["Gamma footer"]);
		expect(await refs({ assignee: member.id, sort: "number" })).toEqual(["Alpha homepage", "Beta navigation"]);
		expect(await refs({ assignee: "none", sort: "number" })).toEqual(["Gamma footer", "Delta launch"]);
		// "me" is the caller's member row: the lead has nothing assigned.
		expect(await refs({ assignee: "me" })).toEqual([]);
		expect(await refs({ label: labelId })).toEqual(["Beta navigation"]);
		expect(await refs({ priority: "3" })).toEqual(["Gamma footer"]);
		expect(await refs({ type: "bug" })).toEqual([]);
		expect(await refs({ due: "overdue" })).toEqual(["Alpha homepage"]);
		expect(await refs({ due: "none", sort: "number" })).toEqual(["Beta navigation", "Gamma footer", "Delta launch"]);
	});

	it("sorts in board order by default, and by any sortable column", async () => {
		await setUp();
		// Board order: the statuses' order, then each one's positions.
		expect(await refs()).toEqual(["Alpha homepage", "Beta navigation", "Gamma footer", "Delta launch"]);
		expect(await refs({ sort: "-priority" })).toEqual([
			"Alpha homepage",
			"Gamma footer",
			"Beta navigation",
			"Delta launch",
		]);
		expect(await refs({ sort: "title" })).toEqual([
			"Alpha homepage",
			"Beta navigation",
			"Delta launch",
			"Gamma footer",
		]);
		expect(await refs({ sort: "-number" })).toEqual([
			"Delta launch",
			"Gamma footer",
			"Beta navigation",
			"Alpha homepage",
		]);
		// Due dates first, tasks without one last, either way.
		expect((await refs({ sort: "due" }))[0]).toBe("Alpha homepage");
		expect((await refs({ sort: "-due" }))[0]).toBe("Alpha homepage");
	});

	it("groups by assignee (unassigned last) before the sort, and pages", async () => {
		await setUp();
		expect(await refs({ group: "assignee", sort: "-number" })).toEqual([
			"Beta navigation",
			"Alpha homepage",
			"Delta launch",
			"Gamma footer",
		]);
		const first = await page({ pageSize: 10, sort: "number" });
		expect(first.total).toBe(4);
		expect(first.pageCount).toBe(1);
		// An out-of-range page is clamped to the last one.
		expect((await page({ page: 9 })).page).toBe(1);
	});

	it("leaves trashed tasks out", async () => {
		const { alpha } = await setUp();
		await tasks.trashTask(lead(), ws, alpha.ref);
		expect(await refs()).not.toContain("Alpha homepage");
	});
});

describe("bulk changes", () => {
	it("moves tasks to a status at its end, closing them by its category, with one entry each", async () => {
		const { alpha, beta, statuses } = await setUp();
		const before = (await projects.getProject(lead(), ws, "WEB")).rev;
		expect(
			await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, beta.id], statusId: statuses.done.id }),
		).toEqual({ count: 2 });
		const board = await tasks.listTasks(lead(), ws, "WEB");
		const done = board.tasks.filter((task) => task.statusId === statuses.done.id).map((task) => task.title);
		expect(done).toEqual(["Delta launch", "Alpha homepage", "Beta navigation"]);
		expect(board.tasks.find((task) => task.id === alpha.id)?.completedAt).not.toBeNull();
		// One rev for the whole change.
		expect(board.project.rev).toBe(before + 1);
		const moved = await env.db.select().from(schema.tlActivity).where(eq(schema.tlActivity.kind, "task.moved"));
		expect(moved).toHaveLength(2);
	});

	it("sets an assignee or a priority, skipping tasks that already have it", async () => {
		const { alpha, beta, gamma, member } = await setUp();
		expect(
			await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, gamma.id], assigneeId: member.id }),
		).toEqual({
			count: 1,
		});
		expect(await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, beta.id], priority: 2 })).toEqual({
			count: 2,
		});
		const board = await tasks.listTasks(lead(), ws, "WEB");
		expect(board.tasks.find((task) => task.id === gamma.id)?.assigneeId).toBe(member.id);
		expect(
			board.tasks
				.filter((task) => task.priority === 2)
				.map((task) => task.title)
				.sort(),
		).toEqual(["Alpha homepage", "Beta navigation"]);
		// The member now watches the task they were given.
		const watchers = await env.db.select().from(schema.tlTaskWatcher).where(eq(schema.tlTaskWatcher.taskId, gamma.id));
		expect(watchers.map((row) => row.memberId)).toContain(member.id);
	});

	it("adds and removes a label", async () => {
		const { alpha, beta, labelId } = await setUp();
		expect(await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, beta.id], addLabelId: labelId })).toEqual({
			count: 1,
		});
		expect(await refs({ label: labelId, sort: "number" })).toEqual(["Alpha homepage", "Beta navigation"]);
		expect(
			await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, beta.id], removeLabelId: labelId }),
		).toEqual({
			count: 2,
		});
		expect(await refs({ label: labelId })).toEqual([]);
	});

	it("puts tasks in the trash with their subtasks", async () => {
		const { alpha, gamma } = await setUp();
		const child = await tasks.createTask(lead(), { ws, key: "WEB", title: "Child", parentId: alpha.id });
		expect(await tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, gamma.id], trash: true })).toEqual({
			count: 2,
		});
		const trash = (await tasks.listTrash(lead(), ws, "WEB")).map((task) => task.ref).sort();
		expect(trash).toEqual([alpha.ref, gamma.ref, child.ref].sort());
	});

	it("refuses tasks of another project or in the trash, and nothing changes", async () => {
		const { alpha, beta } = await setUp();
		await projects.createProject(lead(), { ws, key: "APP", name: "App" });
		const other = await tasks.createTask(lead(), { ws, key: "APP", title: "Elsewhere" });
		expect(await code(tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, other.id], priority: 0 }))).toBe(
			"NOT_FOUND",
		);
		await tasks.trashTask(lead(), ws, beta.ref);
		expect(await code(tasks.bulkUpdate(lead(), { ws, key: "WEB", ids: [alpha.id, beta.id], priority: 0 }))).toBe(
			"NOT_FOUND",
		);
		expect((await tasks.getTask(lead(), ws, alpha.ref)).priority).toBe(4);
	});

	it("takes exactly one change at a time", () => {
		const base = { ws, key: "WEB", ids: [crypto.randomUUID()] };
		expect(bulkTasksInput.safeParse(base).success).toBe(false);
		expect(bulkTasksInput.safeParse({ ...base, priority: 1, trash: true }).success).toBe(false);
		expect(bulkTasksInput.safeParse({ ...base, assigneeId: null }).success).toBe(true);
	});
});

describe("deleting for good", () => {
	it("only from the trash, with its subtasks, leaving a project entry", async () => {
		const { alpha } = await setUp();
		const child = await tasks.createTask(lead(), { ws, key: "WEB", title: "Child", parentId: alpha.id });
		expect(await code(tasks.purgeTask(lead(), ws, alpha.ref))).toBe("CONFLICT");
		await tasks.trashTask(lead(), ws, alpha.ref);
		await tasks.purgeTask(lead(), ws, alpha.ref);
		expect(await code(tasks.getTask(lead(), ws, alpha.ref))).toBe("NOT_FOUND");
		expect(await code(tasks.getTask(lead(), ws, child.ref))).toBe("NOT_FOUND");
		const feed = await tasks.listProjectActivity(lead(), ws, "WEB");
		expect(feed[0]).toMatchObject({
			kind: "task.deleted",
			task: null,
			data: { ref: alpha.ref, title: "Alpha homepage" },
		});
		// The number isn't handed out again.
		expect((await tasks.createTask(lead(), { ws, key: "WEB", title: "Next" })).number).toBe(6);
	});

	it("is the lead's: a member may trash and restore, not purge", async () => {
		const { beta } = await setUp();
		await tasks.trashTask(as("member"), ws, beta.ref);
		expect(await code(tasks.purgeTask(as("member"), ws, beta.ref))).toBe("FORBIDDEN");
	});
});

describe("the project's feed and rev", () => {
	it("lists the latest entries first, with the task each is about", async () => {
		const { gamma, statuses } = await setUp();
		await tasks.moveTask(lead(), { ws, ref: gamma.ref, statusId: statuses.done.id, position: "a9" });
		const feed = await tasks.listProjectActivity(lead(), ws, "WEB");
		expect(feed[0]).toMatchObject({ kind: "task.moved", task: { ref: gamma.ref, title: "Gamma footer" } });
		expect(feed.at(-1)).toMatchObject({ kind: "project.created", task: null });
	});

	it("moves the rev with every change, and only then", async () => {
		const { alpha } = await setUp();
		const rev = async () => (await tasks.getProjectRev(lead(), ws, "WEB")).rev;
		const before = await rev();
		await tasks.patchTask(lead(), { ws, ref: alpha.ref, priority: 0 });
		expect(await rev()).toBe(before + 1);
		// Reading changes nothing; a patch that changes nothing doesn't either.
		await tasks.listTasks(lead(), ws, "WEB");
		await tasks.patchTask(lead(), { ws, ref: alpha.ref, priority: 0 });
		expect(await rev()).toBe(before + 1);
	});

	it("says how long closed tasks stay on the board: the project's days, else the workspace's", async () => {
		await setUp();
		expect((await tasks.listTasks(lead(), ws, "WEB")).doneColumnDays).toBe(14);
		const { version } = await projects.getProject(lead(), ws, "WEB");
		await projects.updateProject(lead(), { ws, key: "WEB", version, name: "Website", settings: { doneColumnDays: 3 } });
		expect((await tasks.listTasks(lead(), ws, "WEB")).doneColumnDays).toBe(3);
	});
});

describe("finding a project by id", () => {
	it("gives its workspace and key to whoever may see it, and NOT_FOUND to everyone else", async () => {
		const { board } = await setUp();
		expect(await projects.locateProject(as("member"), board.project.id)).toEqual({ ws: "team", key: "WEB" });
		expect(await code(projects.locateProject(as("guest"), board.project.id))).toBe("NOT_FOUND");
		expect(await code(projects.locateProject(lead(), crypto.randomUUID()))).toBe("NOT_FOUND");
		// A sandbox's project is its owner's only, under the `sandbox` segment.
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const sandbox = await tasks.listTasks(as("guest"), "sandbox", "WEB");
		expect(await projects.locateProject(as("guest"), sandbox.project.id)).toEqual({ ws: "sandbox", key: "WEB" });
		expect(await code(projects.locateProject(lead(), sandbox.project.id))).toBe("NOT_FOUND");
	});
});
