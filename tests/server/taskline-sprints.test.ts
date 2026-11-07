import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskList } from "@/features/taskline/search";
import { isAppError } from "@/lib/errors";
import { generateKeyBetween, isOrderKey } from "@/lib/fractional-index";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import { sprintSnapshots } from "@/server/taskline/cron";
import { listMyTasks } from "@/server/taskline/home/service";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as sprintRepo from "@/server/taskline/sprints/repository";
import * as sprints from "@/server/taskline/sprints/service";
import * as tasks from "@/server/taskline/tasks/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Sprints and the backlog on PGlite (Task 52, decision 0216): one active sprint per
 * project, completion with its carry-over and stored numbers, the daily snapshots
 * (twice changes nothing), ranks and sprints on tasks, the list's sprint filter, the
 * velocity, notifications, the sandbox's sprints and the claim, and the migration's ranks.
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

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

/** The team (lead, member, viewer), WEB with the member on it, and OPS (another project). */
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
	const member = members.find((row) => row.userId === "member");
	if (!member) throw new Error("no member");
	await projects.setProjectMember(as("lead"), { ws, key, memberId: member.id, role: "member" });
	return { member };
}

const plan = (name: string, startOn = today(), endOn = addDays(today(), 13)) =>
	sprints.createSprint(as("lead"), { ws, key, name, startOn, endOn });

const statusOf = async (category: string) => {
	const board = await tasks.listTasks(as("lead"), ws, key);
	const status = board.statuses.find((each) => each.category === category);
	if (!status) throw new Error(`no ${category} status`);
	return status.id;
};

describe("planning and starting", () => {
	it("starts one sprint at a time, from today at the latest, and stores what it commits to", async () => {
		await setUp();
		const first = await plan("Sprint 1", addDays(today(), 3), addDays(today(), 16));
		const second = await plan("Sprint 2");
		const a = await tasks.createTask(as("lead"), { ws, key, title: "A", sprintId: first.id, points: 3 });
		await tasks.createTask(as("lead"), { ws, key, title: "B", sprintId: first.id, points: 5 });
		await tasks.createTask(as("lead"), { ws, key, title: "C", sprintId: first.id });
		const canceled = await statusOf("canceled");
		await tasks.moveTask(as("lead"), { ws, ref: a.ref, statusId: canceled, position: "a5" });
		await tasks.createTask(as("lead"), { ws, key, title: "D", sprintId: first.id, points: 2 });

		const started = await sprints.startSprint(as("member"), ws, key, first.id);
		expect(started.state).toBe("active");
		// Planned to start in three days: it starts today.
		expect(started.startOn).toBe(today());
		// The canceled task is out of the scope; the unestimated one counts as a task.
		expect(started.committed).toEqual({ points: 7, tasks: 3, minutes: 0 });
		const days = await sprintRepo.snapshotsOf(env.db, first.id);
		expect(days).toEqual([
			{
				day: addDays(today(), -1),
				scopePoints: 7,
				donePoints: 0,
				scopeTasks: 3,
				doneTasks: 0,
				scopeMinutes: 0,
				doneMinutes: 0,
			},
		]);

		expect(await code(sprints.startSprint(as("lead"), ws, key, second.id))).toBe("CONFLICT");
		expect(await code(sprints.startSprint(as("lead"), ws, key, first.id))).toBe("CONFLICT");
		// Another project starts its own.
		const ops = await sprints.createSprint(as("lead"), {
			ws,
			key: "OPS",
			name: "Ops 1",
			startOn: today(),
			endOn: today(),
		});
		expect((await sprints.startSprint(as("lead"), ws, "OPS", ops.id)).state).toBe("active");
	});

	it("refuses readers, bad dates and a sprint of another project", async () => {
		await setUp();
		expect(
			await code(sprints.createSprint(as("viewer"), { ws, key, name: "X", startOn: today(), endOn: today() })),
		).toBe("FORBIDDEN");
		const sprint = await plan("Sprint 1");
		expect(await code(sprints.updateSprint(as("lead"), { ws, key, id: sprint.id, endOn: addDays(today(), -1) }))).toBe(
			"BAD_REQUEST",
		);
		expect(await code(sprints.startSprint(as("lead"), ws, "OPS", sprint.id))).toBe("NOT_FOUND");
		expect(await code(sprints.getSprintReport(as("lead"), ws, "OPS", sprint.id))).toBe("NOT_FOUND");
		const task = await tasks.createTask(as("lead"), { ws, key: "OPS", title: "Elsewhere" });
		expect(await code(sprints.rankTask(as("lead"), { ws, ref: task.ref, sprintId: sprint.id, rank: "a0" }))).toBe(
			"NOT_FOUND",
		);
	});

	it("tells the project's members when a sprint starts and completes, never the actor", async () => {
		const { member } = await setUp();
		const sprint = await plan("Sprint 1");
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		await sprints.completeSprint(as("lead"), { ws, key, id: sprint.id, carryTo: "backlog" });
		const rows = (await env.db.select().from(schema.tlNotification).orderBy(schema.tlNotification.createdAt)).filter(
			(row) => row.kind === "sprint",
		);
		expect(rows.map((row) => [row.userId, row.kind, row.data.sprintEvent])).toEqual([
			["member", "sprint", "started"],
			["member", "sprint", "completed"],
		]);
		expect(rows[0]?.data).toMatchObject({ sprint: "Sprint 1", project: "Website", actor: "Lena Lead" });
		expect(rows.every((row) => row.email === "digest" && row.taskId === null)).toBe(true);
		expect(member.id).toBeTruthy();
	});
});

