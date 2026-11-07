import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { EmailMessage, EmailProvider } from "@/server/email/types";
import type { TasklineServices } from "@/server/taskline/access";
import * as collab from "@/server/taskline/collab/service";
import { dueNotices, expireInvitations, purgeTrash, runTasklineCron } from "@/server/taskline/cron";
import { COALESCE_MS, deliverInstant, sendDigests } from "@/server/taskline/notify/deliver";
import * as inbox from "@/server/taskline/notify/inbox";
import * as projects from "@/server/taskline/projects/service";
import { claimSandbox, seedSandbox } from "@/server/taskline/sandbox";
import * as tasks from "@/server/taskline/tasks/service";
import * as workspaceRepo from "@/server/taskline/workspace/repository";
import { createTestDb } from "../utils/test-db";

/**
 * Taskline's collaboration on PGlite (Task 50, decision 0214): comments and who they
 * may mention, watchers, files, the notifications each write produces (never to the
 * actor, never emailed to placeholders or guests), the instant email with its
 * coalescing, the digest, the daily cron's idempotency, the inbox and the settings.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values([
			{ id: "lead", name: "Lena Lead", email: "lead@example.com" },
			{ id: "member", name: "Mohan Member", email: "member@example.com" },
			{ id: "other", name: "Olga Other", email: "other@example.com" },
			{ id: "account", name: "Arun Account", email: "account@example.com" },
			{ id: "guest", name: "Guest", email: "guest@anonymous.placeholder.invalid", isAnonymous: true },
		]);
	});
}, 60_000);
afterAll(() => env.close());

/** The services a caller gets, with a deliverer that only records what it's handed. */
let delivered: string[] = [];
const as = (id: string): TasklineServices => ({
	db: env.db,
	user: { id, isGuest: id === "guest", permissions: [] },
	deliver: (ids) => delivered.push(...ids),
});
const ws = "team";

/** An email provider that keeps what it's given. */
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

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

const mention = (memberId: string, name: string) =>
	`<span data-type="mention" class="mention" data-id="${memberId}" data-label="${name}">@${name}</span>`;

/** The team: lead, member, other (a member who isn't on the private project); WEB (team) and SEC (private). */
async function setUp() {
	await env.reset();
	delivered = [];
	const team = await workspaceRepo.ensureTeamWorkspace(env.db);
	const rows = await env.db.transaction((tx) =>
		workspaceRepo.insertMembers(
			tx,
			(["lead", "member", "other"] as const).map((id) => ({ workspaceId: team.id, userId: id, displayName: id })),
		),
	);
	const member = (id: string) => {
		const row = rows.find((each) => each.userId === id);
		if (!row) throw new Error(`no ${id}`);
		return row;
	};
	await env.db
		.update(schema.tlWorkspace)
		.set({ settings: { projectCreation: "members" } })
		.where(eq(schema.tlWorkspace.id, team.id));
	await projects.createProject(as("lead"), { ws, key: "WEB", name: "Website" });
	await projects.createProject(as("lead"), { ws, key: "SEC", name: "Security", visibility: "private" });
	await projects.setProjectMember(as("lead"), { ws, key: "SEC", memberId: member("member").id, role: "member" });
	delivered = [];
	await env.db.delete(schema.tlNotification);
	return { team, lead: member("lead"), member: member("member"), other: member("other") };
}

const notifications = (userId?: string) =>
	env.db
		.select()
		.from(schema.tlNotification)
		.where(userId ? eq(schema.tlNotification.userId, userId) : undefined)
		.orderBy(schema.tlNotification.createdAt);

beforeEach(async () => {
	await setUp();
});

