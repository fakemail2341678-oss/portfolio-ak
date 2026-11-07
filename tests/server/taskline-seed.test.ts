import { hashPassword } from "better-auth/crypto";
import { afterAll, describe, expect, it } from "vitest";
import { templateDefinition } from "@/features/taskline/template-definition";
import type { TasklineServices } from "@/server/taskline/access";
import * as automations from "@/server/taskline/automations/service";
import * as projects from "@/server/taskline/projects/service";
import { listProjectUpdates } from "@/server/taskline/projects/updates";
import * as tasks from "@/server/taskline/tasks/service";
import { listTemplates } from "@/server/taskline/templates/service";
import { seedTaskline, TASKLINE_TEAM } from "../../scripts/lib/taskline-seed.ts";
import { createTestDb } from "../utils/test-db";

/** `pnpm db:seed-taskline`'s demo team, run against the real migrations, then read through the services. */
describe("Taskline demo seed", async () => {
	const testDb = await createTestDb();
	const query = async (sql: string, params?: unknown[]) => {
		const result = await testDb.client.query<Record<string, unknown>>(sql, params);
		return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
	};
	afterAll(() => testDb.close());
	const as = async (email: string): Promise<TasklineServices> => {
		const { rows } = await query(`select "id" from "user" where "email" = $1`, [email]);
		return { db: testDb.db, user: { id: String(rows[0]?.id), isGuest: false, permissions: [] } };
	};

	it("writes the team, its projects and tasks once, and keeps them on a second run", async () => {
		const passwordHash = await hashPassword("demo-password-123");
		expect(await seedTaskline(query, { passwordHash })).toEqual({ accounts: 5, projects: 3, tasks: 60 });
		expect(await seedTaskline(query, { passwordHash })).toEqual({ accounts: 0, projects: 0, tasks: 0 });

		const asha = TASKLINE_TEAM[0];
		const priya = TASKLINE_TEAM.find((person) => person.role === "viewer");
		const viewer = await as(priya?.email ?? "");
		expect((await projects.listProjects(viewer, { ws: "team" })).map((project) => project.key)).toEqual(["APP", "WEB"]);
		const board = await tasks.listTasks(await as(asha?.email ?? ""), "team", "WEB");
		expect(board.tasks).toHaveLength(20);
		// Task 55: the team's Severity, and WEB's own Reviewer and a sign-off, with values.
		expect(board.fields.map((field) => [field.name, field.projectId === null, field.required])).toEqual([
			["Severity", true, false],
			["Reviewer", false, false],
			["Signed off", false, false],
		]);
		expect(board.tasks.filter((task) => Object.keys(task.fields).length > 0).length).toBeGreaterThan(10);
		// Task 52: APP plans in sprints: one completed (the velocity), the active one and the next.
		const app = await tasks.listTasks(await as(asha?.email ?? ""), "team", "APP");
		expect(app.project.settings.sprints).toBe(true);
		expect(app.sprints.map((sprint) => [sprint.name, sprint.state])).toEqual([
			["Sprint 2", "active"],
			["Sprint 3", "planned"],
		]);
		expect(app.velocity.sprints).toBe(1);
		expect(app.sprintCount).toBe(3);
		expect(app.tasks.every((task) => task.points !== null)).toBe(true);
		expect(board.statuses.map((status) => status.name)).toEqual([
			"Backlog",
			"To do",
			"In progress",
			"Done",
			"Canceled",
		]);
		// The admin is on the team and on every project.
		const admin = { db: testDb.db, user: { id: testDb.adminId, isGuest: false, permissions: [] } };
		expect((await projects.listProjects(admin, { ws: "team" })).map((project) => project.key)).toEqual([
			"APP",
			"OPS",
			"WEB",
		]);
		// Task 56: WEB's own rule with its runs, the team's rule beside it, and a repeating task in OPS.
		const sita = TASKLINE_TEAM.find((each) => each.email.startsWith("sita@"));
		// Task 57: the saved template reads as a definition, and WEB has its lead's updates.
		const saved = await query(`select "name", "definition" from "tl_template"`);
		expect(saved.rows.map((row) => row.name)).toEqual(["Website launch"]);
		expect(templateDefinition.safeParse(saved.rows[0]?.definition).success).toBe(true);
		// Read back as "New project" reads it: the seed's SQL stores only part of a definition.
		const offered = await listTemplates(await as(asha?.email ?? ""), { ws: "team" });
		expect(offered.find((choice) => choice.name === "Website launch")?.counts).toMatchObject({
			statuses: 5,
			labels: 0,
			tasks: 3,
		});
		const updates = await listProjectUpdates(await as(sita?.email ?? ""), { ws: "team", key: "WEB" });
		expect(updates.map((update) => update.health)).toEqual(["at_risk", "on_track"]);
		const rules = await automations.listAutomations(await as(sita?.email ?? ""), "team", "WEB");
		expect(rules.automations.map((rule) => rule.name)).toEqual(["Close a parent when its subtasks are done"]);
		expect(rules.workspace.map((rule) => rule.name)).toEqual(["Urgent bugs tell the lead"]);
		expect(rules.runs.map((run) => run.outcome)).toEqual(["failed", "ok"]);
		const ops = await tasks.listTasks(admin, "team", "OPS");
		expect(ops.tasks.filter((task) => task.recurrence?.freq === "weekly")).toHaveLength(1);
		// Numbers continue after the seeded ones.
		expect((await tasks.createTask(admin, { ws: "team", key: "OPS", title: "Next" })).ref).toBe("OPS-21");
	});
});
