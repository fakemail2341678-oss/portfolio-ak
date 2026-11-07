import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/features/rbac/types";
import { adminTimeList } from "@/features/taskline/admin/search";
import { isAppError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as adminTime from "@/server/taskline/admin/time";
import { stopForgottenTimers } from "@/server/taskline/cron";
import { getNav } from "@/server/taskline/home/service";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as sprints from "@/server/taskline/sprints/service";
import * as tasks from "@/server/taskline/tasks/service";
import * as time from "@/server/taskline/time/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Time tracking on PGlite (Task 53, decision 0218): one running timer per person, the
 * 12-hour cap and the daily job's stop, time by hand, the lock date and future days,
 * whose time is whose (`taskline:time`), the timesheet's cells and its copy of last
 * week, a project's estimate against actual, the admin's timesheets, sprints counting
 * estimated minutes, the quota, and the sandbox's time with its claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "timer", name: "Tara Time", email: "time@example.com" },
			{ id: "account", name: "Arun Account", email: "account@example.com" },
			{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string, permissions: string[] = []): TasklineServices => ({
	db: env.db,
	user: { id, isGuest: id === "guest", permissions },
});
const admin = (): { db: typeof env.db; actor: Actor; imageStore: null } => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: ["taskline:read", "taskline:time"] },
	imageStore: null,
});
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

/** The team (lead, member, viewer, and Tara who holds `taskline:time`), WEB with the member on it, and OPS. */
async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const members = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead" },
			{ workspaceId: team.id, userId: "member", displayName: "Mohan Member" },
			{ workspaceId: team.id, userId: "viewer", displayName: "Vera Viewer", role: "viewer" },
			{ workspaceId: team.id, userId: "timer", displayName: "Tara Time" },
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
	// 30 hours a week (the admin sets it).
	await env.db.update(schema.tlMember).set({ capacityMinutesWeek: 1800 }).where(eq(schema.tlMember.id, member.id));
	await projects.setProjectMember(as("lead"), { ws, key, memberId: member.id, role: "member" });
	const a = await tasks.createTask(as("lead"), { ws, key, title: "A", assigneeId: member.id, estimateMinutes: 240 });
	const b = await tasks.createTask(as("lead"), { ws, key, title: "B", estimateMinutes: 60 });
	return { team, member, a, b };
}

const setSettings = async (settings: Record<string, unknown>) =>
	env.db.update(schema.tlWorkspace).set({ settings }).where(eq(schema.tlWorkspace.kind, "team"));

/** Moves a running timer's start back, as if it had run that long. */
const runFor = (minutes: number) =>
	env.db.execute(
		sql`update tl_time_entry set started_at = now() - make_interval(mins => ${minutes}) where ended_at is null and started_at is not null`,
	);

const entries = () => env.db.select().from(schema.tlTimeEntry);

