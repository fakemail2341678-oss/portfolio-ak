import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/features/rbac/types";
import { adminActivityList, adminMemberList, adminProjectList } from "@/features/taskline/admin/search";
import { isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { TasklineServices } from "@/server/taskline/access";
import * as activity from "@/server/taskline/admin/activity";
import * as invitations from "@/server/taskline/admin/invitations";
import * as members from "@/server/taskline/admin/members";
import * as overview from "@/server/taskline/admin/overview";
import * as adminProjects from "@/server/taskline/admin/projects";
import * as settings from "@/server/taskline/admin/settings";
import * as projects from "@/server/taskline/projects/service";
import * as tasks from "@/server/taskline/tasks/service";
import * as timeline from "@/server/taskline/timeline/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import * as workspaces from "@/server/taskline/workspace/service";
import { createTestDb } from "../utils/test-db";

/**
 * Taskline's admin (PLAN 11.5, Task 49; decision 0212): projects, members, invitations,
 * settings and workflows from /admin. Every change is audited; the app's rules still
 * apply (the admin is lead-equivalent through `taskline:manage`). The guards are
 * checked by guarded-functions.test.ts.
 */

const sent = vi.hoisted(() => [] as { to: string; template: string; data: Record<string, unknown> }[]);
vi.mock("@/server/email/send", () => ({
	sendEmail: async (options: { to: string; template: string; data: Record<string, unknown> }) => {
		sent.push({ to: options.to, template: options.template, data: options.data });
		return { id: "fake" };
	},
	isUndeliverable: (address: string) => address.endsWith(".invalid"),
}));

let env: Awaited<ReturnType<typeof createTestDb>>;

const ACCOUNTS = [
	{ id: "lead", name: "Lead", email: "lead@example.com", emailVerified: true },
	{ id: "member", name: "Member", email: "member@example.com", emailVerified: true },
	{ id: "newcomer", name: "Newcomer", email: "newcomer@example.com", emailVerified: true },
	{ id: "unverified", name: "Unverified", email: "late@example.com", emailVerified: false },
	{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
];

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(ACCOUNTS);
		await workspaceRepo.ensureTeamWorkspace(db);
	});
}, 60_000);
afterAll(() => env.close());

const ALL = ["taskline:read", "taskline:manage", "taskline:configure", "taskline:time"] as const;
const admin = (): { db: typeof env.db; actor: Actor; imageStore: null } => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: [...ALL] },
	imageStore: null,
});
const as = (id: string): TasklineServices => ({ db: env.db, user: { id, isGuest: false, permissions: [] } });

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};
const fields = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch (error) {
		if (isAppError(error)) return Object.keys(error.fieldErrors ?? {});
		throw error;
	}
	return [];
};

const audits = async (action: string) =>
	env.db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, action));

/** The lead and a member on the team, and the team's id. */
async function setUp() {
	await env.reset();
	sent.length = 0;
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lead" },
			{ workspaceId: team.id, userId: "member", displayName: "Member" },
		]),
	);
	const [lead, member] = rows;
	if (!lead || !member) throw new Error("members");
	return { team, lead, member };
}

const listInput = <T>(
	schemaOf: { defaults: Readonly<Record<string, unknown>>; input: { parse: (value: unknown) => T } },
	extra: Record<string, unknown> = {},
) => schemaOf.input.parse({ ...schemaOf.defaults, pageSize: 50, ...extra });

