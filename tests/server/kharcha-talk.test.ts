import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { khActivity, khExpense, khInvite, khNotification, khPayment, khPerson } from "@/server/db/schema";
import type { EmailMessage, EmailProvider } from "@/server/email/types";
import type { InviteEmail, ReminderEmail } from "@/server/kharcha/access";
import * as talk from "@/server/kharcha/conversations/service";
import { expireInvites, purgeTrash, runKharchaCron } from "@/server/kharcha/cron";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as home from "@/server/kharcha/home/service";
import * as invites from "@/server/kharcha/invites/service";
import * as me from "@/server/kharcha/me/service";
import { unsubscribe, unsubscribeUrl, validUnsubscribe } from "@/server/kharcha/notify/contact-mail";
import { COALESCE_MS, deliverInstant, sendDigests } from "@/server/kharcha/notify/deliver";
import * as inbox from "@/server/kharcha/notify/inbox";
import * as payments from "@/server/kharcha/payments/service";
import * as settle from "@/server/kharcha/settle/service";
import * as threads from "@/server/kharcha/threads/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers } from "./kharcha-helpers";

/**
 * Kharcha's conversations, notifications and email (Task 92; docs/guides/kharcha.md
 * "Conversations and notifications", decision 0286): comments, mentions and reactions,
 * read marks and focus, who hears about what (produce), the instant email and its coalescing,
 * the digest, the one-a-day rule and unsubscribing for people without an account, and the
 * daily job's steps.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const delivered: string[][] = [];
const reminders: ReminderEmail[] = [];
const inviteEmails: InviteEmail[] = [];

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha", "bikash"], ["guest"]));
}, 60_000);
afterAll(() => env.close());

const as = (id: string) => ({
	...caller(env.db, id, { guest: id === "guest" }),
	deliver: (ids: string[]) => delivered.push(ids),
	sendReminder: (email: ReminderEmail) => reminders.push(email),
	sendInvite: (email: InviteEmail) => inviteEmails.push(email),
});
const today = "2026-11-12";
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;

/** An email provider that keeps what it is given. */
function mailbox() {
	const sent: EmailMessage[] = [];
	const provider: EmailProvider = {
		name: "console",
		send: async (message) => {
			sent.push(message);
			return { id: `m-${sent.length}` };
		},
	};
	return { sent, provider };
}

beforeEach(async () => {
	await env.reset();
	delivered.length = 0;
	reminders.length = 0;
	inviteEmails.length = 0;
});

const expense = (overrides: Partial<Parameters<typeof expenses.createExpense>[1]> = {}) => ({
	groupId: null,
	kind: "expense" as const,
	title: "Boat on Phewa",
	merchant: "",
	notes: "",
	amountMinor: 180_000,
	currency: "NPR" as const,
	spentOn: today,
	...overrides,
});

/** Maya's trip with Asha and Bikash, all three with accounts. */
async function trip() {
	const maya = await personOf("maya");
	const asha = await personOf("asha");
	const bikash = await personOf("bikash");
	for (const name of ["asha", "bikash"]) await friends.addFriend(as("maya"), { name, email: `${name}@example.com` });
	const group = await groups.createGroup(as("maya"), {
		name: "Pokhara trip",
		kind: "trip",
		color: "teal",
		currency: "NPR",
		startOn: null,
		endOn: null,
		memberIds: [asha, bikash],
	});
	return { maya, asha, bikash, group: group.id };
}

const rowsOf = (userId: string) =>
	env.db.select().from(khNotification).where(eq(khNotification.userId, userId)).orderBy(khNotification.createdAt);

