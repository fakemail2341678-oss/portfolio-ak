import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskList } from "@/features/taskline/search";
import { MILESTONES_MAX } from "@/features/taskline/types";
import { FORM_ERROR_KEY, isAppError } from "@/lib/errors";
import { generateKeyBetween } from "@/lib/fractional-index";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as tasks from "@/server/taskline/tasks/service";
import * as timeline from "@/server/taskline/timeline/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Milestones and dependencies on PGlite (Task 54, decision 0219): milestones and their
 * tasks; dependencies within a project and across the workspace, never on itself or
 * in a loop (two opposite adds at once included), only between tasks the caller may
 * edit; "blocked" in summaries, the list's filter and the task's page (with what's out
 * of sight counted); the project's completion rule; the sandbox's seed and the claim.
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
const ws = "team";
const key = "WEB";
const today = () => todayInZone(APP_TIME_ZONE);

const failure = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return { code: "ok", message: "" };
	} catch (error) {
		if (isAppError(error)) {
			return { code: error.code, message: error.fieldErrors?.[FORM_ERROR_KEY]?.[0] ?? "", fields: error.fieldErrors };
		}
		throw error;
	}
};
const code = async (promise: Promise<unknown>) => (await failure(promise)).code;

/** The team (lead, member, viewer); WEB (team, the member on it), OPS (team) and SEC (private, the lead's). */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const members = await env.db.transaction((tx) =>
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
	await projects.createProject(as("lead"), { ws, key: "OPS", name: "Operations" });
	await projects.createProject(as("lead"), { ws, key: "SEC", name: "Security", visibility: "private" });
	const member = members.find((row) => row.userId === "member");
	if (!member) throw new Error("no member");
	await projects.setProjectMember(as("lead"), { ws, key, memberId: member.id, role: "member" });
}

const statusOf = async (category: string, projectKey = key) => {
	const board = await tasks.listTasks(as("lead"), ws, projectKey);
	const status = board.statuses.find((each) => each.category === category);
	if (!status) throw new Error(`no ${category} status`);
	return status.id;
};
const newTask = (title: string, projectKey = key, values: Partial<Parameters<typeof tasks.createTask>[1]> = {}) =>
	tasks.createTask(as("lead"), { ws, key: projectKey, title, ...values });
const blockedBy = (caller: string, ref: string, other: string) =>
	timeline.addDependency(as(caller), { ws, ref, relation: "blocked_by", other });
const move = (caller: string, ref: string, statusId: string) =>
	tasks.moveTask(as(caller), { ws, ref, statusId, position: "a5" });
const activityKinds = async (taskId: string) =>
	(await env.db.select().from(schema.tlActivity).where(eq(schema.tlActivity.taskId, taskId))).map((row) => [
		row.kind,
		row.data,
	]);