describe("projects", () => {
	beforeEach(setUp);

	it("creates a team project with a chosen lead, the starting statuses and an audit row", async () => {
		const { lead } = await setUp();
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "private",
			color: "teal",
		});
		expect(created).toMatchObject({ key: "WEB", lead: { id: lead.id, name: "Lead" }, visibility: "private" });
		expect(created.statuses).toHaveLength(5);
		expect(created.projectMembers).toEqual([expect.objectContaining({ memberId: lead.id, role: "lead" })]);
		// The lead sees their private project in the app; another member doesn't.
		expect(await code(projects.getProject(as("lead"), "team", "WEB"))).toBe("ok");
		expect(await code(projects.getProject(as("member"), "team", "WEB"))).toBe("NOT_FOUND");
		const [row] = await audits("taskline.project.create");
		expect(row).toMatchObject({ targetType: "taskline-project", targetId: created.id, actorId: "admin-1" });
	});

	it("lists every team project with filters, and none of a sandbox's", async () => {
		const { lead } = await setUp();
		await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		await adminProjects.create(admin(), {
			key: "OPS",
			name: "Operations",
			leadId: null,
			visibility: "private",
			color: "red",
		});
		await workspaces.startSandbox(as("member"));
		const all = await adminProjects.list(admin(), listInput(adminProjectList));
		expect(all.items.map((item) => item.key)).toEqual(["OPS", "WEB"]);
		const unled = await adminProjects.list(admin(), listInput(adminProjectList, { lead: "none" }));
		expect(unled.items.map((item) => item.key)).toEqual(["OPS"]);
		const found = await adminProjects.list(admin(), listInput(adminProjectList, { q: "web" }));
		expect(found.items.map((item) => item.key)).toEqual(["WEB"]);
	});

	it("deletes only with the key typed again, and never hands the key out again", async () => {
		const { lead } = await setUp();
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Hero" });
		expect(await fields(adminProjects.remove(admin(), { id: created.id, confirmKey: "WEX" }))).toEqual(["confirmKey"]);
		await adminProjects.remove(admin(), { id: created.id, confirmKey: "web" });
		expect(await code(adminProjects.get(admin(), created.id))).toBe("NOT_FOUND");
		expect(await adminProjects.isKeyFree(admin(), "WEB")).toBe(false);
		expect(
			await fields(
				adminProjects.create(admin(), { key: "WEB", name: "Again", leadId: null, visibility: "team", color: "teal" }),
			),
		).toEqual(["key"]);
		const [row] = await audits("taskline.project.delete");
		expect(row?.before).toMatchObject({ key: "WEB", tasks: 1 });
	});

	it("edits the details from their version, and refuses a stale save", async () => {
		const { lead } = await setUp();
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const input = {
			id: created.id,
			visibility: "team" as const,
			color: "blue" as const,
			startOn: null,
			targetOn: null,
		};
		const saved = await adminProjects.update(admin(), { ...input, updatedAt: String(created.version), name: "Site" });
		expect(saved).toMatchObject({ name: "Site", color: "blue", version: created.version + 1 });
		expect(
			await code(adminProjects.update(admin(), { ...input, updatedAt: String(created.version), name: "Old" })),
		).toBe("CONFLICT");
		const [row] = await audits("taskline.project.update");
		expect(row).toMatchObject({ before: { name: "Website", color: "teal" }, after: { name: "Site", color: "blue" } });
	});

	it("hands the project to a new lead; the old one stays on as a member", async () => {
		const { lead, member } = await setUp();
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const after = await adminProjects.transferLead(admin(), { id: created.id, memberId: member.id });
		expect(after.lead?.id).toBe(member.id);
		expect(Object.fromEntries(after.projectMembers.map((each) => [each.name, each.role]))).toEqual({
			Lead: "member",
			Member: "lead",
		});
	});

	it("archives and restores, and exports the tasks as CSV and everything as JSON", async () => {
		const { lead } = await setUp();
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const hero = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Hero, with a comma" });
		// Task 54: a milestone and a dependency travel in the JSON.
		const beta = await timeline.createMilestone(as("lead"), { ws: "team", key: "WEB", name: "Beta" });
		const copy = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Copy", milestoneId: beta.id });
		await timeline.addDependency(as("lead"), { ws: "team", ref: copy.ref, relation: "blocked_by", other: hero.ref });
		expect((await adminProjects.setArchived(admin(), { id: created.id, archived: true })).archived).toBe(true);
		expect(await code(tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "No" }))).toBe("FORBIDDEN");
		expect((await adminProjects.setArchived(admin(), { id: created.id, archived: false })).status).toBe("active");
		const csv = await adminProjects.exportProject(admin(), { id: created.id, format: "csv" });
		expect(csv.content.split("\n")[1]).toContain('WEB-1,"Hero, with a comma"');
		const json = JSON.parse((await adminProjects.exportProject(admin(), { id: created.id, format: "json" })).content);
		expect(json.tasks).toEqual([
			expect.objectContaining({ ref: "WEB-1", status: "To do", milestone: null }),
			expect.objectContaining({ ref: "WEB-2", milestone: "Beta" }),
		]);
		expect(json.milestones).toEqual([{ name: "Beta", description: "", dueOn: null, completedAt: null }]);
		expect(json.dependencies).toEqual([{ blocker: "WEB-1", blocked: "WEB-2" }]);
		expect(await audits("taskline.project.export")).toHaveLength(2);
	});
});