describe("completing", () => {
	async function activeWithWork() {
		await setUp();
		const sprint = await plan("Sprint 1");
		const done = await tasks.createTask(as("lead"), { ws, key, title: "Done", sprintId: sprint.id, points: 5 });
		const open = await tasks.createTask(as("lead"), { ws, key, title: "Open", sprintId: sprint.id, points: 3 });
		const trashed = await tasks.createTask(as("lead"), { ws, key, title: "Trashed", sprintId: sprint.id, points: 8 });
		await tasks.trashTask(as("lead"), ws, trashed.ref);
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		await tasks.moveTask(as("lead"), { ws, ref: done.ref, statusId: await statusOf("completed"), position: "a5" });
		return { sprint, done, open, trashed };
	}

	const sprintOf = async (ref: string) => (await tasks.getTask(as("lead"), ws, ref)).sprintId;

	it("stores the done work and carries the unfinished tasks to the next planned sprint", async () => {
		const { sprint, done, open, trashed } = await activeWithWork();
		const next = await plan("Sprint 2", addDays(today(), 14), addDays(today(), 27));
		const completed = await sprints.completeSprint(as("member"), {
			ws,
			key,
			id: sprint.id,
			carryTo: "next",
			nextId: next.id,
		});
		expect(completed.state).toBe("completed");
		expect(completed.committed).toEqual({ points: 8, tasks: 2, minutes: 0 });
		expect(completed.completed).toEqual({ points: 5, tasks: 1, minutes: 0 });
		expect(await sprintOf(done.ref)).toBe(sprint.id);
		expect(await sprintOf(open.ref)).toBe(next.id);
		// The trash stays where it was.
		const [trashedRow] = await env.db.select().from(schema.tlTask).where(eq(schema.tlTask.id, trashed.id));
		expect(trashedRow?.sprintId).toBe(sprint.id);
		// Its last day is today's close, before the move.
		const days = await sprintRepo.snapshotsOf(env.db, sprint.id);
		expect(days.at(-1)).toEqual({
			day: today(),
			scopePoints: 8,
			donePoints: 5,
			scopeTasks: 2,
			doneTasks: 1,
			scopeMinutes: 0,
			doneMinutes: 0,
		});
		// A completed sprint is done with: no second completion, no edits, nothing moves in.
		expect(await code(sprints.completeSprint(as("lead"), { ws, key, id: sprint.id, carryTo: "backlog" }))).toBe(
			"CONFLICT",
		);
		expect(await code(sprints.updateSprint(as("lead"), { ws, key, id: sprint.id, name: "Renamed" }))).toBe("CONFLICT");
		expect(await code(sprints.rankTask(as("lead"), { ws, ref: open.ref, sprintId: sprint.id, rank: "a0" }))).toBe(
			"CONFLICT",
		);
		expect(await code(tasks.patchTask(as("lead"), { ws, ref: open.ref, sprintId: sprint.id }))).toBe("CONFLICT");
		// The velocity is the completed sprint's.
		const board = await tasks.listTasks(as("lead"), ws, key);
		expect(board.velocity).toEqual({ points: 5, tasks: 1, minutes: 0, sprints: 1 });
		expect(board.sprints.map((each) => each.name)).toEqual(["Sprint 2"]);
		expect(board.sprintCount).toBe(2);
	});

	it("carries to a new sprint starting tomorrow, as long as this one, or to the backlog", async () => {
		const { sprint, open } = await activeWithWork();
		await sprints.completeSprint(as("lead"), { ws, key, id: sprint.id, carryTo: "new" });
		const board = await tasks.listTasks(as("lead"), ws, key);
		const created = board.sprints[0];
		expect(created).toMatchObject({ name: "Sprint 2", state: "planned", startOn: addDays(today(), 1) });
		expect(created?.endOn).toBe(addDays(today(), 14));
		expect(await sprintOf(open.ref)).toBe(created?.id);

		const again = await activeWithWork();
		await sprints.completeSprint(as("lead"), { ws, key, id: again.sprint.id, carryTo: "backlog" });
		expect(await sprintOf(again.open.ref)).toBeNull();
		expect(
			await code(
				sprints.completeSprint(as("lead"), { ws, key, id: again.sprint.id, carryTo: "next", nextId: again.sprint.id }),
			),
		).toBe("CONFLICT");
	});

	it("deletes a planned sprint (its tasks go back to the backlog), never an active one", async () => {
		await setUp();
		const planned = await plan("Sprint 1");
		const task = await tasks.createTask(as("lead"), { ws, key, title: "In it", sprintId: planned.id });
		await sprints.deleteSprint(as("lead"), ws, key, planned.id);
		expect((await tasks.getTask(as("lead"), ws, task.ref)).sprintId).toBeNull();
		const active = await plan("Sprint 2");
		await sprints.startSprint(as("lead"), ws, key, active.id);
		expect(await code(sprints.deleteSprint(as("lead"), ws, key, active.id))).toBe("CONFLICT");
		const feed = await tasks.listProjectActivity(as("lead"), ws, key);
		expect(feed.map((entry) => entry.kind).filter((kind) => kind.startsWith("sprint."))).toEqual([
			"sprint.started",
			"sprint.created",
			"sprint.deleted",
			"sprint.created",
		]);
	});
});