describe("milestones", () => {
	it("are added, ordered, changed, completed and deleted by editors, with history; tasks join one of their project's", async () => {
		await setUp();
		const beta = await timeline.createMilestone(as("member"), { ws, key, name: "Beta", dueOn: addDays(today(), 7) });
		const launch = await timeline.createMilestone(as("lead"), { ws, key, name: "Launch" });
		expect(await code(timeline.createMilestone(as("viewer"), { ws, key, name: "No" }))).toBe("FORBIDDEN");
		expect(await code(timeline.createMilestone(as("member"), { ws, key: "SEC", name: "No" }))).toBe("NOT_FOUND");
		expect(launch.position > beta.position).toBe(true);

		const task = await newTask("Build it", key, { milestoneId: beta.id });
		expect(task.milestoneId).toBe(beta.id);
		const patched = await tasks.patchTask(as("member"), { ws, ref: task.ref, milestoneId: launch.id });
		expect(patched.milestoneId).toBe(launch.id);
		expect(patched.activity.at(-1)?.data).toMatchObject({ field: "milestoneId", from: beta.id, to: launch.id });
		// Another project's milestone isn't this task's to join.
		const ops = await timeline.createMilestone(as("lead"), { ws, key: "OPS", name: "Elsewhere" });
		expect(await code(tasks.patchTask(as("lead"), { ws, ref: task.ref, milestoneId: ops.id }))).toBe("NOT_FOUND");
		expect(await code(timeline.updateMilestone(as("lead"), { ws, key, id: ops.id, name: "x" }))).toBe("NOT_FOUND");

		// Moved first: no history for the order; completing and renaming leave theirs.
		const reordered = await timeline.updateMilestone(as("member"), {
			ws,
			key,
			id: launch.id,
			position: generateKeyBetween(null, beta.position),
		});
		const board = await tasks.listTasks(as("lead"), ws, key);
		expect(board.milestones.map((milestone) => milestone.name)).toEqual(["Launch", "Beta"]);
		expect(reordered.completedAt).toBeNull();
		const done = await timeline.updateMilestone(as("member"), {
			ws,
			key,
			id: launch.id,
			completed: true,
			name: "Go live",
		});
		expect(done.completedAt).not.toBeNull();
		const again = await timeline.updateMilestone(as("member"), { ws, key, id: launch.id, completed: true });
		expect(again.completedAt).toBe(done.completedAt);
		await timeline.updateMilestone(as("member"), { ws, key, id: launch.id, completed: false });
		const feed = await tasks.listProjectActivity(as("lead"), ws, key);
		// Entries of one change share their time (the guide's pitfall): compared without order.
		expect(
			feed
				.filter((entry) => entry.kind.startsWith("milestone."))
				.map((entry) => entry.kind)
				.sort(),
		).toEqual([
			"milestone.completed",
			"milestone.created",
			"milestone.created",
			"milestone.reopened",
			"milestone.updated",
		]);

		// Deleting one leaves its tasks, without a milestone.
		await timeline.deleteMilestone(as("member"), ws, key, launch.id);
		expect((await tasks.getTask(as("lead"), ws, task.ref)).milestoneId).toBeNull();
		const page = await tasks.listTaskPage(as("lead"), {
			...taskList.defaults,
			pageSize: 20,
			ws,
			key,
			milestone: "none",
		});
		expect(page.items.map((each) => each.ref)).toEqual([task.ref]);
		const inBeta = await tasks.listTaskPage(as("lead"), {
			...taskList.defaults,
			pageSize: 20,
			ws,
			key,
			milestone: beta.id,
		});
		expect(inBeta.items).toEqual([]);
	});

	it("keeps at most fifty per project", async () => {
		await setUp();
		const board = await tasks.listTasks(as("lead"), ws, key);
		await env.db.insert(schema.tlMilestone).values(
			Array.from({ length: MILESTONES_MAX }, (_, index) => ({
				projectId: board.project.id,
				name: `M${index}`,
				position: `a${String(index).padStart(2, "0")}`,
			})),
		);
		expect(await code(timeline.createMilestone(as("lead"), { ws, key, name: "One more" }))).toBe("CONFLICT");
	});
});

