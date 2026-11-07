import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/features/rbac/types";
import { templateDefinition, templateFile } from "@/features/taskline/template-definition";
import { BUILTIN_TEMPLATES } from "@/features/taskline/types";
import { isAppError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as adminProjects from "@/server/taskline/admin/projects";
import * as adminReports from "@/server/taskline/admin/reports";
import * as adminTemplates from "@/server/taskline/admin/templates";
import * as automations from "@/server/taskline/automations/service";
import * as fields from "@/server/taskline/fields/service";
import * as projects from "@/server/taskline/projects/service";
import * as updates from "@/server/taskline/projects/updates";
import * as reports from "@/server/taskline/reports/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as tasks from "@/server/taskline/tasks/service";
import { builtinTemplate } from "@/server/taskline/templates/builtin";
import * as templates from "@/server/taskline/templates/service";
import * as time from "@/server/taskline/time/service";
import * as timeline from "@/server/taskline/timeline/service";
import * as workflow from "@/server/taskline/workflow/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Templates, reports and project updates on PGlite (Task 57, decisions 0224, 0225): the
 * built-ins in both languages, a project made from one, a template's round trip through
 * "Save project as template" and its file, what a definition refuses, the reports'
 * numbers from real moves, updates setting the health, and the sandbox's seed and claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "outsider", name: "Oz Outsider", email: "outsider@example.com" },
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

async function setUp() {
	await env.reset();
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead", role: "member" },
			{ workspaceId: team.id, userId: "member", displayName: "Mohan Member", role: "member" },
			{ workspaceId: team.id, userId: "viewer", displayName: "Vera Viewer", role: "viewer" },
		]),
	);
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	return team;
}

/** A task moved to another status, as the board moves it. */
const move = (ref: string, statusId: string | undefined) =>
	tasks.moveTask(as("lead"), { ws, ref, statusId: statusId ?? "", position: "a5" });

const statusIdsOf = async (key: string, caller = as("lead")) => {
	const board = await tasks.listTasks(caller, ws, key);
	return board.statuses;
};

describe("the built-ins", () => {
	it("are valid definitions in both languages, and read in the language asked for", () => {
		for (const id of BUILTIN_TEMPLATES) {
			for (const locale of ["en", "ne"] as const) {
				const template = builtinTemplate(id, locale);
				expect(templateFile.safeParse(template).success).toBe(true);
				expect(template.definition.tasks.length).toBeGreaterThan(0);
				expect(template.definition.automations.length).toBeGreaterThan(0);
			}
		}
		expect(builtinTemplate("scrum", "en").name).toBe("Scrum software");
		expect(builtinTemplate("scrum", "ne").name).toBe("स्क्रम सफ्टवेयर");
	});

	it("are what a sandbox and a team member are offered, the team's own after them", async () => {
		await setUp();
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const inSandbox = await templates.listTemplates(as("guest"), { ws: "sandbox" });
		expect(inSandbox.map((choice) => choice.id)).toEqual([...BUILTIN_TEMPLATES]);
		await adminTemplates.createTemplate(admin(), {
			name: "Ours",
			description: "",
			definition: builtinTemplate("kanban", "en").definition,
		});
		const inTeam = await templates.listTemplates(as("viewer"), { ws });
		expect(inTeam.map((choice) => choice.name).at(-1)).toBe("Ours");
		expect(inTeam.at(-1)?.builtin).toBe(false);
		// The sandbox doesn't see the team's, and an outsider reaches neither.
		expect(await templates.listTemplates(as("guest"), { ws: "sandbox" })).toHaveLength(BUILTIN_TEMPLATES.length);
		expect(await code(templates.listTemplates(as("outsider"), { ws }))).toBe("NOT_FOUND");
	});
});