describe("snapshots", () => {
	it("writes yesterday's close of each active sprint once: a second run changes nothing", async () => {
		await setUp();
		const sprint = await plan("Sprint 1", addDays(today(), -3), addDays(today(), 10));
		const task = await tasks.createTask(as("lead"), { ws, key, title: "A", sprintId: sprint.id, points: 4 });
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		// Planned (not started) and future sprints get none.
		await plan("Sprint 2", addDays(today(), 11), addDays(today(), 20));

		expect(await sprintSnapshots(env.db)).toEqual({ snapshots: 1 });
		await tasks.moveTask(as("lead"), { ws, ref: task.ref, statusId: await statusOf("completed"), position: "a5" });
		expect(await sprintSnapshots(env.db)).toEqual({ snapshots: 0 });
		const days = await sprintRepo.snapshotsOf(env.db, sprint.id);
		expect(days).toEqual([
			{
				day: addDays(today(), -4),
				scopePoints: 4,
				donePoints: 0,
				scopeTasks: 1,
				doneTasks: 0,
				scopeMinutes: 0,
				doneMinutes: 0,
			},
			{
				day: addDays(today(), -1),
				scopePoints: 4,
				donePoints: 0,
				scopeTasks: 1,
				doneTasks: 0,
				scopeMinutes: 0,
				doneMinutes: 0,
			},
		]);
		// The report's live totals see the move.
		const report = await sprints.getSprintReport(as("viewer"), ws, key, sprint.id);
		expect(report.live).toEqual({
			scopePoints: 4,
			donePoints: 4,
			scopeTasks: 1,
			doneTasks: 1,
			scopeMinutes: 0,
			doneMinutes: 0,
		});
		expect(report.days).toHaveLength(2);
		// Tomorrow's run writes today.
		expect(await sprintSnapshots(env.db, new Date(Date.now() + 86_400_000))).toEqual({ snapshots: 1 });
	});

	it("skips archived projects and sprints that start today", async () => {
		await setUp();
		const sprint = await plan("Sprint 1");
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		expect(await sprintSnapshots(env.db)).toEqual({ snapshots: 0 });
		await projects.setProjectArchived(as("lead"), { ws, key, archived: true });
		expect(await sprintSnapshots(env.db, new Date(Date.now() + 86_400_000))).toEqual({ snapshots: 0 });
	});
});