describe("comments", () => {
	it("write, mention, edit, react and delete in a group's thread, shown in the thread in order", async () => {
		const { asha, bikash, group } = await trip();
		const thread = `g:${group}` as const;
		// A mention keeps only people in the thread: Asha stays, a stranger's id goes.
		const first = await talk.createComment(as("maya"), {
			thread,
			body: "@Asha Gurung the boat was NPR 1,800. https://example.com/phewa",
			mentions: [asha, "00000000-0000-4000-8000-000000000000"],
		});
		expect(first.mentions.map((mention) => mention.id)).toEqual([asha]);
		expect(first.can).toEqual({ edit: true, delete: true, react: true });

		const seen = await threads.getGroupThread(as("bikash"), group);
		const comment = seen.items.find((item) => item.type === "comment");
		expect(comment?.type === "comment" && comment.comment.body).toContain("NPR 1,800");
		expect(comment?.type === "comment" && comment.comment.can).toEqual({ edit: false, delete: false, react: true });
		expect(seen.talk.canComment).toBe(true);
		expect(seen.talk.mentionable.map((person) => person.id).sort()).toEqual([asha, await personOf("maya")].sort());

		// Only its author edits and deletes; anyone in the thread reacts, once per emoji.
		expect(await code(talk.updateComment(as("bikash"), { commentId: first.id, body: "No", mentions: [] }))).toBe(
			"FORBIDDEN",
		);
		await talk.react(as("bikash"), { commentId: first.id, emoji: "👍", on: true });
		await talk.react(as("bikash"), { commentId: first.id, emoji: "👍", on: true });
		const liked = await talk.react(as("asha"), { commentId: first.id, emoji: "👍", on: true });
		expect(liked.reactions).toEqual([{ emoji: "👍", count: 2, mine: true }]);
		const edited = await talk.updateComment(as("maya"), {
			commentId: first.id,
			body: "@Bikash Rai and @Asha Gurung: NPR 1,800",
			mentions: [asha, bikash],
		});
		expect(edited.editedAt).not.toBeNull();
		expect(edited.mentions.map((mention) => mention.id).sort()).toEqual([asha, bikash].sort());

		expect(await code(talk.deleteComment(as("asha"), first.id))).toBe("FORBIDDEN");
		await talk.deleteComment(as("maya"), first.id);
		const after = await threads.getGroupThread(as("bikash"), group);
		expect(after.items.some((item) => item.type === "comment")).toBe(false);
		expect(await code(talk.react(as("asha"), { commentId: first.id, emoji: "😂", on: true }))).toBe("NOT_FOUND");
	});

	it("are read only for a former member, up to when they left, and closed on an archived group", async () => {
		const { group } = await trip();
		const before = await talk.createComment(as("maya"), { thread: `g:${group}`, body: "Before", mentions: [] });
		await groups.leaveGroup(as("bikash"), group);
		await talk.createComment(as("maya"), { thread: `g:${group}`, body: "After", mentions: [] });
		const theirs = await threads.getGroupThread(as("bikash"), group);
		const bodies = theirs.items.flatMap((item) => (item.type === "comment" ? [item.comment.body] : []));
		expect(bodies).toEqual(["Before"]);
		expect(theirs.talk.canComment).toBe(false);
		expect(await code(talk.createComment(as("bikash"), { thread: `g:${group}`, body: "Hi", mentions: [] }))).toBe(
			"FORBIDDEN",
		);
		expect(await code(talk.react(as("bikash"), { commentId: before.id, emoji: "👍", on: true }))).toBe("FORBIDDEN");

		await groups.archiveGroup(as("maya"), group, true);
		expect(await code(talk.createComment(as("asha"), { thread: `g:${group}`, body: "Hi", mentions: [] }))).toBe(
			"FORBIDDEN",
		);
	});

	it("live on an expense and between two friends, each side naming the thread by the other", async () => {
		const { maya, asha } = await trip();
		const shared = await expenses.createExpense(
			as("maya"),
			expense({ split: { method: "equal", people: [maya, asha] } }),
		);
		await talk.createComment(as("asha"), { thread: `e:${shared.id}`, body: "Thanks!", mentions: [] });
		const detail = await expenses.getExpense(as("maya"), shared.id);
		expect(detail.comments.map((comment) => comment.body)).toEqual(["Thanks!"]);
		expect(detail.talk.unread).toBeGreaterThan(0);

		await talk.createComment(as("maya"), { thread: `f:${asha}`, body: "Coffee tomorrow?", mentions: [] });
		const hers = await threads.getFriendThread(as("asha"), maya);
		expect(hers.items.flatMap((item) => (item.type === "comment" ? [item.comment.body] : []))).toEqual([
			"Coffee tomorrow?",
		]);
		expect(hers.talk.thread).toBe(`f:${maya}`);
	});
});