describe("a project from a template", () => {
	it("has its statuses, fields, automations, labels, settings, milestones and tasks, with dates from the start", async () => {
		await setUp();
		const startOn = addDays(today(), 10);
		const project = await projects.createProject(as("lead"), {
			ws,
			key: "SCR",
			name: "Scrum",
			template: "scrum",
			startOn,
		});
		const definition = builtinTemplate("scrum", "en").definition;
		expect(project.settings.sprints).toBe(true);
		expect(project.startOn).toBe(startOn);

		const board = await tasks.listTasks(as("lead"), ws, "SCR");
		expect(board.statuses.map((status) => status.name)).toEqual(definition.statuses.map((status) => status.name));
		expect(board.fields.map((field) => field.name)).toEqual(definition.fields.map((field) => field.name));
		expect(board.labels.map((label) => label.name).sort()).toEqual(definition.labels.map((label) => label.name).sort());
		expect(board.tasks).toHaveLength(definition.tasks.length);
		// The ids are new, and the task's status is one of the project's.
		const statusIds = new Set(board.statuses.map((status) => status.id));
		for (const status of definition.statuses) expect(statusIds.has(status.id)).toBe(false);
		const goal = board.tasks.find((task) => task.title === definition.tasks[0]?.title);
		expect(goal?.dueOn).toBe(addDays(startOn, definition.tasks[0]?.dueOffset ?? 0));
		expect(statusIds.has(goal?.statusId ?? "")).toBe(true);
		expect(goal?.points).toBe(definition.tasks[0]?.points);

		expect(board.milestones.map((milestone) => milestone.dueOn)).toEqual([
			addDays(startOn, definition.milestones[0]?.dueOffset ?? 0),
		]);

		const rules = await automations.listAutomations(as("lead"), ws, "SCR");
		expect(rules.automations.map((rule) => rule.name).sort()).toEqual(
			definition.automations.map((rule) => rule.name).sort(),
		);
		// The rule points at this project's label, and runs.
		const bugLabel = board.labels.find((label) => label.name === "Bug");
		const bugRule = rules.automations.find((rule) => rule.actions[0]?.type === "add_label");
		expect(bugRule?.actions[0]).toEqual({ type: "add_label", labelId: bugLabel?.id });
		const bug = await tasks.createTask(as("lead"), { ws, key: "SCR", title: "A bug", type: "bug" });
		const detail = await tasks.getTask(as("lead"), ws, bug.ref);
		expect(detail.labelIds).toContain(bugLabel?.id);
	});

	it("starts today by default, in a sandbox too, within the sandbox's quota", async () => {
		await setUp();
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const project = await projects.createProject(as("guest"), {
			ws: "sandbox",
			key: "EVT",
			name: "Event",
			template: "event",
		});
		expect(project.startOn).toBe(today());
		const board = await tasks.listTasks(as("guest"), "sandbox", "EVT");
		expect(board.statuses.length).toBe(builtinTemplate("event", "en").definition.statuses.length);
	});

	it("is refused whole when it wouldn't fit the quotas", async () => {
		const team = await setUp();
		await env.db
			.update(schema.tlWorkspace)
			.set({ settings: { projectCreation: "members", quotas: { tasks: 2 } } })
			.where(eq(schema.tlWorkspace.id, team.id));
		expect(await code(projects.createProject(as("lead"), { ws, key: "SCR", name: "Scrum", template: "scrum" }))).toBe(
			"CONFLICT",
		);
		expect(await env.db.select().from(schema.tlProject)).toHaveLength(0);
	});

	it("uses a workspace label of the same name instead of a second one", async () => {
		await setUp();
		const team = await workspaceRepo.ensureTeamWorkspace(env.db);
		const [shared] = await env.db
			.insert(schema.tlLabel)
			.values({ workspaceId: team.id, projectId: null, name: "bug", color: "red" })
			.returning();
		await projects.createProject(as("lead"), { ws, key: "SCR", name: "Scrum", template: "scrum" });
		const board = await tasks.listTasks(as("lead"), ws, "SCR");
		expect(board.labels.filter((label) => label.name.toLowerCase() === "bug").map((label) => label.id)).toEqual([
			shared?.id,
		]);
		const rules = await automations.listAutomations(as("lead"), ws, "SCR");
		expect(rules.automations.find((rule) => rule.actions[0]?.type === "add_label")?.actions[0]).toEqual({
			type: "add_label",
			labelId: shared?.id,
		});
	});

	it("records its creation, notifies nobody, and fires nothing", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "SCR", name: "Scrum", template: "scrum" });
		const runs = await env.db.select().from(schema.tlAutomationRun);
		expect(runs).toHaveLength(0);
		const notifications = await env.db.select().from(schema.tlNotification);
		expect(notifications).toHaveLength(0);
		const [created] = await env.db
			.select()
			.from(schema.tlActivity)
			.where(eq(schema.tlActivity.kind, "project.created"));
		expect(created?.data.template).toBe("Scrum software");
	});

	it("refuses a template that isn't the workspace's, and those who may not create", async () => {
		await setUp();
		const id = crypto.randomUUID();
		expect(await code(projects.createProject(as("lead"), { ws, key: "BAD", name: "Bad", template: id }))).toBe(
			"BAD_REQUEST",
		);
		expect(await env.db.select().from(schema.tlProject)).toHaveLength(0);
		expect(await code(projects.createProject(as("viewer"), { ws, key: "BAD", name: "Bad", template: "scrum" }))).toBe(
			"FORBIDDEN",
		);
		// Another workspace's: a saved template never reaches a sandbox.
		const saved = await adminTemplates.createTemplate(admin(), {
			name: "Ours",
			description: "",
			definition: builtinTemplate("kanban", "en").definition,
		});
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const ours = saved.templates[0]?.id ?? "";
		expect(
			await code(projects.createProject(as("guest"), { ws: "sandbox", key: "BAD", name: "B", template: ours })),
		).toBe("BAD_REQUEST");
	});

	it("from the admin: a lead picked, the template applied, the audit naming it", async () => {
		await setUp();
		const members = await env.db.select().from(schema.tlMember);
		const lead = members.find((member) => member.userId === "member");
		const project = await adminProjects.create(admin(), {
			key: "ADM",
			name: "From the admin",
			leadId: lead?.id ?? null,
			visibility: "team",
			color: "teal",
			template: "client",
		});
		expect(project.statuses.map((status) => status.name)).toContain("With the client");
		const rules = await automations.listAutomations(as("member"), ws, "ADM");
		expect(rules.automations).toHaveLength(1);
		const [log] = await env.db
			.select()
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.action, "taskline.project.create"));
		expect((log?.after as { template?: string }).template).toBe("Client project");
	});
});