describe("tasks in sprints", () => {
	it("ranks tasks across the project, records a sprint change, and patches points", async () => {
		await setUp();
		const sprint = await plan("Sprint 1");
		const a = await tasks.createTask(as("lead"), { ws, key, title: "A" });
		const b = await tasks.createTask(as("lead"), { ws, key, title: "B" });
		expect(isOrderKey(a.rank) && isOrderKey(b.rank) && a.rank < b.rank).toBe(true);
		const rank = generateKeyBetween(null, a.rank);
		const moved = await sprints.rankTask(as("member"), { ws, ref: b.ref, sprintId: sprint.id, rank });
		expect(moved).toMatchObject({ sprintId: sprint.id, rank });
		// Reordering in place leaves no entry.
		await sprints.rankTask(as("member"), { ws, ref: b.ref, sprintId: sprint.id, rank: generateKeyBetween(null, rank) });
		const history = (await tasks.getTask(as("lead"), ws, b.ref)).activity.filter(
			(entry) => entry.data.field === "sprintId",
		);
		expect(history.map((entry) => entry.data.to)).toEqual([sprint.id]);
		expect(await code(sprints.rankTask(as("viewer"), { ws, ref: b.ref, sprintId: null, rank }))).toBe("FORBIDDEN");

		const estimated = await tasks.patchTask(as("lead"), { ws, ref: a.ref, points: 8, sprintId: sprint.id });
		expect(estimated).toMatchObject({ points: 8, sprintId: sprint.id });
		const fields = estimated.activity.filter((entry) => entry.kind === "task.updated").map((entry) => entry.data.field);
		expect(fields.sort()).toEqual(["points", "sprintId"]);
	});

	it("filters the list by the active sprint, the backlog and one sprint", async () => {
		await setUp();
		const active = await plan("Sprint 1");
		const planned = await plan("Sprint 2");
		await tasks.createTask(as("lead"), { ws, key, title: "In active", sprintId: active.id });
		await tasks.createTask(as("lead"), { ws, key, title: "In planned", sprintId: planned.id });
		await tasks.createTask(as("lead"), { ws, key, title: "Backlog" });
		const titles = async (sprint: string) =>
			(
				await tasks.listTaskPage(as("lead"), { ...taskList.defaults, pageSize: 20, sprint, ws, key, sort: "number" })
			).items.map((task) => task.title);
		// No active sprint yet: nothing is in it.
		expect(await titles("active")).toEqual([]);
		await sprints.startSprint(as("lead"), ws, key, active.id);
		expect(await titles("active")).toEqual(["In active"]);
		expect(await titles("none")).toEqual(["Backlog"]);
		expect(await titles(planned.id)).toEqual(["In planned"]);
		expect(await titles("all")).toHaveLength(3);
	});

	it("shows active sprints on Home with their totals", async () => {
		await setUp();
		const sprint = await plan("Sprint 1");
		await tasks.createTask(as("lead"), { ws, key, title: "A", sprintId: sprint.id, points: 2 });
		await sprints.startSprint(as("lead"), ws, key, sprint.id);
		const home = await listMyTasks(as("viewer"));
		expect(home.sprints).toEqual([
			expect.objectContaining({
				name: "Sprint 1",
				totals: { scopePoints: 2, donePoints: 0, scopeTasks: 1, doneTasks: 0, scopeMinutes: 0, doneMinutes: 0 },
				estimation: "points",
				project: expect.objectContaining({ key, ws }),
			}),
		]);
		expect((await listMyTasks(as("account"))).sprints).toEqual([]);
	});

	it("puts a status's tasks back when a status with sprint tasks is deleted", async () => {
		await setUp();
		const sprint = await plan("Sprint 1");
		const board = await tasks.listTasks(as("lead"), ws, key);
		const backlog = board.statuses.find((status) => status.category === "backlog");
		const todo = board.statuses.find((status) => status.category === "unstarted");
		if (!backlog || !todo) throw new Error("no statuses");
		const task = await tasks.createTask(as("lead"), { ws, key, title: "A", sprintId: sprint.id, statusId: backlog.id });
		await workflow.deleteStatus(as("lead"), { ws, key, id: backlog.id, moveTo: todo.id });
		expect((await tasks.getTask(as("lead"), ws, task.ref)).sprintId).toBe(sprint.id);
	});
});