describe("unread and focus", () => {
	it("count lines from others since the last read, order People by the latest, and focus on what is open", async () => {
		const { maya, asha, group } = await trip();
		await talk.createComment(as("asha"), { thread: `g:${group}`, body: "Hi all", mentions: [] });
		await talk.createComment(as("asha"), { thread: `f:${maya}`, body: "Hi Maya", mentions: [] });

		const people = await threads.listPeople(as("maya"), { q: "" });
		expect(people.threads[`g:${group}`]?.unread).toBeGreaterThan(0);
		expect(people.threads[`f:${asha}`]?.unread).toBe(1);
		// Writing in a thread counts as reading it.
		expect((await threads.listPeople(as("asha"), { q: "" })).threads[`f:${maya}`]?.unread).toBe(0);

		await talk.markThreadRead(as("maya"), `g:${group}`);
		await talk.markThreadRead(as("maya"), `f:${asha}`);
		const read = await threads.listPeople(as("maya"), { q: "" });
		expect(read.threads[`g:${group}`]?.unread).toBe(0);
		expect(read.threads[`f:${asha}`]?.unread).toBe(0);
		// Reading a thread reads its notifications too.
		expect((await rowsOf("maya")).every((row) => row.readAt !== null)).toBe(true);

		// Focus: everything is read and settled, so nothing is listed but the count of what was left out.
		await inbox.setFocus(as("maya"), true);
		const focused = await threads.listPeople(as("maya"), { q: "" });
		expect(focused.focus).toBe(true);
		expect(focused.groups).toEqual([]);
		expect(focused.friends).toEqual([]);
		expect(focused.focusHidden).toBe(3);
		// A new line from Bikash brings the group back.
		await talk.createComment(as("bikash"), { thread: `g:${group}`, body: "Boat?", mentions: [] });
		expect((await threads.listPeople(as("maya"), { q: "" })).groups.map((each) => each.id)).toEqual([group]);
	});
});