describe("the team's templates", () => {
	it("round trips: a project saved as a template makes a project like it, and its file reads back", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "SRC", name: "Source", startOn: "2026-03-01" });
		const statuses = await statusIdsOf("SRC");
		const open = statuses.find((status) => status.category === "unstarted");
		await workflow.createLabel(as("lead"), { ws, key: "SRC", name: "Design", color: "pink" });
		const labels = (await tasks.listTasks(as("lead"), ws, "SRC")).labels;
		const design = labels.find((label) => label.name === "Design");
		await fields.createField(as("lead"), {
			ws,
			key: "SRC",
			field: { type: "select", name: "Area", required: true, options: [{ id: "oabc123", name: "UI", color: "blue" }] },
		});
		const area = (await tasks.listTasks(as("lead"), ws, "SRC")).fields.find((field) => field.name === "Area");
		await automations.createAutomation(as("lead"), {
			ws,
			key: "SRC",
			automation: {
				name: "UI goes to review",
				enabled: true,
				trigger: { type: "status_changed", statusId: open?.id },
				conditions: [
					{ type: "label", labelId: design?.id ?? "", has: true },
					{ type: "field", fieldId: area?.id ?? "", value: "oabc123" },
				],
				actions: [{ type: "set_priority", priority: 3 }],
			},
		});
		// Names a person: it can't travel.
		const members = await env.db.select().from(schema.tlMember);
		await automations.createAutomation(as("lead"), {
			ws,
			key: "SRC",
			automation: {
				name: "To Mohan",
				enabled: true,
				trigger: { type: "task_created" },
				conditions: [],
				actions: [{ type: "assign", to: members.find((member) => member.userId === "member")?.id ?? "" }],
			},
		});
		const milestone = await timeline.createMilestone(as("lead"), {
			ws,
			key: "SRC",
			name: "Beta",
			description: "",
			dueOn: "2026-03-11",
		});
		const parent = await tasks.createTask(as("lead"), {
			ws,
			key: "SRC",
			title: "Parent",
			labelIds: [design?.id ?? ""],
			dueOn: "2026-03-08",
		});
		await tasks.patchTask(as("lead"), { ws, ref: parent.ref, milestoneId: milestone.id });
		await tasks.createTask(as("lead"), { ws, key: "SRC", title: "Child", parentId: parent.id, startOn: "2026-03-03" });

		const project = (await env.db.select().from(schema.tlProject))[0];
		const saved = await adminTemplates.saveProjectAsTemplate(admin(), {
			projectId: project?.id ?? "",
			name: "From source",
			description: "Made from a project",
			tasks: true,
		});
		expect(saved.leftOut).toBe(1);

		const list = await adminTemplates.listTemplates(admin());
		const template = list.templates[0];
		expect(template?.name).toBe("From source");
		expect(template?.definition.automations.map((rule) => rule.name)).toEqual(["UI goes to review"]);
		expect(template?.definition.milestones[0]?.dueOffset).toBe(10);
		const savedParent = template?.definition.tasks.find((task) => task.title === "Parent");
		const savedChild = template?.definition.tasks.find((task) => task.title === "Child");
		expect(savedParent?.dueOffset).toBe(7);
		expect(savedChild?.startOffset).toBe(2);
		expect(template?.definition.tasks[savedChild?.parent ?? -1]?.title).toBe("Parent");

		// Its file is what "Import" reads.
		const file = JSON.parse(
			JSON.stringify({ name: "Imported", description: "", definition: template?.definition }),
		) as unknown;
		const parsed = templateFile.parse(file);
		await adminTemplates.createTemplate(admin(), {
			name: parsed.name,
			description: parsed.description,
			definition: parsed.definition,
		});
		const imported = (await adminTemplates.listTemplates(admin())).templates.find((each) => each.name === "Imported");

		const startOn = "2026-06-01";
		await projects.createProject(as("lead"), { ws, key: "NEW", name: "New", template: imported?.id, startOn });
		const board = await tasks.listTasks(as("lead"), ws, "NEW");
		expect(board.statuses.map((status) => status.name)).toEqual(statuses.map((status) => status.name));
		const newArea = board.fields.find((field) => field.name === "Area");
		expect(newArea?.required).toBe(true);
		expect(newArea?.options.map((option) => option.id)).toEqual(["oabc123"]);
		expect(newArea?.id).not.toBe(area?.id);
		const newParent = board.tasks.find((task) => task.title === "Parent");
		const newChild = board.tasks.find((task) => task.title === "Child");
		expect(newParent?.dueOn).toBe("2026-06-08");
		expect(newChild?.parentId).toBe(newParent?.id);
		expect(newChild?.startOn).toBe("2026-06-03");
		const rules = await automations.listAutomations(as("lead"), ws, "NEW");
		const rule = rules.automations[0];
		expect(rule?.conditions).toEqual([
			{ type: "label", labelId: board.labels.find((label) => label.name === "Design")?.id, has: true },
			{ type: "field", fieldId: newArea?.id, value: "oabc123" },
		]);
		expect(board.statuses.map((status) => status.id)).toContain(
			rule?.trigger.type === "status_changed" ? rule.trigger.statusId : "",
		);
	});

	it("saves without tasks unless asked, and audits every change", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "SRC", name: "Source" });
		await tasks.createTask(as("lead"), { ws, key: "SRC", title: "Stays home" });
		const project = (await env.db.select().from(schema.tlProject))[0];
		await adminTemplates.saveProjectAsTemplate(admin(), {
			projectId: project?.id ?? "",
			name: "Bare",
			description: "",
			tasks: false,
		});
		const { templates: saved } = await adminTemplates.listTemplates(admin());
		const bare = saved[0];
		expect(bare?.definition.tasks).toHaveLength(0);

		const after = await adminTemplates.updateTemplate(admin(), {
			id: bare?.id ?? "",
			version: bare?.version ?? 0,
			name: "Bare again",
			description: "",
			definition: bare?.definition ?? builtinTemplate("kanban", "en").definition,
		});
		expect(after.templates[0]?.name).toBe("Bare again");
		// A second save from the old version is stale.
		expect(
			await code(
				adminTemplates.updateTemplate(admin(), {
					id: bare?.id ?? "",
					version: bare?.version ?? 0,
					name: "Stale",
					description: "",
					definition: bare?.definition ?? builtinTemplate("kanban", "en").definition,
				}),
			),
		).toBe("CONFLICT");
		await adminTemplates.deleteTemplate(admin(), { id: bare?.id ?? "" });
		expect((await adminTemplates.listTemplates(admin())).templates).toHaveLength(0);
		const logs = await env.db
			.select({ action: schema.auditEvent.action })
			.from(schema.auditEvent)
			.orderBy(asc(schema.auditEvent.createdAt));
		expect(logs.map((log) => log.action).filter((action) => action.includes("template"))).toEqual([
			"taskline.template.create",
			"taskline.template.update",
			"taskline.template.delete",
		]);
	});

	it("refuses a name that's taken, in any case", async () => {
		await setUp();
		const definition = builtinTemplate("kanban", "en").definition;
		await adminTemplates.createTemplate(admin(), { name: "Ours", description: "", definition });
		expect(await code(adminTemplates.createTemplate(admin(), { name: "OURS", description: "", definition }))).toBe(
			"CONFLICT",
		);
	});
});

