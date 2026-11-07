import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/features/rbac/types";
import { suggestKey } from "@/features/taskline/schema";
import { isAppError } from "@/lib/errors";
import { addDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import * as schema from "@/server/db/schema";
import type { EmailMessage, EmailProvider } from "@/server/email/types";
import type { TasklineServices } from "@/server/taskline/access";
import * as invitations from "@/server/taskline/admin/invitations";
import * as adminProjects from "@/server/taskline/admin/projects";
import * as automations from "@/server/taskline/automations/service";
import * as collab from "@/server/taskline/collab/service";
import { automationTimeTriggers, runTasklineCron } from "@/server/taskline/cron";
import * as fields from "@/server/taskline/fields/service";
import { sendDigests } from "@/server/taskline/notify/deliver";
import * as inbox from "@/server/taskline/notify/inbox";
import * as projects from "@/server/taskline/projects/service";
import * as tasks from "@/server/taskline/tasks/service";
import * as time from "@/server/taskline/time/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * What the review of Part 5 found (Task 58): each test fails without its fix. An invited
 * viewer's project role, archived projects being read-only, the daily job's instant
 * emails, a time rule's run, a rule assigning nobody, a deleted project's files, emails
 * to who lost access, copied billable time, and the key suggested from a name.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "viewer", name: "Vera Viewer", email: "viewer@example.com" },
			{ id: "newcomer", name: "Nima New", email: "newcomer@example.com", emailVerified: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string): TasklineServices => ({
	db: env.db,
	user: { id, isGuest: false, permissions: [] },
	deliver: () => {},
});
const admin = () => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: ["taskline:read", "taskline:manage"] } as Actor,
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

const inboxOf = () => {
	const sent: EmailMessage[] = [];
	const provider: EmailProvider = {
		name: "console",
		send: async (message) => {
			sent.push(message);
			return { id: `fake-${sent.length}` };
		},
	};
	return { sent, provider };
};

let team: Awaited<ReturnType<typeof workspaceRepo.ensureTeamWorkspace>>;
let member: { id: string };

beforeEach(async () => {
	await env.reset();
	team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(tx, [
			{ workspaceId: team.id, userId: "lead", displayName: "Lena Lead" },
			{ workspaceId: team.id, userId: "member", displayName: "Mohan Member" },
			{ workspaceId: team.id, userId: "viewer", displayName: "Vera Viewer", role: "viewer" },
		]),
	);
	const found = rows.find((row) => row.userId === "member");
	if (!found) throw new Error("no member");
	member = found;
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	await projects.createProject(as("lead"), { ws, key, name: "Website" });
});

describe("an invitation naming a project", () => {
	const invite = async (role: "member" | "viewer", projectKey = key) => {
		const project = await projects.getProject(as("lead"), ws, projectKey);
		await env.db.insert(schema.tlInvitation).values({
			workspaceId: team.id,
			email: "newcomer@example.com",
			role,
			projectId: project.id,
			expiresAt: new Date(Date.now() + 86_400_000),
		});
	};

	it("makes a viewer a viewer there, without edit rights", async () => {
		await invite("viewer");
		expect(await invitations.acceptInvitations(env.db, "newcomer")).toBe(1);
		const seen = await projects.getProject(as("newcomer"), ws, key);
		expect(seen.role).toBe("viewer");
		expect(seen.can).toMatchObject({ edit: false, manage: false });
	});

	it("still makes a member a member there", async () => {
		await invite("member");
		await invitations.acceptInvitations(env.db, "newcomer");
		expect((await projects.getProject(as("newcomer"), ws, key)).role).toBe("member");
	});
});

