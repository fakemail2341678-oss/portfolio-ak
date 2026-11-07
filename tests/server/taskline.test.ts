import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProjectInput } from "@/features/taskline/schema";
import { isStaleError } from "@/lib/concurrency";
import { isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import { GUEST_DATA } from "@/server/guests/data";
import { claimGuest, seedGuest } from "@/server/guests/service";
import type { TasklineServices } from "@/server/taskline/access";
import * as projects from "@/server/taskline/projects/service";
import * as reports from "@/server/taskline/reports/service";
import { freeProjectKey, seedSandbox } from "@/server/taskline/sandbox";
import * as tasks from "@/server/taskline/tasks/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import * as workspaces from "@/server/taskline/workspace/service";
import { createTestDb } from "../utils/test-db";

/**
 * Taskline's core on PGlite (docs/guides/taskline.md): task numbers, status categories
 * and `completed_at`, the trash, subtasks, versions, quotas, activity, and the
 * sandbox's seed, claim and merge. Who may call what is tests/server/taskline-access.test.ts.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "account", name: "Anil Account", email: "account@example.com" },
			{ id: "guest", name: "Anonymous", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
			{ id: "guest-ne", name: "Anonymous", email: "guest-ne@anonymous.placeholder.invalid", isAnonymous: true },
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

const as = (id: string, permissions: string[] = []): TasklineServices => ({
	db: env.db,
	user: { id, isGuest: id.startsWith("guest"), permissions },
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

async function webProject() {
	await projects.createProject(lead(), { ws, key: "WEB", name: "Website" });
	const board = await tasks.listTasks(lead(), ws, "WEB");
	const byCategory = (category: string) => {
		const status = board.statuses.find((row) => row.category === category);
		if (!status) throw new Error(`no ${category} status`);
		return status;
	};
	return { board, byCategory };
}

describe("projects", () => {
	it("start with the default workflow, in order, and their creator as lead", async () => {
		const { board } = await webProject();
		expect(board.statuses.map((status) => [status.name, status.category])).toEqual([
			["Backlog", "backlog"],
			["To do", "unstarted"],
			["In progress", "started"],
			["Done", "completed"],
			["Canceled", "canceled"],
		]);
		expect(board.project).toMatchObject({ key: "WEB", role: "lead", can: { manage: true }, version: 1 });
		expect(await projects.listProjectMembers(lead(), ws, "WEB")).toEqual([
			expect.objectContaining({ name: "Lena Lead", role: "lead" }),
		]);
	});

	it("refuse a key that's taken or malformed", async () => {
		await webProject();
		const error = await projects.createProject(lead(), { ws, key: "WEB", name: "Again" }).catch((caught) => caught);
		expect(isAppError(error) && error.code).toBe("CONFLICT");
		expect(isAppError(error) && error.fieldErrors?.key).toHaveLength(1);
		// The schema refuses bad keys; the table refuses them too.
		expect(createProjectInput.safeParse({ ws, key: "1ab", name: "Digit first" }).success).toBe(false);
		expect(createProjectInput.parse({ ws, key: "web2", name: "Lowercase" }).key).toBe("WEB2");
		await expect(projects.createProject(lead(), { ws, key: "1AB", name: "Digit first" })).rejects.toThrow();
	});

	it("save the project form only from its version, and leave the version to single fields", async () => {
		await webProject();
		const first = await projects.getProject(lead(), ws, "WEB");
		await tasks.createTask(lead(), { ws, key: "WEB", title: "Bump rev" });
		const after = await projects.getProject(lead(), ws, "WEB");
		expect(after.rev).toBeGreaterThan(first.rev);
		expect(after.version).toBe(first.version);
		expect(after.updatedAt).toBe(first.updatedAt);
		const saved = await projects.updateProject(lead(), {
			ws,
			key: "WEB",
			version: first.version,
			name: "Website 2",
			description: "<p>New <script>alert(1)</script></p>",
			settings: { sprints: true },
		});
		expect(saved).toMatchObject({ name: "Website 2", version: 2, settings: { sprints: true, time: true } });
		expect(saved.description).not.toContain("script");
		const stale = await projects
			.updateProject(lead(), { ws, key: "WEB", version: first.version, name: "Lost" })
			.catch((caught) => caught);
		expect(isStaleError(stale)).toBe(true);
	});

	it("are read-only while archived, and out of the directory", async () => {
		await webProject();
		await projects.setProjectArchived(lead(), { ws, key: "WEB", archived: true });
		expect(await projects.listProjects(lead(), { ws })).toEqual([]);
		expect((await projects.listProjects(lead(), { ws, archived: true })).map((row) => row.key)).toEqual(["WEB"]);
		const archived = await projects.getProject(lead(), ws, "WEB");
		expect(archived.can).toMatchObject({ view: true, edit: false, manage: true });
		expect(await code(tasks.createTask(lead(), { ws, key: "WEB", title: "No" }))).toBe("FORBIDDEN");
		await projects.setProjectArchived(lead(), { ws, key: "WEB", archived: false });
		expect(await code(tasks.createTask(lead(), { ws, key: "WEB", title: "Yes" }))).toBe("ok");
	});
});

describe("tasks", () => {
	it("number themselves in order, even when created at the same time", async () => {
		await webProject();
		const created = await Promise.all(
			Array.from({ length: 20 }, (_, index) => tasks.createTask(lead(), { ws, key: "WEB", title: `Task ${index}` })),
		);
		expect(created.map((task) => task.number).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 20 }, (_, index) => index + 1),
		);
		expect(created.find((task) => task.number === 7)?.ref).toBe("WEB-7");
		expect((await projects.getProject(lead(), ws, "WEB")).openTasks).toBe(20);
	});

	it("set completed_at by their status's category", async () => {
		const { byCategory } = await webProject();
		const task = await tasks.createTask(lead(), { ws, key: "WEB", title: "Ship" });
		expect(task.statusId).toBe(byCategory("unstarted").id);
		expect(task.completedAt).toBeNull();
		const done = await tasks.moveTask(lead(), {
			ws,
			ref: task.ref,
			statusId: byCategory("completed").id,
			position: "a0",
		});
		expect(done.completedAt).not.toBeNull();
		// From one closed status to another, the time stays.
		const canceled = await tasks.moveTask(lead(), {
			ws,
			ref: task.ref,
			statusId: byCategory("canceled").id,
			position: "a0",
		});
		expect(canceled.completedAt).toBe(done.completedAt);
		const reopened = await tasks.moveTask(lead(), {
			ws,
			ref: task.ref,
			statusId: byCategory("started").id,
			position: "a0",
		});
		expect(reopened.completedAt).toBeNull();
		// A status that changes category closes (or reopens) the tasks in it.
		await workflow.updateStatus(lead(), { ws, key: "WEB", id: byCategory("started").id, category: "completed" });
		expect((await tasks.getTask(lead(), ws, task.ref)).completedAt).not.toBeNull();
		await workflow.updateStatus(lead(), { ws, key: "WEB", id: byCategory("completed").id, category: "started" });
		expect((await tasks.getTask(lead(), ws, task.ref)).completedAt).not.toBeNull();
	});

	it("move with their status when it's deleted, trashed ones too; the last status stays", async () => {
		const { byCategory } = await webProject();
		const backlog = byCategory("backlog").id;
		const todo = byCategory("unstarted");
		const one = await tasks.createTask(lead(), { ws, key: "WEB", title: "One", statusId: backlog });
		const two = await tasks.createTask(lead(), { ws, key: "WEB", title: "Two", statusId: backlog });
		const kept = await tasks.createTask(lead(), { ws, key: "WEB", title: "Kept", statusId: todo.id });
		await tasks.trashTask(lead(), ws, two.ref);
		const error = await workflow.deleteStatus(lead(), { ws, key: "WEB", id: backlog }).catch((caught) => caught);
		expect(isAppError(error) && error.fieldErrors?.moveTo).toHaveLength(1);
		await workflow.deleteStatus(lead(), { ws, key: "WEB", id: backlog, moveTo: todo.id });
		const board = await tasks.listTasks(lead(), ws, "WEB");
		expect(board.statuses).toHaveLength(4);
		expect(board.tasks.filter((task) => task.statusId === todo.id).map((task) => task.title)).toEqual(["Kept", "One"]);
		expect((await tasks.getTask(lead(), ws, two.ref)).statusId).toBe(todo.id);
		expect(board.tasks.find((task) => task.ref === one.ref)?.position).not.toBe(kept.position);
		for (const status of board.statuses.slice(1)) {
			await workflow.deleteStatus(lead(), { ws, key: "WEB", id: status.id, moveTo: board.statuses[0]?.id });
		}
		expect(await code(workflow.deleteStatus(lead(), { ws, key: "WEB", id: board.statuses[0]?.id ?? "" }))).toBe(
			"CONFLICT",
		);
	});

	it("go to the trash with their subtasks, and come back with the ones that went with them", async () => {
		await webProject();
		const parent = await tasks.createTask(lead(), { ws, key: "WEB", title: "Parent" });
		const child = await tasks.createTask(lead(), { ws, key: "WEB", title: "Child", parentId: parent.id });
		const earlier = await tasks.createTask(lead(), { ws, key: "WEB", title: "Earlier", parentId: parent.id });
		expect((await tasks.getTask(lead(), ws, parent.ref)).subtasks.map((task) => task.title)).toEqual([
			"Child",
			"Earlier",
		]);
		await tasks.trashTask(lead(), ws, earlier.ref);
		await new Promise((resolve) => setTimeout(resolve, 5));
		await tasks.trashTask(lead(), ws, parent.ref);
		expect((await tasks.listTasks(lead(), ws, "WEB")).tasks).toEqual([]);
		expect((await tasks.listTrash(lead(), ws, "WEB")).map((task) => task.title).sort()).toEqual([
			"Child",
			"Earlier",
			"Parent",
		]);
		expect(await code(tasks.patchTask(lead(), { ws, ref: child.ref, priority: 2 }))).toBe("CONFLICT");
		// A subtask restored alone, while its parent is in the trash, comes back on its own.
		const alone = await tasks.restoreTask(lead(), ws, earlier.ref);
		expect(alone.parentId).toBeNull();
		await tasks.restoreTask(lead(), ws, parent.ref);
		const board = await tasks.listTasks(lead(), ws, "WEB");
		expect(board.tasks.map((task) => [task.title, task.parentId]).sort()).toEqual([
			["Child", parent.id],
			["Earlier", null],
			["Parent", null],
		]);
	});

	it("nest three levels deep at most, and never under themselves", async () => {
		await webProject();
		const epic = await tasks.createTask(lead(), { ws, key: "WEB", title: "Epic", type: "epic" });
		const story = await tasks.createTask(lead(), { ws, key: "WEB", title: "Story", parentId: epic.id });
		const sub = await tasks.createTask(lead(), { ws, key: "WEB", title: "Sub", parentId: story.id });
		expect(await code(tasks.createTask(lead(), { ws, key: "WEB", title: "Too deep", parentId: sub.id }))).toBe(
			"CONFLICT",
		);
		expect(await code(tasks.patchTask(lead(), { ws, ref: epic.ref, parentId: sub.id }))).toBe("CONFLICT");
		const other = await tasks.createTask(lead(), { ws, key: "WEB", title: "Other" });
		// Moving the story (with its subtask) under another top-level task fits; under the subtask it doesn't.
		expect(await code(tasks.patchTask(lead(), { ws, ref: story.ref, parentId: other.id }))).toBe("ok");
		const loose = await tasks.createTask(lead(), { ws, key: "WEB", title: "Loose" });
		expect(await code(tasks.patchTask(lead(), { ws, ref: other.ref, parentId: loose.id }))).toBe("CONFLICT");
	});

	it("save the title and description from their version; other fields are last-write-wins", async () => {
		const { board, byCategory } = await webProject();
		const task = await tasks.createTask(lead(), { ws, key: "WEB", title: "Draft" });
		// A move and a patch don't make an open edit stale.
		await tasks.moveTask(lead(), { ws, ref: task.ref, statusId: byCategory("started").id, position: "a3" });
		await tasks.patchTask(lead(), { ws, ref: task.ref, priority: 4, dueOn: "2026-11-05" });
		const saved = await tasks.updateTask(as("member"), {
			ws,
			ref: task.ref,
			version: task.version,
			title: "Final",
			description: "<p>Done <b>right</b></p>",
		});
		expect(saved).toMatchObject({ title: "Final", priority: 4, dueOn: "2026-11-05", version: 2 });
		const stale = await tasks
			.updateTask(lead(), { ws, ref: task.ref, version: task.version, title: "Lost", description: "" })
			.catch((caught) => caught);
		expect(isStaleError(stale)).toBe(true);
		expect(board.members.map((member) => member.name)).toEqual(["Lena Lead", "Mohan Member"]);
	});

	it("record every change, by member, and make creators and assignees watchers", async () => {
		const { board } = await webProject();
		const mohan = board.members.find((member) => member.name === "Mohan Member")?.id ?? "";
		const task = await tasks.createTask(lead(), { ws, key: "WEB", title: "Watch" });
		await tasks.patchTask(lead(), { ws, ref: task.ref, assigneeId: mohan, priority: 2 });
		await tasks.patchTask(lead(), { ws, ref: task.ref, priority: 2 });
		await tasks.patchTask(as("admin-1", ["taskline:manage"]), { ws, ref: task.ref, priority: 1 });
		const detail = await tasks.getTask(lead(), ws, task.ref);
		// One entry per changed field (entries of one change share their time); an unchanged field writes none.
		expect(detail.activity.map((entry) => `${entry.kind} ${entry.data.field ?? ""}`).sort()).toEqual([
			"task.created ",
			"task.updated assigneeId",
			"task.updated priority",
			"task.updated priority",
		]);
		expect(detail.activity.at(-1)).toMatchObject({ actorId: null, data: { via: "admin", from: 2, to: 1 } });
		const watchers = await env.db
			.select({ memberId: schema.tlTaskWatcher.memberId })
			.from(schema.tlTaskWatcher)
			.where(eq(schema.tlTaskWatcher.taskId, task.id));
		expect(watchers.map((row) => row.memberId).sort()).toEqual([detail.reporterId, mohan].sort());
	});
});

describe("quotas", () => {
	it("hold under concurrent creates", async () => {
		await webProject();
		await env.db
			.update(schema.tlWorkspace)
			.set({ settings: { projectCreation: "members", quotas: { tasks: 3 } } })
			.where(eq(schema.tlWorkspace.kind, "team"));
		const outcomes = await Promise.all(
			Array.from({ length: 6 }, (_, index) => code(tasks.createTask(lead(), { ws, key: "WEB", title: `T${index}` }))),
		);
		expect(outcomes.filter((outcome) => outcome === "ok")).toHaveLength(3);
		expect(outcomes.filter((outcome) => outcome === "CONFLICT")).toHaveLength(3);
	});

	it("limit a sandbox to five projects", async () => {
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const outcomes = await Promise.all(
			["AA", "BB", "CC", "DD", "EE"].map((key) =>
				code(projects.createProject(as("guest"), { ws: "sandbox", key, name: key })),
			),
		);
		expect(outcomes.filter((outcome) => outcome === "ok")).toHaveLength(4);
	});
});

describe("the sandbox", () => {
	it("is seeded for a new guest, in their language, with three placeholder teammates", async () => {
		expect(GUEST_DATA.map((owner) => owner.slug)).toContain("taskline");
		await seedGuest(env.db, "guest", "en");
		await seedGuest(env.db, "guest-ne", "ne");
		const board = await tasks.listTasks(as("guest"), "sandbox", "WEB");
		expect(board.project).toMatchObject({ name: "Website relaunch", role: "lead", can: { manage: true } });
		expect(board.members.filter((member) => member.placeholder)).toHaveLength(3);
		expect(board.tasks).toHaveLength(10);
		expect(board.tasks.filter((task) => task.parentId !== null)).toHaveLength(2);
		expect(board.labels.map((label) => label.name)).toEqual(["Bug", "Content", "Design"]);
		const nepali = await tasks.listTasks(as("guest-ne"), "sandbox", "WEB");
		expect(nepali.project.name).toBe("वेबसाइट नयाँ रूपमा");
		expect(nepali.statuses[0]?.name).toBe("ब्याकलग");
		// The guest is named in their language (Task 58), and an account keeps its name.
		const ownerOf = (board: typeof nepali) => board.members.find((member) => !member.placeholder)?.name;
		expect(ownerOf(board)).toBe("Guest");
		expect(ownerOf(nepali)).toBe("अतिथि");
		// The two done tasks have a past, so the reports have cycle and lead times.
		const { cycle } = await reports.getProjectReports(as("guest"), { ws: "sandbox", key: "WEB", range: "4w" });
		expect(cycle.tasks.map((task) => [task.leadDays, task.cycleDays]).sort()).toEqual([
			[6, 2],
			[8, 1],
		]);
		// Seeding again (another app's retry, an account starting one) keeps what's there.
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		expect(await workspaces.listWorkspaces(as("guest"))).toHaveLength(1);
	});

	it("starts for an account on request, once", async () => {
		const first = await workspaces.startSandbox(as("account"));
		const again = await workspaces.startSandbox(as("account"));
		expect(again.id).toBe(first.id);
		expect((await tasks.listTasks(as("account"), "sandbox", "WEB")).tasks).toHaveLength(10);
		expect((await workspaces.getWorkspace(as("account"), "sandbox")).me?.name).toBe("Anil Account");
	});

	it("goes to the account a guest signs up with", async () => {
		await seedGuest(env.db, "guest", "en");
		const before = await tasks.listTasks(as("guest"), "sandbox", "WEB");
		expect(await claimGuest(env.db, "guest", "account")).toBe(true);
		const after = await tasks.listTasks(as("account"), "sandbox", "WEB");
		expect(after.project.id).toBe(before.project.id);
		expect(after.tasks).toHaveLength(10);
		const me = (await workspaces.getWorkspace(as("account"), "sandbox")).me;
		expect(me).toMatchObject({ id: before.members.find((member) => !member.placeholder)?.id, name: "Anil Account" });
	});

	it("merges into the account's own sandbox, renaming a taken key", async () => {
		await workspaces.startSandbox(as("account"));
		await seedGuest(env.db, "guest", "en");
		const guestBoard = await tasks.listTasks(as("guest"), "sandbox", "WEB");
		const guestMe = guestBoard.members.find((member) => !member.placeholder)?.id;
		const guestTask = guestBoard.tasks.find((task) => task.assigneeId === guestMe);
		expect(await claimGuest(env.db, "guest", "account")).toBe(true);
		expect((await projects.listProjects(as("account"), { ws: "sandbox" })).map((row) => row.key)).toEqual([
			"WEB",
			"WEB2",
		]);
		const merged = await tasks.listTasks(as("account"), "sandbox", "WEB2");
		const me = (await workspaces.getWorkspace(as("account"), "sandbox")).me;
		expect(merged.project.role).toBe("lead");
		expect(merged.tasks.find((task) => task.id === guestTask?.id)?.assigneeId).toBe(me?.id);
		expect(merged.members.filter((member) => member.placeholder)).toHaveLength(6);
		expect(await env.db.select().from(schema.tlWorkspace).where(eq(schema.tlWorkspace.kind, "sandbox"))).toHaveLength(
			1,
		);
		// The moved task is reachable by its new reference.
		expect((await tasks.getTask(as("account"), "sandbox", `WEB2-${guestTask?.number}`)).id).toBe(guestTask?.id);
	});

	it("goes with its owner, and a team account's history keeps its name", async () => {
		await seedGuest(env.db, "guest", "en");
		await webProject();
		await tasks.createTask(as("member"), { ws, key: "WEB", title: "Mine" });
		await env.db.delete(schema.user).where(eq(schema.user.id, "guest"));
		await env.db.delete(schema.user).where(eq(schema.user.id, "member"));
		expect(await env.db.select().from(schema.tlWorkspace).where(eq(schema.tlWorkspace.kind, "sandbox"))).toEqual([]);
		const [kept] = await env.db
			.select()
			.from(schema.tlMember)
			.where(and(eq(schema.tlMember.displayName, "Mohan Member")));
		expect(kept?.userId).toBeNull();
	});

	it("frees a taken key with a suffix, within six characters", () => {
		expect(freeProjectKey("WEB", new Set())).toBe("WEB");
		expect(freeProjectKey("WEB", new Set(["WEB", "WEB2"]))).toBe("WEB3");
		expect(freeProjectKey("ABCDEF", new Set(["ABCDEF"]))).toBe("ABCDE2");
	});
});