describe("the timer", () => {
	it("runs one per person: starting another stops the first and logs it; the topbar shows the running one", async () => {
		const { a, b } = await setUp();
		const first = await time.startTimer(as("member"), ws, a.ref);
		expect(first).toMatchObject({ ref: a.ref, ws: "team" });
		await runFor(90);
		const second = await time.startTimer(as("member"), ws, b.ref);
		expect(second.ref).toBe(b.ref);
		const rows = await entries();
		expect(rows.find((row) => row.taskId === a.id)).toMatchObject({ minutes: 90 });
		expect(rows.filter((row) => row.endedAt === null)).toHaveLength(1);
		expect((await getNav(as("member"))).timer?.ref).toBe(b.ref);
		// The history says who logged it.
		const detail = await tasks.getTask(as("member"), ws, a.ref);
		expect(detail.activity.some((entry) => entry.kind === "time.logged" && entry.data.minutes === 90)).toBe(true);
		expect(detail.time).toMatchObject({ loggedMinutes: 90, canLog: true });
	});

	it("stamps the start on the server, drops a timer stopped under a minute, and counts 12 hours at most", async () => {
		const { a } = await setUp();
		await time.startTimer(as("member"), ws, a.ref);
		expect(await time.stopTimer(as("member"))).toBeNull();
		expect(await entries()).toHaveLength(0);
		await time.startTimer(as("member"), ws, a.ref);
		await runFor(20 * 60);
		expect(await time.stopTimer(as("member"))).toEqual({ minutes: 720 });
		expect(await time.stopTimer(as("member"))).toBeNull();
	});

	it("lets two starts at once leave one timer running", async () => {
		const { a, b } = await setUp();
		const results = await Promise.all([
			code(time.startTimer(as("member"), ws, a.ref)),
			code(time.startTimer(as("member"), ws, b.ref)),
		]);
		expect(results.filter((result) => result === "ok").length).toBeGreaterThanOrEqual(1);
		expect((await entries()).filter((row) => row.endedAt === null)).toHaveLength(1);
	});

	it("is stopped by the daily job after 12 hours, telling its owner once", async () => {
		const { a } = await setUp();
		await time.startTimer(as("member"), ws, a.ref);
		await runFor(13 * 60);
		expect(await stopForgottenTimers(env.db)).toEqual({ stopped: 1 });
		expect(await stopForgottenTimers(env.db)).toEqual({ stopped: 0 });
		const [row] = await entries();
		expect(row).toMatchObject({ minutes: 720 });
		const told = await env.db.select().from(schema.tlNotification).where(eq(schema.tlNotification.kind, "timer"));
		expect(told).toHaveLength(1);
		expect(told[0]).toMatchObject({ userId: "member", data: expect.objectContaining({ ref: a.ref, minutes: 720 }) });
		const history = await tasks.getTask(as("lead"), ws, a.ref);
		expect(history.activity.find((entry) => entry.kind === "time.logged")?.data).toMatchObject({ auto: true });
	});
});

describe("time by hand", () => {
	it("refuses days after today and on or before the lock date, for admins too", async () => {
		const { a } = await setUp();
		expect(await code(time.logTime(as("member"), { ws, ref: a.ref, onDay: addDays(today(), 1), minutes: 30 }))).toBe(
			"BAD_REQUEST",
		);
		const entry = await time.logTime(as("member"), {
			ws,
			ref: a.ref,
			onDay: addDays(today(), -3),
			minutes: 45,
			note: "Review",
			billable: true,
		});
		expect(entry).toMatchObject({ minutes: 45, billable: true, canEdit: true, locked: false });
		await adminTime.setLock(admin(), addDays(today(), -2));
		expect(await code(time.logTime(as("member"), { ws, ref: a.ref, onDay: addDays(today(), -2), minutes: 30 }))).toBe(
			"FORBIDDEN",
		);
		expect(await code(time.updateEntry(as("member"), { ws, id: entry.id, minutes: 60 }))).toBe("FORBIDDEN");
		expect(await code(time.deleteEntry(as("member"), ws, entry.id))).toBe("FORBIDDEN");
		expect(await code(adminTime.update(admin(), { id: entry.id, minutes: 60 }))).toBe("FORBIDDEN");
		expect(await code(adminTime.setLock(admin(), addDays(today(), 1)))).toBe("BAD_REQUEST");
		// The task shows it locked; the timesheet makes the day read only too (lockOn).
		const detail = await tasks.getTask(as("member"), ws, a.ref);
		expect(detail.time.entries[0]).toMatchObject({ locked: true, canEdit: false });
		expect(detail.time.lockOn).toBe(addDays(today(), -2));
		// Unlocking lets it change again.
		await adminTime.setLock(admin(), null);
		expect(await code(time.updateEntry(as("member"), { ws, id: entry.id, minutes: 60 }))).toBe("ok");
	});

	it("keeps each entry its member's: others need taskline:time, viewers can't log, an admin edits anyone's", async () => {
		const { a } = await setUp();
		const entry = await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 30 });
		expect(await code(time.updateEntry(as("lead"), { ws, id: entry.id, minutes: 40 }))).toBe("FORBIDDEN");
		expect(await code(time.updateEntry(as("timer", ["taskline:time"]), { ws, id: entry.id, minutes: 40 }))).toBe("ok");
		expect(await code(time.logTime(as("viewer"), { ws, ref: a.ref, onDay: today(), minutes: 30 }))).toBe("FORBIDDEN");
		const edited = await adminTime.update(admin(), { id: entry.id, minutes: 50, note: "Fixed" });
		expect(edited).toMatchObject({ minutes: 50, note: "Fixed" });
		const audit = await env.db.select().from(schema.auditEvent);
		expect(audit.map((row) => row.action)).toContain("taskline.time.update");
		// A running timer is stopped, not edited; discarding it is a delete.
		await time.startTimer(as("member"), ws, a.ref);
		const running = (await entries()).find((row) => row.endedAt === null && row.startedAt !== null);
		if (!running) throw new Error("no running timer");
		expect(await code(time.updateEntry(as("member"), { ws, id: running.id, note: "x" }))).toBe("CONFLICT");
		expect(await code(time.deleteEntry(as("member"), ws, running.id))).toBe("ok");
		expect((await getNav(as("member"))).timer).toBeNull();
	});

	it("stays within the workspace's quota", async () => {
		const { a } = await setUp();
		await setSettings({ projectCreation: "members", quotas: { timeEntries: 2 } });
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 10 });
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 10 });
		expect(await code(time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 10 }))).toBe("CONFLICT");
		expect(await code(time.startTimer(as("member"), ws, a.ref))).toBe("CONFLICT");
	});
});