describe("comments and mentions", () => {
	it("keeps only mentions of members who may see the task, read from the sanitized body", async () => {
		const { member, other } = await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "SEC", title: "Rotate the keys" });
		const stranger = crypto.randomUUID();
		const detail = await collab.addComment(as("lead"), {
			ws,
			ref: task.ref,
			body: `<p>${mention(member.id, "member")} ${mention(other.id, "other")} ${mention(stranger, "nobody")} <script>alert(1)</script>please look</p>`,
		});
		const comment = detail.comments.at(-1);
		expect(comment?.mentions).toEqual([member.id]);
		expect(comment?.html).not.toContain("script");
		expect(comment?.html).toContain('data-type="mention"');
		const told = await notifications();
		expect(told.map((row) => [row.userId, row.kind])).toEqual([["member", "mentioned"]]);
		expect(told[0]?.email).toBe("instant");
		expect(delivered).toEqual([told[0]?.id]);
	});

	it("tells watchers about a comment (a mentioned watcher once, as mentioned), never the author", async () => {
		const { member } = await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Hero copy", assigneeId: member.id });
		await collab.watchTask(as("other"), { ws, ref: task.ref, watching: true });
		await env.db.delete(schema.tlNotification);
		await collab.addComment(as("lead"), {
			ws,
			ref: task.ref,
			body: `<p>${mention(member.id, "member")} over to you</p>`,
		});
		const told = await notifications();
		expect(told.map((row) => [row.userId, row.kind]).sort()).toEqual([
			["member", "mentioned"],
			["other", "comment"],
		]);
		// The comment's kind waits for the digest by default; being mentioned is emailed at once.
		expect(told.find((row) => row.userId === "other")?.email).toBe("digest");
		// Unwatching stops it.
		await collab.watchTask(as("other"), { ws, ref: task.ref, watching: false });
		await env.db.delete(schema.tlNotification);
		await collab.addComment(as("member"), { ws, ref: task.ref, body: "<p>Done</p>" });
		expect((await notifications()).map((row) => row.userId)).toEqual(["lead"]);
	});

	it("lets authors edit their own comments, leads delete anyone's, and refuses empty ones", async () => {
		await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Footer" });
		const added = await collab.addComment(as("member"), { ws, ref: task.ref, body: "<p>First</p>" });
		const id = added.comments.at(-1)?.id ?? "";
		expect(await code(collab.updateComment(as("other"), { ws, ref: task.ref, id, body: "<p>Mine now</p>" }))).toBe(
			"FORBIDDEN",
		);
		expect(await code(collab.deleteComment(as("other"), { ws, ref: task.ref, id }))).toBe("FORBIDDEN");
		const edited = await collab.updateComment(as("member"), { ws, ref: task.ref, id, body: "<p>Second</p>" });
		expect(edited.comments.at(-1)?.editedAt).not.toBeNull();
		expect(await code(collab.addComment(as("member"), { ws, ref: task.ref, body: "<p> </p>" }))).toBe("BAD_REQUEST");
		const after = await collab.deleteComment(as("lead"), { ws, ref: task.ref, id });
		expect(after.comments).toEqual([]);
		const kinds = (await tasks.getTask(as("lead"), ws, task.ref)).activity.map((entry) => entry.kind);
		expect(kinds).toEqual(expect.arrayContaining(["comment.added", "comment.deleted"]));
	});

	it("links files to a comment and to a task, and removes them when the task is deleted for good", async () => {
		await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Logo" });
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
		const forComment = await upload("member");
		const forTask = await upload("lead");
		// Someone else's pending upload can't be used.
		expect(await code(collab.addTaskFiles(as("member"), { ws, ref: task.ref, ids: [forTask] }))).toBe("BAD_REQUEST");
		await collab.addComment(as("member"), {
			ws,
			ref: task.ref,
			body: "<p>See the file</p>",
			attachmentIds: [forComment],
		});
		await collab.addTaskFiles(as("lead"), { ws, ref: task.ref, ids: [forTask] });
		const linked = await env.db.select().from(schema.attachment);
		expect(linked.map((row) => row.entityType).sort()).toEqual(["tl_comment", "tl_task"]);
		await tasks.trashTask(as("lead"), ws, task.ref);
		await tasks.purgeTask(as("lead"), ws, task.ref);
		const removed = await env.db.select().from(schema.attachment);
		expect(removed.every((row) => row.deletedAt !== null)).toBe(true);
	});
});