describe("an archived project", () => {
	it("only reads: no comments, no settings, no purging; its lead can restore it", async () => {
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Logo" });
		await tasks.trashTask(as("lead"), ws, task.ref);
		const kept = await tasks.createTask(as("lead"), { ws, key, title: "Kept" });
		await projects.setProjectArchived(as("lead"), { ws, key, archived: true });

		const seen = await projects.getProject(as("lead"), ws, key);
		expect(seen.can).toMatchObject({ view: true, comment: false, edit: false, manage: true });
		expect(await code(collab.addComment(as("member"), { ws, ref: kept.ref, body: "<p>Hello</p>" }))).toBe("FORBIDDEN");
		expect(await code(tasks.purgeTask(as("lead"), ws, task.ref))).toBe("FORBIDDEN");
		expect(
			await code(
				fields.createField(as("lead"), { ws, key, field: { type: "checkbox", name: "Signed", required: false } }),
			),
		).toBe("FORBIDDEN");
		expect(await code(projects.setProjectState(as("lead"), { ws, key, status: "paused" }))).toBe("FORBIDDEN");
		// Someone who can't run it can't restore it either.
		expect(await code(projects.setProjectArchived(as("member"), { ws, key, archived: false }))).toBe("FORBIDDEN");

		await projects.setProjectArchived(as("lead"), { ws, key, archived: false });
		expect(await code(collab.addComment(as("member"), { ws, ref: kept.ref, body: "<p>Hello</p>" }))).toBe("ok");
	});
});

describe("the daily job", () => {
	it("sends what its steps made instant in the same run", async () => {
		await inbox.saveNotifySettings(as("member"), { modes: { due: "instant" }, locale: null });
		await tasks.createTask(as("lead"), {
			ws,
			key,
			title: "Due",
			assigneeId: member.id,
			dueOn: addDays(today(), 1),
		});
		await env.db.delete(schema.tlNotification);
		const { sent, provider } = inboxOf();
		const result = await runTasklineCron(env.db, { provider });
		expect(result.instant).toMatchObject({ ok: true, sent: 1 });
		expect(sent.map((message) => message.to)).toEqual(["member@example.com"]);
		// A second run has nothing new.
		expect((await runTasklineCron(env.db, { provider })).instant).toMatchObject({ ok: true, sent: 0 });
		expect(sent).toHaveLength(1);
	});

	it("doesn't use up a time rule's run on a task that doesn't match yet", async () => {
		const rule = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: {
				name: "Remind",
				enabled: true,
				trigger: { type: "due_soon", days: 5 },
				conditions: [{ type: "assignee", is: "any" }],
				actions: [{ type: "set_priority", priority: 4 }],
			},
		});
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Later", dueOn: addDays(today(), 3) });
		const runs = () =>
			env.db.select().from(schema.tlAutomationRun).where(eq(schema.tlAutomationRun.automationId, rule.id));

		await automationTimeTriggers(env.db);
		expect(await runs()).toHaveLength(0);
		expect((await tasks.getTask(as("lead"), ws, task.ref)).priority).toBe(0);

		await tasks.patchTask(as("lead"), { ws, ref: task.ref, assigneeId: member.id });
		await automationTimeTriggers(env.db);
		expect((await tasks.getTask(as("lead"), ws, task.ref)).priority).toBe(4);
		// Once per task and due date, as before.
		await automationTimeTriggers(env.db);
		expect(await runs()).toHaveLength(1);
	});
});

describe("a rule assigning the lead", () => {
	it("fails on a project with no lead, and leaves the assignee alone", async () => {
		await env.db.update(schema.tlProject).set({ leadId: null }).where(eq(schema.tlProject.key, key));
		const rule = await automations.createAutomation(as("lead"), {
			ws,
			key,
			automation: {
				name: "To the lead",
				enabled: true,
				trigger: { type: "task_created" },
				conditions: [],
				actions: [{ type: "assign", to: "lead" }],
			},
		});
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Mine", assigneeId: member.id });
		expect(task.assigneeId).toBe(member.id);
		const [run] = await env.db
			.select()
			.from(schema.tlAutomationRun)
			.where(eq(schema.tlAutomationRun.automationId, rule.id));
		expect(run?.outcome).toBe("failed");
	});
});