describe("the timesheet", () => {
	it("sets a cell's total: more adds an entry, less cuts the newest, zero clears the cell", async () => {
		const { a } = await setUp();
		const day = addDays(today(), -1);
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: day, minutes: 60, note: "Kept" });
		await time.setCell(as("member"), { ws, ref: a.ref, onDay: day, minutes: 150 });
		let rows = (await entries()).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
		expect(rows.map((row) => row.minutes)).toEqual([60, 90]);
		await time.setCell(as("member"), { ws, ref: a.ref, onDay: day, minutes: 40 });
		rows = await entries();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ minutes: 40, note: "Kept" });
		await time.setCell(as("member"), { ws, ref: a.ref, onDay: day, minutes: 0 });
		expect(await entries()).toHaveLength(0);
	});

	it("shows the caller's week by task from the week start, with suggestions and capacity", async () => {
		const { a, b } = await setUp();
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 90 });
		await time.logTime(as("lead"), { ws, ref: b.ref, onDay: today(), minutes: 30 });
		const sheet = await time.getTimesheet(as("member"), ws, today());
		expect(sheet.days).toHaveLength(7);
		expect(sheet.days).toContain(today());
		expect(sheet.rows.map((row) => row.task?.ref)).toEqual([a.ref]);
		expect(sheet.rows[0]?.minutes.reduce((sum, value) => sum + value, 0)).toBe(90);
		expect(sheet.capacityMinutes).toBe(1800);
		// A's assigned to the member but already a row; B isn't theirs.
		expect(sheet.suggestions).toHaveLength(0);
		// An admin reading the team has no timesheet.
		const reader = await time.getTimesheet(
			{ db: env.db, user: { id: "admin-1", isGuest: false, permissions: ["taskline:read"] } },
			ws,
			today(),
		);
		expect(reader).toMatchObject({ canLog: false, rows: [] });
	});

	it("copies last week into open days of tasks with no time yet this week", async () => {
		const { a, b } = await setUp();
		const lastWeek = addDays(today(), -7);
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: lastWeek, minutes: 120, billable: true });
		await time.logTime(as("member"), { ws, ref: b.ref, onDay: lastWeek, minutes: 30 });
		await time.logTime(as("member"), { ws, ref: b.ref, onDay: today(), minutes: 15 });
		const result = await time.copyLastWeek(as("member"), ws, today());
		// B already has time this week, so only A's day is copied.
		expect(result).toEqual({ copied: 1, skipped: 1 });
		const copied = (await entries()).find((row) => row.onDay === today() && row.taskId === a.id);
		expect(copied).toMatchObject({ minutes: 120, billable: true });
		expect(await time.copyLastWeek(as("member"), ws, today())).toEqual({ copied: 0, skipped: 2 });
	});
});