describe("a definition refuses", () => {
	const statuses = [
		{ id: "00000000-0000-4000-8000-000000000001", name: "To do", category: "unstarted", color: "blue" },
		{ id: "00000000-0000-4000-8000-000000000002", name: "Done", category: "completed", color: "green" },
	];
	const valid = { statuses, settings: {} };
	const ok = (value: unknown) => templateDefinition.safeParse(value).success;
	const someone = "10000000-0000-4000-8000-000000000001";
	const rule = (rest: object) => ({
		name: "R",
		enabled: true,
		trigger: { type: "task_created" },
		conditions: [],
		actions: [{ type: "set_priority", priority: 1 }],
		...rest,
	});

	it("accepts the smallest template", () => {
		expect(ok(valid)).toBe(true);
	});
	it("no open status, or no completed one", () => {
		expect(ok({ ...valid, statuses: [statuses[1], { ...statuses[1], id: statuses[0]?.id, name: "Also" }] })).toBe(
			false,
		);
		expect(ok({ ...valid, statuses: [statuses[0], { ...statuses[0], id: statuses[1]?.id, name: "Also" }] })).toBe(
			false,
		);
	});
	it("repeated names and ids", () => {
		expect(ok({ ...valid, statuses: [statuses[0], { ...statuses[1], name: "to do" }] })).toBe(false);
		expect(ok({ ...valid, statuses: [statuses[0], { ...statuses[1], id: statuses[0]?.id }] })).toBe(false);
	});
	it("a task naming what the template doesn't have", () => {
		expect(ok({ ...valid, tasks: [{ title: "T", status: someone }] })).toBe(false);
		expect(ok({ ...valid, tasks: [{ title: "T", status: statuses[0]?.id, labels: [someone] }] })).toBe(false);
		expect(ok({ ...valid, tasks: [{ title: "T", status: statuses[0]?.id, milestone: someone }] })).toBe(false);
	});
	it("a parent that isn't before its task, or a fourth level", () => {
		const task = { title: "T", status: statuses[0]?.id };
		expect(ok({ ...valid, tasks: [{ ...task, parent: 0 }] })).toBe(false);
		expect(ok({ ...valid, tasks: [{ ...task, parent: 1 }, task] })).toBe(false);
		expect(ok({ ...valid, tasks: [task, { ...task, parent: 0 }, { ...task, parent: 1 }] })).toBe(true);
		expect(
			ok({ ...valid, tasks: [task, { ...task, parent: 0 }, { ...task, parent: 1 }, { ...task, parent: 2 }] }),
		).toBe(false);
	});
	it("a rule naming a member, a sprint, or what isn't in the template", () => {
		expect(ok({ ...valid, automations: [rule({})] })).toBe(true);
		expect(ok({ ...valid, automations: [rule({ actions: [{ type: "assign", to: "lead" }] })] })).toBe(true);
		expect(ok({ ...valid, automations: [rule({ actions: [{ type: "assign", to: someone }] })] })).toBe(false);
		expect(ok({ ...valid, automations: [rule({ actions: [{ type: "set_sprint", to: someone }] })] })).toBe(false);
		expect(ok({ ...valid, automations: [rule({ actions: [{ type: "notify", to: someone, message: "" }] })] })).toBe(
			false,
		);
		expect(ok({ ...valid, automations: [rule({ conditions: [{ type: "assignee", is: someone }] })] })).toBe(false);
		expect(ok({ ...valid, automations: [rule({ trigger: { type: "status_changed", statusId: someone } })] })).toBe(
			false,
		);
		expect(ok({ ...valid, automations: [rule({ actions: [{ type: "add_label", labelId: someone }] })] })).toBe(false);
	});
	it("a field of the wrong shape, and a condition on a choice it doesn't have", () => {
		const field = { id: "00000000-0000-4000-8000-000000000003", name: "F", type: "select" };
		expect(ok({ ...valid, fields: [field] })).toBe(false);
		const withOption = { ...field, options: [{ id: "oabc123", name: "A", color: "red" }] };
		expect(ok({ ...valid, fields: [withOption] })).toBe(true);
		const on = (value: string) => rule({ conditions: [{ type: "field", fieldId: field.id, value }] });
		expect(ok({ ...valid, fields: [withOption], automations: [on("oabc123")] })).toBe(true);
		expect(ok({ ...valid, fields: [withOption], automations: [on("ozzz999")] })).toBe(false);
	});
});