describe("deleting a project", () => {
	it("marks its tasks' and comments' files removed, for the daily cleanup", async () => {
		const upload = async (owner: string) => {
			const [row] = await env.db
				.insert(schema.attachment)
				.values({
					publicId: `test/taskline/${crypto.randomUUID()}`,
					version: 1,
					resourceType: "image",
					format: "png",
					bytes: 10,
					ownerId: owner,
				})
				.returning();
			return row?.id ?? "";
		};
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Logo" });
		const ids = [await upload("lead"), await upload("lead")];
		await collab.addTaskFiles(as("lead"), { ws, ref: task.ref, ids: [ids[0] ?? ""] });
		await collab.addComment(as("lead"), { ws, ref: task.ref, body: "<p>See</p>", attachmentIds: [ids[1] ?? ""] });

		const project = await projects.getProject(as("lead"), ws, key);
		await adminProjects.remove(admin(), { id: project.id, confirmKey: key });
		const files = await env.db.select().from(schema.attachment).where(inArray(schema.attachment.id, ids));
		expect(files).toHaveLength(2);
		expect(files.every((file) => file.deletedAt !== null)).toBe(true);
	});
});

describe("email", () => {
	const notificationOf = async (ref: string) => {
		const task = await tasks.getTask(as("lead"), ws, ref);
		const [row] = await env.db
			.select()
			.from(schema.tlNotification)
			.where(and(eq(schema.tlNotification.taskId, task.id), eq(schema.tlNotification.userId, "member")));
		if (!row) throw new Error("no notification");
		return row;
	};

	it("doesn't reach a member deactivated since the notice was made", async () => {
		await inbox.saveNotifySettings(as("member"), { modes: { assigned: "digest" }, locale: null });
		const task = await tasks.createTask(as("lead"), { ws, key, title: "Secret", assigneeId: member.id });
		await env.db.update(schema.tlMember).set({ deactivatedAt: new Date() }).where(eq(schema.tlMember.id, member.id));
		const { sent, provider } = inboxOf();
		await sendDigests(env.db, { provider });
		expect(sent).toEqual([]);
		// Never again, even if they come back: the moment passed.
		expect((await notificationOf(task.ref)).email).toBe("none");
	});

	it("doesn't reach someone taken off a private project, and still reaches the team's", async () => {
		await inbox.saveNotifySettings(as("member"), { modes: { assigned: "digest" }, locale: null });
		await projects.createProject(as("lead"), { ws, key: "SEC", name: "Security", visibility: "private" });
		await projects.setProjectMember(as("lead"), { ws, key: "SEC", memberId: member.id, role: "member" });
		await tasks.createTask(as("lead"), { ws, key: "SEC", title: "Hidden", assigneeId: member.id });
		await tasks.createTask(as("lead"), { ws, key, title: "Visible", assigneeId: member.id });
		await projects.removeProjectMember(as("lead"), { ws, key: "SEC", memberId: member.id });
		const { sent, provider } = inboxOf();
		await sendDigests(env.db, { provider });
		expect(sent).toHaveLength(1);
		expect(sent[0]?.text).toContain("Visible");
		expect(sent[0]?.text).not.toContain("Hidden");
	});
});

describe("copying last week", () => {
	it("keeps billable and non-billable time apart", async () => {
		const task = await tasks.createTask(as("member"), { ws, key, title: "Work" });
		const lastWeek = addDays(today(), -7);
		await time.logTime(as("member"), { ws, ref: task.ref, onDay: lastWeek, minutes: 60, billable: true });
		await time.logTime(as("member"), { ws, ref: task.ref, onDay: lastWeek, minutes: 120 });
		expect(await time.copyLastWeek(as("member"), ws, today())).toEqual({ copied: 2, skipped: 0 });
		const copied = await env.db.select().from(schema.tlTimeEntry).where(eq(schema.tlTimeEntry.onDay, today()));
		expect(copied.map((row) => [row.minutes, row.billable]).sort()).toEqual([
			[120, false],
			[60, true],
		]);
	});
});

describe("the key suggested from a name", () => {
	it("is the initials of several words, or a single word's first letters", () => {
		expect(suggestKey("Website relaunch")).toBe("WR");
		expect(suggestKey("Go   live")).toBe("GL");
		expect(suggestKey("Operations")).toBe("OPE");
		expect(suggestKey("A")).toBe("");
		expect(suggestKey("वेबसाइट")).toBe("");
	});
});