describe("whose timesheet", () => {
	it("is a member's: outsiders, guests and deactivated members get NOT_FOUND, an admin reader has none to copy", async () => {
		const { team } = await setUp();
		expect(await code(time.getTimesheet(as("account"), ws, today()))).toBe("NOT_FOUND");
		expect(await code(time.getTimesheet(as("guest"), ws, today()))).toBe("NOT_FOUND");
		const viewer = await workspaceRepo.memberOf(env.db, team.id, "viewer");
		if (!viewer) throw new Error("no viewer");
		await env.db.transaction((tx) => workspaceRepo.setMemberDeactivated(tx, viewer.id, new Date()));
		expect(await code(time.getTimesheet(as("viewer"), ws, today()))).toBe("NOT_FOUND");
		const reader = { db: env.db, user: { id: "admin-1", isGuest: false, permissions: ["taskline:read"] } };
		expect(await code(time.copyLastWeek(reader, ws, today()))).toBe("FORBIDDEN");
		// Stopping is the caller's own bookkeeping: nothing running is nothing stopped.
		expect(await time.stopTimer(as("account"))).toBeNull();
	});
});

describe("a project's time", () => {
	it("sums estimate against actual by task and member, and keeps a purged task's time on the project", async () => {
		const { a, b, member } = await setUp();
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 300, billable: true });
		await time.logTime(as("lead"), { ws, ref: b.ref, onDay: today(), minutes: 30 });
		const before = await time.getProjectTime(as("viewer"), ws, key);
		expect(before.totals).toEqual({ estimateMinutes: 300, loggedMinutes: 330, billableMinutes: 300 });
		expect(before.tasks.find((task) => task.ref === a.ref)).toMatchObject({ estimateMinutes: 240, loggedMinutes: 300 });
		expect(before.members.find((row) => row.memberId === member.id)).toMatchObject({
			estimateMinutes: 240,
			loggedMinutes: 300,
		});
		await tasks.trashTask(as("lead"), ws, b.ref);
		await tasks.purgeTask(as("lead"), ws, b.ref);
		const after = await time.getProjectTime(as("lead"), ws, key);
		expect(after.orphanMinutes).toBe(30);
		expect(after.totals.loggedMinutes).toBe(330);
	});
});

describe("the admin's timesheets", () => {
	it("lists the team's entries with totals and filters, reports utilization and exports CSV", async () => {
		const { a, member } = await setUp();
		await time.logTime(as("member"), { ws, ref: a.ref, onDay: today(), minutes: 120, billable: true });
		await time.logTime(as("lead"), { ws, ref: a.ref, onDay: today(), minutes: 60 });
		const input = (search: Record<string, unknown> = {}) =>
			adminTimeList.input.parse({ ...adminTimeList.defaults, pageSize: 50, ...search });
		const all = await adminTime.list(admin(), input());
		expect(all).toMatchObject({ total: 2, totalMinutes: 180, billableMinutes: 120 });
		const theirs = await adminTime.list(admin(), input({ member: member.id }));
		expect(theirs.items.map((item) => item.minutes)).toEqual([120]);
		expect((await adminTime.list(admin(), input({ billable: "unbillable" }))).totalMinutes).toBe(60);
		const usage = await adminTime.utilization(admin(), { from: addDays(today(), -6), to: today() });
		// A week holds every working day: the whole weekly capacity.
		expect(usage.rows.find((row) => row.memberId === member.id)).toMatchObject({
			capacityMinutes: 1800,
			loggedMinutes: 120,
			billableMinutes: 120,
		});
		const file = await adminTime.exportCsv(admin(), input());
		expect(file.content.split(/\r?\n/)[0]?.replace(/^﻿/, "")).toBe(
			"day,member,project,task,title,minutes,hours,billable,note",
		);
		expect(file.content).toContain("Mohan Member");
		// Sandboxes never show here.
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		expect((await adminTime.list(admin(), input())).total).toBe(2);
	});
});