describe("notifications", () => {
	it("tell everyone the change touches but its actor, a mention before the plain comment, emailed as each chose", async () => {
		const { maya, asha, bikash, group } = await trip();
		// Asha and Bikash were added to the group: "added you", emailed at once by default.
		const added = await rowsOf("asha");
		expect(added.map((row) => [row.kind, row.email, row.thread])).toEqual([["group.added", "instant", `g:${group}`]]);
		expect(delivered.flat()).toContain(added[0]?.id);
		expect(await rowsOf("maya")).toEqual([]);

		await inbox.updateNotifySettings(as("bikash"), {
			notify: { "comment.thread": "none", "comment.mention": "instant" },
		});
		delivered.length = 0;
		await talk.createComment(as("maya"), { thread: `g:${group}`, body: "@Asha Gurung boat at six", mentions: [asha] });
		const ashas = (await rowsOf("asha")).filter((row) => row.kind.startsWith("comment"));
		const bikashs = (await rowsOf("bikash")).filter((row) => row.kind.startsWith("comment"));
		expect(ashas.map((row) => [row.kind, row.email])).toEqual([["comment.mention", "digest"]]);
		expect(bikashs.map((row) => [row.kind, row.email])).toEqual([["comment.thread", "none"]]);
		expect(ashas[0]?.data).toMatchObject({ actor: expect.any(String), group: "Pokhara trip" });
		expect(ashas[0]?.data.excerpt).toContain("boat at six");
		expect(delivered.flat()).toEqual([]);

		// An expense: everyone on it hears (the digest by default); a payment: its recipient, at once.
		await expenses.createExpense(
			as("maya"),
			expense({ groupId: group, split: { method: "equal", people: [maya, asha, bikash] } }),
		);
		expect((await rowsOf("bikash")).some((row) => row.kind === "expense.added" && row.email === "digest")).toBe(true);
		await payments.createPayment(as("asha"), {
			groupId: group,
			fromId: asha,
			toId: maya,
			amountMinor: 60_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		});
		const paid = (await rowsOf("maya")).find((row) => row.kind === "payment.received");
		expect(paid).toMatchObject({ email: "instant", thread: `g:${group}` });
		expect(paid?.data.amounts).toEqual([{ currency: "NPR", amountMinor: 60_000 }]);

		// Home's Updates and the bell.
		const mayaHome = await home.getHome(as("maya"));
		expect(mayaHome.updates[0]?.kind).toBe("payment.received");
		expect(mayaHome.unread).toBe(1);
		expect((await me.getPulse(as("maya"))).unread).toBe(1);
		await inbox.markRead(as("maya"));
		expect((await me.getPulse(as("maya"))).unread).toBe(0);
		await expectLedgerConsistent(env.db);
	});

	it("email at once once per thread, coalesce within five minutes, then gather the rest in the digest", async () => {
		const { group } = await trip();
		const { sent, provider } = mailbox();
		const now = new Date();
		const ids = delivered.flat();
		expect(await deliverInstant(env.db, ids, { provider, now })).toMatchObject({ sent: 2 });
		expect(sent.map((message) => message.to).sort()).toEqual(["asha@example.com", "bikash@example.com"]);
		expect(sent[0]?.subject).toContain("Pokhara trip");
		// Claimed: never twice.
		expect(await deliverInstant(env.db, ids, { provider, now })).toMatchObject({ sent: 0 });

		// Another instant row about the same thread within five minutes waits for the digest.
		await inbox.updateNotifySettings(as("asha"), { notify: { "comment.thread": "instant" } });
		delivered.length = 0;
		await talk.createComment(as("maya"), { thread: `g:${group}`, body: "See you there", mentions: [] });
		const soon = new Date(now.getTime() + COALESCE_MS / 2);
		expect(await deliverInstant(env.db, delivered.flat(), { provider, now: soon })).toMatchObject({ deferred: 1 });

		// The digest: Asha's waiting rows in one email, Bikash's (comment in the digest by default) in another.
		const digest = mailbox();
		expect(await sendDigests(env.db, { provider: digest.provider, now: soon })).toMatchObject({ sent: 2 });
		const hers = digest.sent.find((message) => message.to === "asha@example.com");
		expect(hers?.text).toContain("Pokhara trip");
		// Run again: nothing left to send.
		expect(await sendDigests(env.db, { provider: digest.provider, now: soon })).toMatchObject({ sent: 0 });
	});

	it("skip someone who left the group since, and send nothing to a guest", async () => {
		const { group } = await trip();
		await talk.createComment(as("maya"), { thread: `g:${group}`, body: "Hello", mentions: [] });
		await groups.leaveGroup(as("bikash"), group);
		const { sent, provider } = mailbox();
		await sendDigests(env.db, { provider, now: new Date(Date.now() + 60 * 60 * 1000) });
		expect(sent.map((message) => message.to)).not.toContain("bikash@example.com");
		expect(sent.map((message) => message.to)).toContain("asha@example.com");
		// A guest's own threads have nobody with an account in them: nothing is produced.
		const guestFriend = (await friends.addFriend(as("guest"), { name: "Ram" })).person.id;
		await talk.createComment(as("guest"), { thread: `f:${guestFriend}`, body: "Hi Ram", mentions: [] });
		expect(await rowsOf("guest")).toEqual([]);
	});

	it("keep only what differs from the defaults in settings, and show every kind in the profile", async () => {
		await inbox.updateNotifySettings(as("maya"), { notify: { "expense.added": "instant", "group.added": "instant" } });
		const profile = (await me.getMe(as("maya"))).profile;
		expect(profile.notify["expense.added"]).toBe("instant");
		expect(profile.notify["group.added"]).toBe("instant");
		expect(profile.notify.reminder).toBe("instant");
		expect(profile.notify["comment.thread"]).toBe("digest");
	});
});