describe("who hears about changes", () => {
	it("tells an assignee, unless they assigned themselves; watchers hear about status changes", async () => {
		const { member } = await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Navigation" });
		await tasks.patchTask(as("member"), { ws, ref: task.ref, assigneeId: member.id });
		expect(await notifications()).toEqual([]);
		await tasks.patchTask(as("lead"), { ws, ref: task.ref, assigneeId: null });
		await tasks.patchTask(as("lead"), { ws, ref: task.ref, assigneeId: member.id });
		const assigned = await notifications("member");
		expect(assigned.map((row) => [row.kind, row.data.actor, row.data.ref])).toEqual([["assigned", "lead", "WEB-1"]]);
		const { statuses } = await tasks.listTasks(as("lead"), ws, "WEB");
		const doing = statuses.find((status) => status.category === "started");
		await tasks.moveTask(as("lead"), { ws, ref: task.ref, statusId: doing?.id ?? "", position: "a5" });
		const moved = (await notifications("member")).at(-1);
		expect(moved?.kind).toBe("status");
		expect(moved?.data.status).toBe(doing?.name);
	});

	it("never tells someone who can't see the project, and tells a new project member", async () => {
		const { other } = await setUp();
		const task = await tasks.createTask(as("lead"), { ws, key: "SEC", title: "Audit" });
		// `other` is a valid assignee (an active workspace member) but can't see SEC: no notice.
		await tasks.patchTask(as("lead"), { ws, ref: task.ref, assigneeId: other.id });
		expect(await notifications("other")).toEqual([]);
		await projects.setProjectMember(as("lead"), { ws, key: "SEC", memberId: other.id, role: "viewer" });
		expect((await notifications("other")).map((row) => row.kind)).toEqual(["added"]);
	});

	it("follows the recipient's modes: off writes nothing, digest isn't emailed at once", async () => {
		const { member } = await setUp();
		await inbox.saveNotifySettings(as("member"), { modes: { assigned: "off", mentioned: "digest" }, locale: "ne" });
		const settings = await inbox.getNotifySettings(as("member"));
		expect(settings.modes).toEqual({ assigned: "off", mentioned: "digest" });
		expect(settings.locale).toBe("ne");
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Search", assigneeId: member.id });
		expect(await notifications("member")).toEqual([]);
		await collab.addComment(as("lead"), { ws, ref: task.ref, body: `<p>${mention(member.id, "member")}</p>` });
		const [row] = await notifications("member");
		expect(row?.email).toBe("digest");
		expect(delivered).toEqual([]);
		// A mode equal to the default isn't stored: it follows the default.
		await inbox.saveNotifySettings(as("member"), { modes: { assigned: "instant" }, locale: null });
		expect((await inbox.getNotifySettings(as("member"))).modes).toEqual({});
	});

	it("never emails placeholders or guests: a sandbox's teammates have no account, a guest's notices stay in the inbox", async () => {
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		const seeded = await notifications("guest");
		expect(seeded.map((row) => row.kind).sort()).toEqual(["assigned", "mentioned"]);
		expect(seeded.every((row) => row.email === "none")).toBe(true);
		const guest = { ...as("guest"), user: { id: "guest", isGuest: true, permissions: [] } };
		const board = await tasks.listTasks(guest, "sandbox", "WEB");
		const placeholder = board.members.find((member) => member.placeholder);
		const detail = await collab.addComment(guest, {
			ws: "sandbox",
			ref: "WEB-1",
			body: `<p>${mention(placeholder?.id ?? "", "Asha")} hello</p>`,
		});
		// The mention is kept (Asha may see the task) but tells nobody: she has no account.
		expect(detail.comments.at(-1)?.mentions).toEqual([placeholder?.id]);
		expect((await notifications()).length).toBe(seeded.length);
	});
});