describe("sprints estimated in time", () => {
	it("count estimated minutes, store them at the start and the end, and average them as velocity", async () => {
		const { a, b } = await setUp();
		const project = await projects.getProject(as("lead"), ws, key);
		await projects.updateProject(as("lead"), {
			ws,
			key,
			version: project.version,
			name: project.name,
			settings: { sprints: true, estimation: "time" },
		});
		const sprint = await sprints.createSprint(as("lead"), {
			ws,
			key,
			name: "Sprint 1",
			startOn: today(),
			endOn: addDays(today(), 13),
		});
		await tasks.patchTask(as("lead"), { ws, ref: a.ref, sprintId: sprint.id });
		await tasks.patchTask(as("lead"), { ws, ref: b.ref, sprintId: sprint.id });
		const started = await sprints.startSprint(as("lead"), ws, key, sprint.id);
		expect(started.committed).toEqual({ points: 0, tasks: 2, minutes: 300 });
		const board = await tasks.listTasks(as("lead"), ws, key);
		const done = board.statuses.find((status) => status.category === "completed");
		if (!done) throw new Error("no completed status");
		await tasks.moveTask(as("lead"), { ws, ref: b.ref, statusId: done.id, position: "a0" });
		const completed = await sprints.completeSprint(as("lead"), { ws, key, id: sprint.id, carryTo: "backlog" });
		expect(completed.completed).toEqual({ points: 0, tasks: 1, minutes: 60 });
		expect((await tasks.listTasks(as("lead"), ws, key)).velocity).toMatchObject({ minutes: 60, sprints: 1 });
	});
});

describe("the sandbox", () => {
	it("seeds a week of time with notes in both languages, and the claim moves it, stopping the guest's timer", async () => {
		await setUp();
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const seeded = await entries();
		expect(seeded.length).toBeGreaterThanOrEqual(10);
		expect(seeded.some((row) => /[ऀ-ॿ]/.test(row.note))).toBe(true);
		const sheet = await time.getTimesheet(as("guest"), "sandbox", today());
		expect(sheet.rows.length).toBeGreaterThan(0);
		const board = await tasks.listTasks(as("guest"), "sandbox", key);
		const first = board.tasks[0];
		if (!first) throw new Error("no task");
		await time.startTimer(as("guest"), "sandbox", first.ref);
		// The account has a sandbox and a timer of its own: the merge keeps one running.
		await env.db.transaction((tx) => seedSandbox(tx, "account", "en"));
		const own = (await tasks.listTasks(as("account"), "sandbox", key)).tasks[0];
		if (!own) throw new Error("no own task");
		await time.startTimer(as("account"), "sandbox", own.ref);
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const sandbox = await workspaceRepo.sandboxOf(env.db, "account");
		if (!sandbox) throw new Error("no sandbox");
		const moved = await env.db.select().from(schema.tlTimeEntry).where(eq(schema.tlTimeEntry.workspaceId, sandbox.id));
		expect(moved.length).toBe(seeded.length * 2 + 2);
		const running = await env.db
			.select()
			.from(schema.tlTimeEntry)
			.where(and(eq(schema.tlTimeEntry.workspaceId, sandbox.id), sql`${schema.tlTimeEntry.endedAt} is null`));
		expect(running.filter((row) => row.startedAt !== null)).toHaveLength(1);
	});
});