describe("dependencies", () => {
	it("block a task until the blocker closes, in the summaries, the list's filter and both tasks' pages", async () => {
		await setUp();
		const design = await newTask("Design");
		const build = await newTask("Build");
		const rev = (await tasks.getProjectRev(as("lead"), ws, key)).rev;
		const detail = await blockedBy("member", build.ref, design.ref);
		expect(detail.dependencies.blockedBy.map((link) => link.ref)).toEqual([design.ref]);
		expect(detail.blocked).toBe(true);
		expect((await tasks.getTask(as("lead"), ws, design.ref)).dependencies.blocks.map((link) => link.ref)).toEqual([
			build.ref,
		]);
		expect((await tasks.getProjectRev(as("lead"), ws, key)).rev).toBeGreaterThan(rev);
		// Each side's history names the other.
		expect(await activityKinds(build.id)).toContainEqual([
			"dependency.added",
			{ relation: "blocked_by", ref: design.ref, title: "Design" },
		]);
		expect(await activityKinds(design.id)).toContainEqual([
			"dependency.added",
			{ relation: "blocks", ref: build.ref, title: "Build" },
		]);
		// Again changes nothing.
		await timeline.addDependency(as("lead"), { ws, ref: design.ref, relation: "blocks", other: build.ref });
		expect((await activityKinds(build.id)).filter(([kind]) => kind === "dependency.added")).toHaveLength(1);

		const board = await tasks.listTasks(as("lead"), ws, key);
		expect(board.dependencies).toEqual([{ blockerId: design.id, blockedId: build.id }]);
		expect(board.tasks.find((each) => each.id === build.id)?.blocked).toBe(true);
		const blockedPage = await tasks.listTaskPage(as("lead"), {
			...taskList.defaults,
			pageSize: 20,
			ws,
			key,
			blocked: "yes",
		});
		expect(blockedPage.items.map((each) => each.ref)).toEqual([build.ref]);
		const free = await tasks.listTaskPage(as("lead"), { ...taskList.defaults, pageSize: 20, ws, key, blocked: "no" });
		expect(free.items.map((each) => each.ref)).toEqual([design.ref]);

		// A blocker in the trash, or closed, blocks nothing.
		await tasks.trashTask(as("lead"), ws, design.ref);
		expect((await tasks.getTask(as("lead"), ws, build.ref)).blocked).toBe(false);
		expect((await tasks.getTask(as("lead"), ws, build.ref)).dependencies.blockedBy).toEqual([]);
		await tasks.restoreTask(as("lead"), ws, design.ref);
		await move("lead", design.ref, await statusOf("canceled"));
		const after = await tasks.getTask(as("lead"), ws, build.ref);
		expect(after.blocked).toBe(false);
		expect(after.dependencies.blockedBy[0]?.closed).toBe(true);

		// Removing it, from either side, leaves history; deleting a task for good takes its rows.
		await timeline.removeDependency(as("member"), { ws, ref: design.ref, relation: "blocks", other: build.ref });
		expect((await tasks.getTask(as("lead"), ws, build.ref)).dependencies.blockedBy).toEqual([]);
		expect((await activityKinds(build.id)).map(([kind]) => kind)).toContain("dependency.removed");
		await blockedBy("lead", build.ref, design.ref);
		await tasks.trashTask(as("lead"), ws, design.ref);
		await tasks.purgeTask(as("lead"), ws, design.ref);
		expect(await env.db.select().from(schema.tlTaskDependency)).toEqual([]);
	});

	it("refuses a task on itself, a loop (directly, through others, or two opposite adds at once), and too many", async () => {
		await setUp();
		const [a, b, c] = [await newTask("A"), await newTask("B"), await newTask("C")];
		const self = await failure(blockedBy("lead", a.ref, a.ref));
		expect(self.code).toBe("BAD_REQUEST");
		expect(self.fields?.other).toBeDefined();
		await blockedBy("lead", b.ref, a.ref);
		await blockedBy("lead", c.ref, b.ref);
		// a → b → c: c blocking a would close the loop, and so would b blocking a.
		const loop = await failure(blockedBy("lead", a.ref, c.ref));
		expect(loop.code).toBe("CONFLICT");
		expect(loop.fields?.other).toBeDefined();
		expect(await code(blockedBy("lead", a.ref, b.ref))).toBe("CONFLICT");

		const [x, y] = [await newTask("X"), await newTask("Y")];
		const outcomes = await Promise.all([
			code(blockedBy("lead", x.ref, y.ref)),
			code(blockedBy("member", y.ref, x.ref)),
		]);
		expect(outcomes.sort()).toEqual(["CONFLICT", "ok"]);
		const pair = await env.db
			.select()
			.from(schema.tlTaskDependency)
			.where(inArray(schema.tlTaskDependency.blockerId, [x.id, y.id]));
		expect(pair).toHaveLength(1);

		// Fifty on a side at most.
		const others = await Promise.all(Array.from({ length: 50 }, (_, index) => newTask(`Blocker ${index}`)));
		await env.db
			.insert(schema.tlTaskDependency)
			.values(others.map((other) => ({ blockerId: other.id, blockedId: c.id })));
		expect(await code(blockedBy("lead", c.ref, x.ref))).toBe("CONFLICT");
	});

	it("crosses projects of the workspace, for whoever may edit both, and counts what the caller can't see", async () => {
		await setUp();
		const web = await newTask("Launch page");
		const ops = await newTask("Switch the DNS", "OPS");
		const secret = await newTask("Pen test", "SEC");
		// The member edits WEB and OPS (team-visible) but can't see SEC; the viewer edits nothing.
		const detail = await blockedBy("member", web.ref, ops.ref);
		expect(detail.dependencies.blockedBy[0]).toMatchObject({
			ref: ops.ref,
			elsewhere: true,
			projectName: "Operations",
		});
		expect(await code(blockedBy("member", web.ref, secret.ref))).toBe("NOT_FOUND");
		expect(await code(blockedBy("viewer", web.ref, ops.ref))).toBe("FORBIDDEN");
		const opsRev = (await tasks.getProjectRev(as("lead"), ws, "OPS")).rev;
		// The lead may: the member then sees one blocker they can't name.
		await blockedBy("lead", web.ref, secret.ref);
		expect((await tasks.getProjectRev(as("lead"), ws, "OPS")).rev).toBe(opsRev);
		const seen = await tasks.getTask(as("member"), ws, web.ref);
		expect(seen.dependencies.blockedBy.map((link) => link.ref)).toEqual([ops.ref]);
		expect(seen.dependencies.hidden).toBe(1);
		expect((await tasks.getTask(as("lead"), ws, web.ref)).dependencies.hidden).toBe(0);
		// The timeline's arrows are this project's alone.
		expect((await tasks.listTasks(as("lead"), ws, key)).dependencies).toEqual([]);
		expect((await activityKinds(secret.id)).map(([kind]) => kind)).toContain("dependency.added");
		// Another workspace's task isn't found (a sandbox's own refs are its own).
		expect(
			await code(
				timeline.addDependency(as("lead"), { ws: "sandbox", ref: web.ref, relation: "blocks", other: ops.ref }),
			),
		).toBe("NOT_FOUND");
	});
});