describe("email", () => {
	it("sends one instant email per recipient and task, and holds a second one within five minutes for the digest", async () => {
		const { member } = await setUp();
		const { sent, provider } = inboxOf();
		const task = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Pricing page", assigneeId: member.id });
		const now = new Date();
		expect(await deliverInstant(env.db, delivered, { provider, now })).toMatchObject({ sent: 1 });
		expect(sent.map((message) => [message.to, message.subject])).toEqual([
			["member@example.com", "Update on WEB-1 · Pricing page · Taskline"],
		]);
		expect(sent[0]?.text).toContain("lead assigned you WEB-1");
		expect(sent[0]?.text).toContain("/app/taskline/team/t/WEB-1");
		// Sending the same ids again sends nothing: they're claimed.
		expect(await deliverInstant(env.db, delivered, { provider, now })).toMatchObject({ sent: 0 });
		delivered = [];
		await collab.addComment(as("lead"), { ws, ref: task.ref, body: `<p>${mention(member.id, "member")} ping</p>` });
		expect(await deliverInstant(env.db, delivered, { provider, now })).toMatchObject({ sent: 0, deferred: 1 });
		const [, held] = await notifications("member");
		expect(held?.email).toBe("digest");
		// The digest picks it up, once.
		const later = new Date(now.getTime() + COALESCE_MS * 3);
		expect(await sendDigests(env.db, { provider, now: later })).toMatchObject({ sent: 1 });
		expect(sent.at(-1)?.subject).toContain("1");
		expect(await sendDigests(env.db, { provider, now: later })).toMatchObject({ sent: 0 });
	});

	it("writes the email in the recipient's language, and leaves what they already read out of the digest", async () => {
		const { member } = await setUp();
		const { sent, provider } = inboxOf();
		await inbox.saveNotifySettings(as("member"), { modes: { assigned: "digest" }, locale: "ne" });
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "One", assigneeId: member.id });
		const second = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Two", assigneeId: member.id });
		const rows = await notifications("member");
		const read = rows.find((row) => row.taskId === second.id);
		await inbox.markRead(as("member"), { ids: [read?.id ?? ""], read: true });
		await sendDigests(env.db, { provider });
		expect(sent).toHaveLength(1);
		expect(sent[0]?.html).toContain('lang="ne"');
		expect(sent[0]?.text).toContain("WEB-1");
		expect(sent[0]?.text).not.toContain("WEB-2");
	});
});