describe("members", () => {
	beforeEach(setUp);

	it("searches accounts not on the team, never guests, and adds them", async () => {
		await setUp();
		const found = await members.searchAccounts(admin(), "");
		expect(found.map((option) => option.value).sort()).toEqual(["admin-1", "newcomer", "unverified"]);
		expect(await fields(members.add(admin(), { userIds: ["guest"], role: "member" }))).toEqual(["userIds"]);
		expect(await members.add(admin(), { userIds: ["newcomer"], role: "viewer" })).toEqual({ added: 1 });
		expect(await fields(members.add(admin(), { userIds: ["newcomer"], role: "viewer" }))).toEqual(["userIds"]);
		const page = await members.list(admin(), listInput(adminMemberList, { role: "viewer" }));
		expect(page.items).toEqual([expect.objectContaining({ name: "Newcomer", email: "newcomer@example.com" })]);
		expect(await audits("taskline.member.add")).toHaveLength(1);
	});

	it("deactivates a member: their open tasks go to someone else and they lose access", async () => {
		const { lead, member } = await setUp();
		await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const task = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Hero", assigneeId: member.id });
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Mine", assigneeId: lead.id });
		const result = await members.deactivate(admin(), { id: member.id, reassignTo: lead.id });
		expect(result).toEqual({ reassigned: 1 });
		const [moved] = await env.db.select().from(schema.tlTask).where(eq(schema.tlTask.id, task.id));
		expect(moved?.assigneeId).toBe(lead.id);
		const entries = await env.db
			.select()
			.from(schema.tlActivity)
			.where(and(eq(schema.tlActivity.taskId, task.id), eq(schema.tlActivity.kind, "task.updated")));
		expect(entries.at(-1)?.data).toMatchObject({ field: "assigneeId", from: member.id, to: lead.id, via: "admin" });
		expect(await code(workspaces.getWorkspace(as("member"), "team"))).toBe("NOT_FOUND");
		expect(await code(tasks.getTask(as("member"), "team", "WEB-1"))).toBe("NOT_FOUND");
		await members.reactivate(admin(), { id: member.id });
		expect(await code(workspaces.getWorkspace(as("member"), "team"))).toBe("ok");
		expect((await audits("taskline.member.deactivate"))[0]?.after).toMatchObject({ reassigned: 1 });
	});

	it("deactivating with nobody to take the tasks leaves them unassigned; a bad target is refused", async () => {
		const { lead, member } = await setUp();
		await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const task = await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Hero", assigneeId: member.id });
		expect(await fields(members.deactivate(admin(), { id: member.id, reassignTo: member.id }))).toEqual(["reassignTo"]);
		await members.deactivate(admin(), { id: member.id, reassignTo: null });
		const [row] = await env.db.select().from(schema.tlTask).where(eq(schema.tlTask.id, task.id));
		expect(row?.assigneeId).toBeNull();
	});

	it("changes a member's role, title and capacity", async () => {
		const { member } = await setUp();
		const after = await members.update(admin(), {
			id: member.id,
			role: "viewer",
			title: "Designer",
			capacityMinutesWeek: 1200,
		});
		expect(after).toMatchObject({ role: "viewer", title: "Designer", capacityMinutesWeek: 1200 });
		expect((await audits("taskline.member.update"))[0]).toMatchObject({
			before: { role: "member", title: "", capacityMinutesWeek: 2400 },
			after: { role: "viewer", title: "Designer", capacityMinutesWeek: 1200 },
		});
	});
});