describe("the sandbox", () => {
	it("seeds a completed, an active and a planned sprint with days, in both languages", async () => {
		await env.reset();
		await workspaceRepo.ensureTeamWorkspace(env.db);
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const guest: TasklineServices = as("guest");
		const board = await tasks.listTasks(guest, "sandbox", key);
		expect(board.project.settings.sprints).toBe(true);
		expect(board.sprints.map((sprint) => [sprint.name, sprint.state])).toEqual([
			["स्प्रिन्ट २", "active"],
			["स्प्रिन्ट ३", "planned"],
		]);
		expect(board.velocity).toEqual({ points: 8, tasks: 1, minutes: 0, sprints: 1 });
		const active = board.sprints[0];
		if (!active) throw new Error("no active sprint");
		const report = await sprints.getSprintReport(guest, "sandbox", key, active.id);
		expect(report.days.length).toBe(9);
		expect(report.live).toEqual({
			scopePoints: 13,
			donePoints: 2,
			scopeTasks: 4,
			doneTasks: 1,
			scopeMinutes: 1500,
			doneMinutes: 180,
		});
		expect(report.sprints).toHaveLength(3);
		expect(board.tasks.filter((task) => task.sprintId === null).map((task) => task.points)).toEqual(
			expect.arrayContaining([1, 2, 5, null]),
		);

		// The claim takes the sprints with the project.
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const claimed = await tasks.listTasks(as("account"), "sandbox", key);
		expect(claimed.sprints.map((sprint) => sprint.id)).toEqual(board.sprints.map((sprint) => sprint.id));
	});
});

describe("the migration's ranks", () => {
	it("are order keys in number order", async () => {
		const expression = (n: number) =>
			sql`select 'c' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ((${n}::bigint / 3844) % 62)::int + 1, 1) || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ((${n}::bigint / 62) % 62)::int + 1, 1) || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (${n}::bigint % 62)::int + 1, 1) as rank`;
		const ranks: string[] = [];
		for (const n of [0, 1, 9, 10, 61, 62, 3843, 3844, 238_327]) {
			const result = (await env.db.execute(expression(n))) as unknown as { rows: Array<{ rank: string }> };
			ranks.push(String(result.rows[0]?.rank));
		}
		expect(ranks.every(isOrderKey)).toBe(true);
		expect([...ranks].sort()).toEqual(ranks);
		expect(new Set(ranks).size).toBe(ranks.length);
		// A new task after the last of them gets a key past it.
		expect(generateKeyBetween(ranks.at(-1) ?? null, null) > (ranks.at(-1) ?? "")).toBe(true);
		const rows = await env.db.select({ rank: schema.tlTask.rank }).from(schema.tlTask).where(and(sql`true`));
		expect(rows.every((row) => isOrderKey(row.rank))).toBe(true);
	});
});