describe("the daily job", () => {
	it("tells assignees about tasks due tomorrow and overdue ones, once per due date", async () => {
		const { member } = await setUp();
		const now = new Date("2026-10-31T01:15:00Z"); // 07:00 in Kathmandu
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Due", assigneeId: member.id, dueOn: "2026-11-01" });
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Late", assigneeId: member.id, dueOn: "2026-10-30" });
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Today", assigneeId: member.id, dueOn: "2026-10-31" });
		await tasks.createTask(as("lead"), {
			ws,
			key: "WEB",
			title: "Ancient",
			assigneeId: member.id,
			dueOn: "2025-01-01",
		});
		await env.db.delete(schema.tlNotification);
		expect(await dueNotices(env.db, now)).toEqual({ due: 1, overdue: 1 });
		expect(await dueNotices(env.db, now)).toEqual({ due: 0, overdue: 0 });
		const rows = await notifications("member");
		expect(rows.map((row) => [row.kind, row.data.title]).sort()).toEqual([
			["due", "Due"],
			["overdue", "Late"],
		]);
		// The whole job twice: the second run changes nothing.
		const { provider, sent } = inboxOf();
		const first = await runTasklineCron(env.db, { provider, now });
		const again = await runTasklineCron(env.db, { provider, now });
		expect(first.digests).toMatchObject({ ok: true, sent: 1 });
		expect(again).toMatchObject({ notices: { due: 0, overdue: 0 }, digests: { sent: 0 }, trash: { purged: 0 } });
		expect(sent).toHaveLength(1);
	});

	it("purges the trash past retention and revokes invitations a month past their date", async () => {
		const { team, lead } = await setUp();
		const kept = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Kept" });
		const old = await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Old" });
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "Child", parentId: old.id });
		await tasks.trashTask(as("lead"), ws, kept.ref);
		await tasks.trashTask(as("lead"), ws, old.ref);
		await env.db
			.update(schema.tlTask)
			.set({ deletedAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) })
			.where(and(eq(schema.tlTask.projectId, (await projects.getProject(as("lead"), ws, "WEB")).id)))
			.returning();
		await env.db.update(schema.tlTask).set({ deletedAt: new Date() }).where(eq(schema.tlTask.id, kept.id));
		expect(await purgeTrash(env.db)).toEqual({ purged: 2 });
		const left = await env.db.select({ title: schema.tlTask.title }).from(schema.tlTask);
		expect(left.map((row) => row.title)).toEqual(["Kept"]);
		await env.db.insert(schema.tlInvitation).values([
			{
				workspaceId: team.id,
				email: "late@example.com",
				invitedById: lead.id,
				expiresAt: new Date(Date.now() - 40 * 86_400_000),
			},
			{
				workspaceId: team.id,
				email: "soon@example.com",
				invitedById: lead.id,
				expiresAt: new Date(Date.now() - 86_400_000),
			},
		]);
		expect(await expireInvitations(env.db)).toEqual({ expired: 1 });
		expect(await expireInvitations(env.db)).toEqual({ expired: 0 });
	});
});

describe("the inbox", () => {
	it("lists the caller's own notifications, counts unread, and marks only theirs", async () => {
		const { member } = await setUp();
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "A", assigneeId: member.id });
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "B", assigneeId: member.id });
		const page = await inbox.listInbox(as("member"), { filter: "unread", page: 1 });
		expect(page.unread).toBe(2);
		expect(page.items.map((item) => [item.ref, item.ws, item.projectKey])).toEqual([
			["WEB-2", "team", "WEB"],
			["WEB-1", "team", "WEB"],
		]);
		const [first] = page.items;
		// Someone else marking it changes nothing.
		expect(await inbox.markRead(as("other"), { ids: [first?.id ?? ""], read: true })).toEqual({ unread: 0 });
		expect(await inbox.unreadCount(as("member"))).toEqual({ unread: 2 });
		expect(await inbox.markRead(as("member"), { ids: [first?.id ?? ""], read: true })).toEqual({ unread: 1 });
		expect((await inbox.listInbox(as("member"), { filter: "all", page: 1 })).items).toHaveLength(2);
		expect(await inbox.markRead(as("member"), { all: true })).toEqual({ unread: 0 });
	});

	it("hides a deactivated member's notifications, and moves a guest's to the account that claims the sandbox", async () => {
		const { member } = await setUp();
		await tasks.createTask(as("lead"), { ws, key: "WEB", title: "A", assigneeId: member.id });
		await env.db.transaction((tx) => workspaceRepo.setMemberDeactivated(tx, member.id, new Date()));
		expect(await inbox.unreadCount(as("member"))).toEqual({ unread: 0 });
		await env.db.transaction((tx) => seedSandbox(tx, "guest", "en"));
		await env.db.transaction((tx) => claimSandbox(tx, "guest", "account"));
		const claimed = await inbox.listInbox(as("account"), { filter: "all", page: 1 });
		expect(claimed.items.map((item) => [item.kind, item.ws])).toEqual([
			["mentioned", "sandbox"],
			["assigned", "sandbox"],
		]);
	});
});