describe("invitations", () => {
	beforeEach(setUp);

	it("invites by email; the first verified session with that address joins the team and the project", async () => {
		const { lead } = await setUp();
		const project = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "private",
			color: "teal",
		});
		const invitation = await invitations.invite(admin(), {
			email: "Newcomer@Example.com",
			role: "member",
			projectId: project.id,
		});
		expect(invitation).toMatchObject({ email: "newcomer@example.com", project: { key: "WEB" }, expired: false });
		await vi.waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]).toMatchObject({ to: "newcomer@example.com", template: "taskline-invite" });
		expect(String(sent[0]?.data.url)).toContain(encodeURIComponent("/app/taskline/team/p/WEB"));
		expect(await code(projects.getProject(as("newcomer"), "team", "WEB"))).toBe("NOT_FOUND");
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(1);
		expect((await projects.getProject(as("newcomer"), "team", "WEB")).role).toBe("member");
		expect(await invitations.list(admin())).toEqual([]);
		// Accepting again does nothing.
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(0);
	});

	it("refuses a second open invitation and an address already on the team", async () => {
		await setUp();
		await invitations.invite(admin(), { email: "newcomer@example.com", role: "member", projectId: null });
		expect(
			await fields(invitations.invite(admin(), { email: "newcomer@example.com", role: "viewer", projectId: null })),
		).toEqual(["email"]);
		expect(
			await fields(invitations.invite(admin(), { email: "member@example.com", role: "member", projectId: null })),
		).toEqual(["email"]);
	});

	it("an unverified address, an expired or a revoked invitation joins nobody", async () => {
		await setUp();
		await invitations.invite(admin(), { email: "late@example.com", role: "member", projectId: null });
		expect(await invitations.acceptInvitations(env.db, "unverified")).toBe(0);
		const revoked = await invitations.invite(admin(), {
			email: "newcomer@example.com",
			role: "member",
			projectId: null,
		});
		await invitations.revoke(admin(), { id: revoked.id });
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(0);
		const expired = await invitations.invite(admin(), {
			email: "newcomer@example.com",
			role: "member",
			projectId: null,
		});
		await env.db
			.update(schema.tlInvitation)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(schema.tlInvitation.id, expired.id));
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(0);
		expect(await code(workspaces.getWorkspace(as("newcomer"), "team"))).toBe("NOT_FOUND");
		// Resending starts the days again, and then it works.
		await invitations.resend(admin(), { id: expired.id });
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(1);
		expect(await audits("taskline.invite.revoke")).toHaveLength(1);
	});

	it("an invitation reactivates a deactivated member", async () => {
		const { member } = await setUp();
		await members.deactivate(admin(), { id: member.id, reassignTo: null });
		await invitations.invite(admin(), { email: "member@example.com", role: "viewer", projectId: null });
		expect(await invitations.acceptInvitations(env.db, "member")).toBe(1);
		expect((await workspaces.getWorkspace(as("member"), "team")).me).toMatchObject({
			role: "viewer",
			deactivated: false,
		});
	});
});

describe("settings and workflows", () => {
	beforeEach(setUp);

	it("saves the workspace from its version; refuses a reserved slug, a bad zone and limits below usage", async () => {
		await setUp();
		const workspace = await settings.getWorkspace(admin());
		const input = {
			updatedAt: workspace.updatedAt,
			name: "Himal Studio",
			slug: "studio",
			settings: { ...workspace.settings, quotas: { ...workspace.settings.quotas } },
		};
		expect(await fields(settings.updateWorkspace(admin(), { ...input, slug: "inbox" }))).toEqual(["slug"]);
		expect(
			await fields(
				settings.updateWorkspace(admin(), { ...input, settings: { ...input.settings, timeZone: "Mars/Olympus" } }),
			),
		).toEqual(["timeZone"]);
		await projects.createProject(
			{ db: env.db, user: { id: "admin-1", isGuest: false, permissions: [...ALL] } },
			{ ws: "team", key: "WEB", name: "Website" },
		);
		expect(
			await fields(
				settings.updateWorkspace(admin(), {
					...input,
					settings: { ...input.settings, quotas: { ...input.settings.quotas, statusesPerProject: 4 } },
				}),
			),
		).toEqual(["statusesPerProject"]);
		const saved = await settings.updateWorkspace(admin(), input);
		expect(saved).toMatchObject({
			name: "Himal Studio",
			slug: "studio",
			updatedAt: String(Number(workspace.updatedAt) + 1),
		});
		expect(await code(settings.updateWorkspace(admin(), input))).toBe("CONFLICT");
		// The team is now at /app/taskline/studio.
		expect((await workspaces.getWorkspace(as("lead"), "studio")).workspace.segment).toBe("studio");
		expect(await audits("taskline.settings.update")).toHaveLength(1);
	});

	it("new projects start with the admin's statuses; a turned-off task type is refused", async () => {
		await setUp();
		const workflows = await settings.getWorkflows(admin());
		expect(workflows).toMatchObject({ custom: false, taskTypes: ["task", "bug", "story", "epic"] });
		expect(
			await fields(
				settings.updateWorkflows(admin(), {
					updatedAt: workflows.updatedAt,
					statuses: [
						{ name: "Open", category: "unstarted", color: "blue" },
						{ name: "Stopped", category: "canceled", color: "red" },
					],
					taskTypes: ["task"],
				}),
			),
		).toEqual(["statuses"]);
		await settings.updateWorkflows(admin(), {
			updatedAt: workflows.updatedAt,
			statuses: [
				{ name: "Open", category: "unstarted", color: "blue" },
				{ name: "Doing", category: "started", color: "amber" },
				{ name: "Shipped", category: "completed", color: "green" },
			],
			taskTypes: ["task", "bug"],
		});
		const created = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: null,
			visibility: "team",
			color: "teal",
		});
		expect(created.statuses.map((status) => status.name)).toEqual(["Open", "Doing", "Shipped"]);
		await workspaceRepo.ensureTeamWorkspace(env.db);
		const manager = { db: env.db, user: { id: "admin-1", isGuest: false, permissions: [...ALL] } };
		expect(await fields(tasks.createTask(manager, { ws: "team", key: "WEB", title: "Epic", type: "epic" }))).toEqual([
			"type",
		]);
		expect((await tasks.createTask(manager, { ws: "team", key: "WEB", title: "Bug", type: "bug" })).type).toBe("bug");
		expect((await tasks.listTasks(manager, "team", "WEB")).taskTypes).toEqual(["task", "bug"]);
	});

	it("keeps workspace labels unique and shares them with every project", async () => {
		const { lead } = await setUp();
		await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		const labels = await settings.createLabel(admin(), { name: "Urgent", color: "red" });
		expect(await fields(settings.createLabel(admin(), { name: "urgent", color: "blue" }))).toEqual(["name"]);
		expect((await tasks.listTasks(as("lead"), "team", "WEB")).labels.map((label) => label.name)).toContain("Urgent");
		const [label] = labels;
		if (!label) throw new Error("label");
		await settings.updateLabel(admin(), { id: label.id, name: "Hot", color: "red" });
		await settings.deleteLabel(admin(), { id: label.id });
		expect((await settings.getWorkflows(admin())).labels).toEqual([]);
		expect(await audits("taskline.label.delete")).toHaveLength(1);
	});
});