describe("project updates", () => {
	it("set the health, read newest first, and go in the history", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
		await updates.postProjectUpdate(as("lead"), { ws, key: "WEB", health: "on_track", body: "<p>First</p>" });
		const second = await updates.postProjectUpdate(as("lead"), {
			ws,
			key: "WEB",
			health: "off_track",
			body: "<p>Second</p><script>alert(1)</script>",
		});
		expect(second.author).toBe("Lena Lead");
		expect(second.body).not.toContain("script");
		expect((await projects.getProject(as("lead"), ws, "WEB")).health).toBe("off_track");
		const list = await updates.listProjectUpdates(as("viewer"), { ws, key: "WEB" });
		expect(list.map((update) => update.health)).toEqual(["off_track", "on_track"]);
		await updates.deleteProjectUpdate(as("lead"), { ws, key: "WEB", id: second.id });
		expect(await updates.listProjectUpdates(as("lead"), { ws, key: "WEB" })).toHaveLength(1);
		// Deleting leaves the health as it is.
		expect((await projects.getProject(as("lead"), ws, "WEB")).health).toBe("off_track");
		const kinds = await env.db
			.select({ kind: schema.tlActivity.kind })
			.from(schema.tlActivity)
			.where(and(eq(schema.tlActivity.kind, "project.update_posted")));
		expect(kinds).toHaveLength(2);
	});

	it("need something to say, and an open project", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
		expect(
			await code(updates.postProjectUpdate(as("lead"), { ws, key: "WEB", health: "on_track", body: "<p> </p>" })),
		).toBe("BAD_REQUEST");
		await projects.setProjectArchived(as("lead"), { ws, key: "WEB", archived: true });
		expect(
			await code(updates.postProjectUpdate(as("lead"), { ws, key: "WEB", health: "on_track", body: "<p>x</p>" })),
		).toBe("FORBIDDEN");
	});

	it("an admin without a member row posts with no author, and the exports carry them", async () => {
		await setUp();
		const project = await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
		const manager: TasklineServices = {
			db: env.db,
			user: { id: "admin-1", isGuest: false, permissions: ["taskline:manage"] },
		};
		const update = await updates.postProjectUpdate(manager, {
			ws,
			key: "WEB",
			health: "at_risk",
			body: "<p>Watch</p>",
		});
		expect(update.author).toBeNull();
		const file = await adminProjects.exportProject(admin(), { id: project.id, format: "json" });
		const json = JSON.parse(file.content) as {
			updates: Array<{ author: string | null; health: string; body: string }>;
		};
		expect(json.updates).toEqual([expect.objectContaining({ author: null, health: "at_risk", body: "Watch" })]);
	});
});