describe("people without an account", () => {
	it("get one email a day of any kind, with an unsubscribe link that stops invites and reminders", async () => {
		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		// Gita owes Maya.
		await expenses.createExpense(as("maya"), expense({ split: { method: "full", person: gita } }));

		const invite = await invites.inviteFriend(as("maya"), { personId: gita, send: true });
		expect(invite.sent).toBe(true);
		expect(inviteEmails[0]?.data.unsubscribeUrl).toContain("/api/kharcha/unsubscribe?");
		// The same day, a reminder can't go: one email a day, whatever its kind.
		expect(await code(settle.remindFriend(as("maya"), gita))).toBe("RATE_LIMITED");

		// A day later it can, with the link.
		await env.db
			.update(khPerson)
			.set({ mailedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
			.where(eq(khPerson.id, gita));
		await settle.remindFriend(as("maya"), gita);
		const url = reminders[0]?.data.unsubscribeUrl ?? "";
		const params = new URL(url).searchParams;
		expect(validUnsubscribe(params.get("p") ?? "", params.get("t") ?? "")).toBe(true);
		expect(validUnsubscribe(params.get("p") ?? "", "nope")).toBe(false);
		expect(unsubscribeUrl(gita, "en")).toBe(url);

		// Unsubscribed: no reminder button, reminders refused, invites made but not sent.
		expect(await unsubscribe(env.db, gita)).toBe(true);
		await env.db.update(khPerson).set({ mailedAt: null }).where(eq(khPerson.id, gita));
		await env.db.update(khActivity).set({ at: new Date(Date.now() - 25 * 60 * 60 * 1000) });
		expect((await threads.getFriendThread(as("maya"), gita)).remind.available).toBe(false);
		expect(await code(settle.remindFriend(as("maya"), gita))).toBe("FORBIDDEN");
		expect((await invites.inviteFriend(as("maya"), { personId: gita, send: true })).sent).toBe(false);
	});

	it("an account's reminder is a notification too, emailed with its own template only when they chose instant", async () => {
		const { maya, asha } = await trip();
		await expenses.createExpense(as("maya"), expense({ split: { method: "equal", people: [maya, asha] } }));
		await inbox.updateNotifySettings(as("asha"), { notify: { reminder: "digest" } });
		await settle.remindFriend(as("maya"), asha);
		expect(reminders).toEqual([]);
		const row = (await rowsOf("asha")).find((each) => each.kind === "reminder");
		expect(row).toMatchObject({ email: "digest", emailedAt: null, thread: `f:${maya}` });
	});
});

describe("the daily job", () => {
	it("purges the trash past 30 days, expires old invites, prunes old read notifications; twice changes nothing", async () => {
		const { maya, asha, group } = await trip();
		const old = await expenses.createExpense(as("maya"), expense({ split: { method: "equal", people: [maya, asha] } }));
		const recent = await expenses.createExpense(
			as("maya"),
			expense({ split: { method: "equal", people: [maya, asha] } }),
		);
		const now = new Date();
		await expenses.deleteExpense(as("maya"), old.id, new Date(now.getTime() - 31 * 86_400_000));
		await expenses.deleteExpense(as("maya"), recent.id, now);
		const pay = await payments.createPayment(as("maya"), {
			groupId: null,
			fromId: maya,
			toId: asha,
			amountMinor: 1_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		});
		await env.db
			.update(khPayment)
			.set({ deletedAt: new Date(now.getTime() - 40 * 86_400_000) })
			.where(eq(khPayment.id, pay.id));
		expect(await purgeTrash(env.db, now)).toEqual({ expenses: 1, payments: 1 });
		expect(await env.db.select({ id: khExpense.id }).from(khExpense).where(eq(khExpense.id, old.id))).toEqual([]);
		expect(await purgeTrash(env.db, now)).toEqual({ expenses: 0, payments: 0 });

		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		await invites.inviteFriend(as("maya"), { personId: gita });
		await env.db.update(khInvite).set({ expiresAt: new Date(now.getTime() - 31 * 86_400_000) });
		expect(await expireInvites(env.db, now)).toBe(1);

		await env.db
			.update(khNotification)
			.set({ readAt: now, createdAt: new Date(now.getTime() - 91 * 86_400_000) })
			.where(eq(khNotification.userId, "asha"));
		const old90 = (await rowsOf("asha")).length;
		expect(old90).toBeGreaterThan(0);
		const result = await runKharchaCron(env.db, { provider: mailbox().provider, now });
		expect(result.notifications).toMatchObject({ ok: true, pruned: old90 });
		expect(Object.values(result).every((step) => step.ok)).toBe(true);
		const again = await runKharchaCron(env.db, { provider: mailbox().provider, now });
		expect(again).toMatchObject({
			digests: { ok: true, sent: 0 },
			trash: { ok: true, expenses: 0, payments: 0 },
			invites: { ok: true, expired: 0 },
			notifications: { ok: true, pruned: 0 },
		});
		expect(
			await env.db
				.select()
				.from(khNotification)
				.where(and(eq(khNotification.userId, "asha"), eq(khNotification.groupId, group))),
		).toEqual([]);
		await expectLedgerConsistent(env.db);
	});
});