describe("overview and activity", () => {
	beforeEach(setUp);

	it("counts the team's work and the sandboxes, and lists the history with filters", async () => {
		const { lead } = await setUp();
		const project = await adminProjects.create(admin(), {
			key: "WEB",
			name: "Website",
			leadId: lead.id,
			visibility: "team",
			color: "teal",
		});
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Late", dueOn: "2020-01-01" });
		await tasks.createTask(as("lead"), { ws: "team", key: "WEB", title: "Open" });
		await workspaces.startSandbox(as("member"));
		const numbers = await overview.getOverview(admin());
		expect(numbers.stats).toMatchObject({ activeProjects: 1, openTasks: 2, overdueTasks: 1, doneThisWeek: 0 });
		expect(numbers.weeks).toHaveLength(12);
		expect(numbers.weeks.at(-1)?.created).toBe(2);
		expect(numbers.sandboxes).toMatchObject({ total: 1, guests: 0 });
		expect(numbers.sandboxes.projects).toBeGreaterThan(0);
		expect(numbers.members).toEqual({ active: 2, invited: 0, loggedThisWeek: 0 });

		const history = await activity.list(
			admin(),
			listInput(adminActivityList, { project: project.id, kind: "task.created" }),
		);
		expect(history.items).toHaveLength(2);
		expect(history.items[0]).toMatchObject({ project: { key: "WEB" }, task: { ref: "WEB-2" } });
		expect(history.members.map((member) => member.name)).toContain("Lead");
		const options = await activity.options(admin());
		expect(options.projects.map((each) => each.key)).toEqual(["WEB"]);
	});
});

describe("weeks", () => {
	it("starts a week on the workspace's day", () => {
		// 2026-10-31 is a Saturday: the week began Sunday the 25th (Nepal), Monday the 26th elsewhere.
		expect(overview.weekOf("2026-10-31", 0)).toBe("2026-10-25");
		expect(overview.weekOf("2026-10-31", 1)).toBe("2026-10-26");
		expect(overview.weekOf("2026-10-25", 0)).toBe("2026-10-25");
		const weeks = overview.bucketWeeks(
			"2026-10-11",
			3,
			0,
			[{ day: "2026-10-24", total: 2 }],
			[{ day: "2026-10-30", total: 1 }],
		);
		expect(weeks).toEqual([
			{ week: "2026-10-11", created: 0, completed: 0 },
			{ week: "2026-10-18", created: 2, completed: 0 },
			{ week: "2026-10-25", created: 0, completed: 1 },
		]);
	});
});