describe("a project's reports", () => {
	it("count from real moves: breakdowns, weeks, cycle and lead, workload and time", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
		const board = await tasks.listTasks(as("lead"), ws, "WEB");
		const statusOf = (category: string) => board.statuses.find((status) => status.category === category);
		const members = await env.db.select().from(schema.tlMember);
		const mohan = members.find((member) => member.userId === "member");
		const done = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Done one", priority: 4 });
		await move(done.ref, statusOf("started")?.id);
		await move(done.ref, statusOf("completed")?.id);
		await tasks.createTask(as("lead"), {
			ws,
			key: "WEB",
			title: "Late one",
			priority: 2,
			assigneeId: mohan?.id,
			dueOn: addDays(today(), -3),
			estimateMinutes: 90,
			points: 3,
		});
		const canceled = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Dropped" });
		await move(canceled.ref, statusOf("canceled")?.id);

		// Date the work back: created ten days ago, started eight ago, completed two ago.
		const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
		const [doneRow] = await env.db.select().from(schema.tlTask).where(eq(schema.tlTask.title, "Done one"));
		await env.db
			.update(schema.tlTask)
			.set({ createdAt: ago(10), completedAt: ago(2) })
			.where(eq(schema.tlTask.id, doneRow?.id ?? ""));
		const moves = await env.db
			.select()
			.from(schema.tlActivity)
			.where(and(eq(schema.tlActivity.taskId, doneRow?.id ?? ""), eq(schema.tlActivity.kind, "task.moved")))
			.orderBy(asc(schema.tlActivity.at));
		await env.db
			.update(schema.tlActivity)
			.set({ at: ago(8) })
			.where(eq(schema.tlActivity.id, moves[0]?.id ?? ""));
		await env.db
			.update(schema.tlActivity)
			.set({ at: ago(2) })
			.where(eq(schema.tlActivity.id, moves[1]?.id ?? ""));

		const report = await reports.getProjectReports(as("viewer"), { ws, key: "WEB", range: "4w" });
		expect(report.statuses.find((status) => status.category === "completed")?.count).toBe(1);
		expect(report.statuses.find((status) => status.category === "canceled")?.count).toBe(1);
		// Priorities are open tasks only.
		expect(report.priorities.find((row) => row.priority === 2)?.count).toBe(1);
		expect(report.priorities.find((row) => row.priority === 4)?.count).toBe(0);
		expect(report.weeks).toHaveLength(4);
		expect(report.weeks.reduce((total, week) => total + week.created, 0)).toBe(3);
		// Canceled isn't completed.
		expect(report.weeks.reduce((total, week) => total + week.completed, 0)).toBe(1);
		expect(report.weeks.at(-1)?.overdue).toBe(1);
		expect(report.cycle.tasks).toHaveLength(1);
		expect(report.cycle.tasks[0]?.cycleDays).toBeCloseTo(6, 1);
		expect(report.cycle.tasks[0]?.leadDays).toBeCloseTo(8, 1);
		expect(report.cycle.medianCycleDays).toBeCloseTo(6, 1);
		expect(report.workload).toEqual([
			{ memberId: mohan?.id, name: "Mohan Member", open: 1, overdue: 1, estimateMinutes: 90, points: 3 },
		]);
		expect(report.time?.totals.estimateMinutes).toBe(90);

		// A project that doesn't track time has no time report.
		const project = await projects.getProject(as("lead"), ws, "WEB");
		await projects.updateProject(as("lead"), {
			ws,
			key: "WEB",
			version: project.version,
			name: project.name,
			settings: { time: false },
		});
		expect((await reports.getProjectReports(as("lead"), { ws, key: "WEB", range: "12w" })).time).toBeNull();
	});
});