describe("the project's completion rule", () => {
	it("refuses completing a blocked task when the project says so, never canceling it", async () => {
		await setUp();
		const design = await newTask("Design");
		const build = await newTask("Build");
		const other = await newTask("Other", "OPS");
		await blockedBy("lead", build.ref, design.ref);
		await blockedBy("lead", build.ref, other.ref);
		const done = await statusOf("completed");
		// Off by default.
		expect(await code(move("member", build.ref, done))).toBe("ok");
		await move("member", build.ref, await statusOf("started"));

		const project = await projects.getProject(as("lead"), ws, key);
		await projects.updateProject(as("lead"), {
			ws,
			key,
			version: project.version,
			name: project.name,
			settings: { blockCompletionWhileBlocked: true },
		});
		expect((await tasks.getTask(as("lead"), ws, build.ref)).dependencies.blockCompletion).toBe(true);
		const refused = await failure(move("member", build.ref, done));
		expect(refused.code).toBe("CONFLICT");
		expect(refused.message).toContain(design.ref);
		expect(refused.message).toContain(other.ref);
		expect(await code(tasks.bulkUpdate(as("lead"), { ws, key, ids: [design.id, build.id], statusId: done }))).toBe(
			"CONFLICT",
		);
		// Nothing moved in the bulk change.
		expect((await tasks.getTask(as("lead"), ws, design.ref)).completedAt).toBeNull();
		expect(await code(move("member", build.ref, await statusOf("canceled")))).toBe("ok");
		await move("member", build.ref, await statusOf("started"));

		// Once its blockers are done, it completes.
		await move("lead", design.ref, done);
		await move("lead", other.ref, await statusOf("completed", "OPS"));
		expect(await code(move("member", build.ref, done))).toBe("ok");
		const rows = await env.db
			.select({ completedAt: schema.tlTask.completedAt })
			.from(schema.tlTask)
			.where(and(eq(schema.tlTask.id, build.id)));
		expect(rows[0]?.completedAt).not.toBeNull();
	});
});

describe("the sandbox", () => {
	it("seeds milestones, dates and dependencies in the guest's language, and the claim keeps them", async () => {
		await env.reset();
		await workspaceRepo.ensureTeamWorkspace(env.db);
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const board = await tasks.listTasks(as("guest"), "sandbox", key);
		expect(board.milestones.map((milestone) => [milestone.name, milestone.completedAt !== null])).toEqual([
			["डिजाइन स्वीकृत", true],
			["लन्च", false],
		]);
		expect(board.dependencies).toHaveLength(4);
		expect(board.tasks.filter((task) => task.startOn !== null)).toHaveLength(7);
		expect(board.tasks.filter((task) => task.milestoneId !== null)).toHaveLength(6);
		expect(board.tasks.filter((task) => task.blocked).map((task) => task.number)).toEqual(
			expect.arrayContaining([5, 7]),
		);

		// An account with a sandbox of its own takes WEB in as WEB2, its milestones and dependencies with it.
		await env.db.transaction((tx) => seedSandbox(tx, "account", "en"));
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const claimed = await tasks.listTasks(as("account"), "sandbox", "WEB2");
		expect(claimed.milestones.map((milestone) => milestone.id)).toEqual(
			board.milestones.map((milestone) => milestone.id),
		);
		expect(claimed.dependencies).toEqual(board.dependencies);
		expect((await tasks.listTasks(as("account"), "sandbox", key)).milestones.map((each) => each.name)).toEqual([
			"Design signed off",
			"Launch",
		]);
	});
});