describe("the admin's reports", () => {
	it("read health, milestones at risk, workload against capacity and time, private projects too", async () => {
		await setUp();
		await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
		await projects.createProject(as("lead"), { ws, key: "SEC", name: "Secret", visibility: "private" });
		const board = await tasks.listTasks(as("lead"), ws, "WEB");
		const statusOf = (category: string) => board.statuses.find((status) => status.category === category);
		const members = await env.db.select().from(schema.tlMember);
		const lena = members.find((member) => member.userId === "lead");
		const done = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Done" });
		await move(done.ref, statusOf("completed")?.id);
		const open = await tasks.createTask(as("lead"), {
			ws,
			key: "WEB",
			title: "Open",
			assigneeId: lena?.id,
			dueOn: addDays(today(), -1),
			estimateMinutes: 600,
		});
		const dropped = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Dropped" });
		await move(dropped.ref, statusOf("canceled")?.id);
		const late = await timeline.createMilestone(as("lead"), {
			ws,
			key: "WEB",
			name: "Late",
			description: "",
			dueOn: addDays(today(), -2),
		});
		await tasks.patchTask(as("lead"), { ws, ref: open.ref, milestoneId: late.id });
		await timeline.createMilestone(as("lead"), {
			ws,
			key: "WEB",
			name: "Far",
			description: "",
			dueOn: addDays(today(), 60),
		});
		await updates.postProjectUpdate(as("lead"), { ws, key: "WEB", health: "at_risk", body: "<p>Hm</p>" });
		await time.logTime(as("lead"), { ws, ref: open.ref, onDay: today(), minutes: 120, billable: true });

		const report = await adminReports.getReports(admin(), { range: "4w" });
		expect(report.health.map((row) => row.key)).toEqual(["SEC", "WEB"]);
		const web = report.health.find((row) => row.key === "WEB");
		// One done of the two not canceled.
		expect(web?.progress).toBe(0.5);
		expect(web?.overdue).toBe(1);
		expect(web?.milestonesAtRisk).toBe(1);
		expect(web?.health).toBe("at_risk");
		expect(web?.update?.author).toBe("Lena Lead");
		expect(web?.lastActivityAt).not.toBeNull();
		expect(report.health.find((row) => row.key === "SEC")?.progress).toBeNull();
		const lenaLoad = report.workload.find((row) => row.memberId === lena?.id);
		expect(lenaLoad).toMatchObject({
			open: 1,
			overdue: 1,
			estimateMinutes: 600,
			dueSoonMinutes: 600,
			capacityMinutes: 2400,
		});
		expect(report.timeByProject).toEqual([
			{ id: expect.any(String), label: "WEB Website", minutes: 120, billableMinutes: 120 },
		]);
		expect(report.timeByMember[0]).toMatchObject({ label: "Lena Lead", minutes: 120 });
	});
});

describe("the sandbox", () => {
	it("seeds an update in the guest's language, and the claim hands it to the account", async () => {
		await setUp();
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "ne"));
		const list = await updates.listProjectUpdates(as("guest"), { ws: "sandbox", key: "WEB" });
		expect(list).toHaveLength(1);
		expect(list[0]?.health).toBe("on_track");
		expect(list[0]?.body).toMatch(/[ऀ-ॿ]/);
		expect((await projects.getProject(as("guest"), "sandbox", "WEB")).health).toBe("on_track");
		// A guest's own update moves with them.
		await updates.postProjectUpdate(as("guest"), { ws: "sandbox", key: "WEB", health: "at_risk", body: "<p>Mine</p>" });
		await env.db.transaction(async (tx) => {
			await seedSandbox(tx, "account", "en");
			await claimSandbox(tx, "guest", "account");
		});
		const merged = await updates.listProjectUpdates(as("account"), { ws: "sandbox", key: "WEB2" });
		expect(merged.map((update) => update.author)).toEqual(["Arun Account", expect.any(String)]);
	});
});
