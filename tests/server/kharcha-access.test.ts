import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notFound } from "@/server/db/crud";
import * as budgets from "@/server/kharcha/budgets/service";
import * as talk from "@/server/kharcha/conversations/service";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as totals from "@/server/kharcha/groups/totals";
import * as home from "@/server/kharcha/home/service";
import * as insights from "@/server/kharcha/insights/service";
import * as invites from "@/server/kharcha/invites/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as inbox from "@/server/kharcha/notify/inbox";
import * as payments from "@/server/kharcha/payments/service";
import * as receipts from "@/server/kharcha/receipts/service";
import * as recurring from "@/server/kharcha/recurring/service";
import * as settle from "@/server/kharcha/settle/service";
import { bulkExpenses } from "@/server/kharcha/spend/bulk";
import { importSpend } from "@/server/kharcha/spend/import";
import * as saved from "@/server/kharcha/spend/saved";
import * as spend from "@/server/kharcha/spend/service";
import * as threads from "@/server/kharcha/threads/service";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";
import { caller, code, insertUsers, uploadReceipt } from "./kharcha-helpers";

/**
 * Kharcha's access matrix (decision 0277, the table in docs/guides/kharcha.md "Access"):
 * every app operation, called by each kind of caller. What the caller can't see is
 * NOT_FOUND; what they can see but not change is FORBIDDEN. A new service function adds
 * its operation to OPERATIONS.
 *
 * - owner: owns the personal expense, the group (its owner) and is on everything else;
 * - friend: on the shared expense and the payment outside the group;
 * - member: a current member of the group;
 * - former: left the group after the old expense, before the new one;
 * - stranger, guest: nobody's friend; admin: holds `kharcha:read` and `kharcha:configure`.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const CALLERS = ["owner", "friend", "member", "former", "stranger", "guest", "admin"] as const;
type Caller = (typeof CALLERS)[number];

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		insertUsers(db, ["owner", "friend", "member", "former", "stranger", "staff"], ["guest"]),
	);
}, 60_000);

const cloudinary = createFakeCloudinary();
const as = (id: Caller) =>
	caller(env.db, id === "admin" ? "staff" : id, {
		guest: id === "guest",
		permissions: id === "admin" ? ["kharcha:read", "kharcha:configure"] : [],
		imageStore: cloudinary.store,
	});
const today = "2026-11-12";

type World = {
	people: Record<"owner" | "friend" | "member" | "former" | "spare" | "invitee", string>;
	/** The owner's invite to the invitee (Task 90). */
	inviteToken: string;
	personal: string;
	shared: string;
	trashed: string;
	pairPayment: string;
	group: string;
	oldExpense: string;
	newExpense: string;
	groupPayment: string;
	/** The owner's comment in the group (Task 92), written after the former member left. */
	groupComment: string;
	/** The owner's own lists (Task 89), an upload of theirs no expense took, and a receipt draft. */
	category: string;
	categories: string[];
	tag: string;
	method: string;
	rule: string;
	upload: string;
	draft: string;
	/** The owner's saved search (Task 93). */
	search: string;
	/** The owner's budget, and their personal expense repeating monthly (Task 94). */
	budget: string;
	recurring: string;
};
let world: World;

const expense = (overrides: Partial<Parameters<typeof expenses.createExpense>[1]> = {}) => ({
	groupId: null,
	kind: "expense" as const,
	title: "Test",
	merchant: "",
	notes: "",
	amountMinor: 10_000,
	currency: "NPR" as const,
	spentOn: today,
	...overrides,
});

async function setUp(): Promise<World> {
	await env.reset();
	const personOf = async (id: Caller) => (await me.getMe(as(id))).person.id;
	const owner = await personOf("owner");
	const friend = await personOf("friend");
	const member = await personOf("member");
	const former = await personOf("former");
	for (const id of ["friend", "member", "former"] as const) {
		await friends.addFriend(as("owner"), { name: id, email: `${id}@example.com` });
	}
	const spare = (await friends.addFriend(as("owner"), { name: "Spare" })).person.id;
	// Someone with an address and no account (Task 90): invited by the owner.
	const invitee = (await friends.addFriend(as("owner"), { name: "Invitee", email: "invitee@elsewhere.example" })).person
		.id;
	const inviteToken = (await invites.inviteFriend(as("owner"), { personId: invitee })).url.split("/join/")[1] ?? "";

	const personal = (await expenses.createExpense(as("owner"), expense())).id;
	const shared = (
		await expenses.createExpense(as("owner"), expense({ split: { method: "equal", people: [owner, friend] } }))
	).id;
	const trashed = (
		await expenses.createExpense(as("owner"), expense({ split: { method: "equal", people: [owner, friend] } }))
	).id;
	await expenses.deleteExpense(as("owner"), trashed);
	const pairPayment = (
		await payments.createPayment(as("owner"), {
			groupId: null,
			fromId: owner,
			toId: friend,
			amountMinor: 1_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		})
	).id;

	const group = (
		await groups.createGroup(as("owner"), {
			name: "Trip",
			kind: "trip",
			color: "teal",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [member, former, spare],
		})
	).id;
	const oldExpense = (
		await expenses.createExpense(
			as("owner"),
			expense({ groupId: group, split: { method: "equal", people: [owner, member] } }),
		)
	).id;
	await groups.leaveGroup(as("former"), group);
	const newExpense = (
		await expenses.createExpense(
			as("member"),
			expense({ groupId: group, split: { method: "equal", people: [owner, member] } }),
		)
	).id;
	const groupPayment = (
		await payments.createPayment(as("member"), {
			groupId: group,
			fromId: member,
			toId: owner,
			amountMinor: 1_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		})
	).id;
	const groupComment = (
		await talk.createComment(as("owner"), { thread: `g:${group}`, body: "Boat at six?", mentions: [member] })
	).id;
	const owned = await lists.getLists(as("owner"));
	const category = owned.categories[0]?.id ?? "";
	const method = owned.methods[0]?.id ?? "";
	const tag = (await lists.createTag(as("owner"), "Owned")).tags[0]?.id ?? "";
	const rule =
		(
			await lists.createRule(as("owner"), {
				match: "contains",
				pattern: "Mart",
				categoryId: category,
				tagIds: [],
				methodId: null,
			})
		).rules[0]?.id ?? "";
	const upload = await uploadReceipt(as("owner"), cloudinary);
	const draft = (await receipts.createDraft(as("owner"), [await uploadReceipt(as("owner"), cloudinary)])).id;
	const search = (await saved.saveSearch(as("owner"), { name: "Big", query: "amount>100" }))[0]?.id ?? "";
	const budget =
		(
			await budgets.createBudget(as("owner"), {
				categoryId: null,
				currency: "NPR",
				period: "month",
				amountMinor: 100_000,
				startsOn: today,
			})
		)[0]?.id ?? "";
	const repeating =
		(await recurring.repeatExpense(as("owner"), { expenseId: personal, unit: "month", every: 1, endsOn: null }))[0]
			?.id ?? "";
	return {
		search,
		budget,
		recurring: repeating,
		people: { owner, friend, member, former, spare, invitee },
		inviteToken,
		category,
		categories: owned.categories.map((each) => each.id),
		tag,
		method,
		rule,
		upload,
		draft,
		personal,
		shared,
		trashed,
		pairPayment,
		group,
		oldExpense,
		newExpense,
		groupPayment,
		groupComment,
	};
}

type Expected = Partial<Record<Caller, string>>;
type Operation = { name: string; run: (w: World, by: Caller) => Promise<unknown>; expect: Expected };

/** A bulk action that changed nothing, as the matrix reads it: NOT_FOUND. */
const changed = async (result: Promise<{ changed: number }>) => {
	if ((await result).changed === 0) throw notFound("Expense");
};

/** Everyone not named gets NOT_FOUND. */
const only = (expected: Expected): Expected => expected;
/** Every caller: an operation on their own lists, which everyone has. */
const everyone = (result = "ok"): Expected => Object.fromEntries(CALLERS.map((by) => [by, result]));

const editFields = (w: World, id: string, people: string[]) => ({
	expenseId: id,
	version: 1,
	kind: "expense" as const,
	title: "Edited",
	merchant: "",
	notes: "",
	amountMinor: 10_000,
	currency: "NPR" as const,
	spentOn: today,
	split: { method: "equal" as const, people },
	payers: [{ person: w.people.owner, amount: 10_000 }],
});

const paymentFields = (id: string) => ({
	paymentId: id,
	version: 1,
	amountMinor: 2_000,
	currency: "NPR" as const,
	paid: null,
	method: "",
	note: "",
	paidOn: today,
});

const OPERATIONS: Operation[] = [
	{
		name: "getExpense: personal",
		run: (w, by) => expenses.getExpense(as(by), w.personal),
		expect: only({ owner: "ok" }),
	},
	{
		name: "getExpense: shared",
		run: (w, by) => expenses.getExpense(as(by), w.shared),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "getExpense: in the group, before the former member left",
		run: (w, by) => expenses.getExpense(as(by), w.oldExpense),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "getExpense: in the group, after",
		run: (w, by) => expenses.getExpense(as(by), w.newExpense),
		expect: only({ owner: "ok", member: "ok" }),
	},
	{
		name: "updateExpense: shared",
		run: (w, by) => expenses.updateExpense(as(by), editFields(w, w.shared, [w.people.owner, w.people.friend])),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "updateExpense: in the group",
		run: (w, by) => expenses.updateExpense(as(by), editFields(w, w.oldExpense, [w.people.owner, w.people.member])),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "deleteExpense: personal",
		run: (w, by) => expenses.deleteExpense(as(by), w.personal),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteExpense: in the group",
		run: (w, by) => expenses.deleteExpense(as(by), w.oldExpense),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "restoreExpense: shared, in the trash",
		run: (w, by) => expenses.restoreExpense(as(by), w.trashed),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "createExpense: in the group",
		run: (w, by) => expenses.createExpense(as(by), expense({ groupId: w.group })),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "getPayment: outside a group",
		run: (w, by) => payments.getPayment(as(by), w.pairPayment),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "getPayment: in the group, after the former member left",
		run: (w, by) => payments.getPayment(as(by), w.groupPayment),
		expect: only({ owner: "ok", member: "ok" }),
	},
	{
		name: "updatePayment: outside a group",
		run: (w, by) => payments.updatePayment(as(by), paymentFields(w.pairPayment)),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "deletePayment: in the group",
		run: (w, by) => payments.deletePayment(as(by), w.groupPayment),
		expect: only({ owner: "ok", member: "ok" }),
	},
	{
		name: "restorePayment: not in the trash",
		run: (w, by) => payments.restorePayment(as(by), w.pairPayment),
		expect: only({ owner: "FORBIDDEN", friend: "FORBIDDEN" }),
	},
	{
		name: "createPayment: in the group",
		run: (w, by) =>
			payments.createPayment(as(by), {
				groupId: w.group,
				fromId: w.people.member,
				toId: w.people.owner,
				amountMinor: 500,
				currency: "NPR",
				paid: null,
				method: "",
				note: "",
				paidOn: today,
			}),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "getGroup",
		run: (w, by) => groups.getGroup(as(by), w.group),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "updateGroup",
		run: (w, by) =>
			groups.updateGroup(as(by), {
				groupId: w.group,
				version: 1,
				name: "Renamed",
				kind: "trip",
				color: "teal",
				currency: "NPR",
				startOn: null,
				endOn: null,
				defaultSplit: "equal",
				simplify: true,
			}),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "archiveGroup",
		run: (w, by) => groups.archiveGroup(as(by), w.group, true),
		expect: only({ owner: "ok", member: "FORBIDDEN", former: "FORBIDDEN" }),
	},
	{
		name: "removeMember (settled)",
		run: (w, by) => groups.removeMember(as(by), w.group, w.people.spare),
		expect: only({ owner: "ok", member: "FORBIDDEN", former: "FORBIDDEN" }),
	},
	{
		name: "addMember (the owner's friend)",
		run: (w, by) => groups.addMember(as(by), w.group, w.people.friend),
		// The member can change the group, but the friend isn't theirs to add.
		expect: only({ owner: "ok", member: "NOT_FOUND", former: "FORBIDDEN" }),
	},
	{
		name: "leaveGroup (owing or owed)",
		run: (w, by) => groups.leaveGroup(as(by), w.group),
		expect: only({ owner: "FORBIDDEN", member: "FORBIDDEN", former: "FORBIDDEN" }),
	},
	// Task 89: the caller's own lists, receipts, Spend and the helpers.
	{ name: "getLists", run: (_w, by) => lists.getLists(as(by)), expect: everyone() },
	{ name: "getMerchants", run: (_w, by) => lists.getMerchants(as(by)), expect: everyone() },
	{
		name: "listSpend",
		run: (_w, by) => spend.listSpend(as(by), { q: "", sort: "-date", page: 1, pageSize: 25 }),
		expect: everyone(),
	},
	{
		name: "createCategory",
		run: (_w, by) => lists.createCategory(as(by), { name: "Pets", icon: "gift", color: "pink" }),
		expect: everyone(),
	},
	{
		name: "updateCategory: the owner's",
		run: (w, by) =>
			lists.updateCategory(as(by), { id: w.category, name: "Renamed", icon: "gift", color: "pink", archived: true }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteCategory: the owner's",
		run: (w, by) => lists.deleteCategory(as(by), w.category),
		expect: only({ owner: "ok" }),
	},
	{
		name: "reorderCategories: the owner's",
		run: (w, by) => lists.reorderCategories(as(by), [...w.categories].reverse()),
		expect: { ...everyone("CONFLICT"), owner: "ok" },
	},
	{ name: "createTag", run: (_w, by) => lists.createTag(as(by), "New"), expect: everyone() },
	{
		name: "updateTag: the owner's",
		run: (w, by) => lists.updateTag(as(by), { id: w.tag, name: "Renamed" }),
		expect: only({ owner: "ok" }),
	},
	{ name: "deleteTag: the owner's", run: (w, by) => lists.deleteTag(as(by), w.tag), expect: only({ owner: "ok" }) },
	{ name: "createMethod", run: (_w, by) => lists.createMethod(as(by), "Fonepay"), expect: everyone() },
	{
		name: "updateMethod: the owner's",
		run: (w, by) => lists.updateMethod(as(by), { id: w.method, name: "Notes", archived: false }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteMethod: the owner's",
		run: (w, by) => lists.deleteMethod(as(by), w.method),
		expect: only({ owner: "ok" }),
	},
	{
		name: "createRule: with the owner's category",
		run: (w, by) =>
			lists.createRule(as(by), {
				match: "equals",
				pattern: "Cafe",
				categoryId: w.category,
				tagIds: [],
				methodId: null,
			}),
		expect: only({ owner: "ok" }),
	},
	{
		name: "updateRule: the owner's",
		run: (w, by) =>
			lists.updateRule(as(by), {
				id: w.rule,
				match: "equals",
				pattern: "Mart",
				categoryId: null,
				tagIds: [],
				methodId: w.method,
			}),
		expect: only({ owner: "ok" }),
	},
	{ name: "deleteRule: the owner's", run: (w, by) => lists.deleteRule(as(by), w.rule), expect: only({ owner: "ok" }) },
	{
		name: "createExpense: with the owner's category",
		run: (w, by) => expenses.createExpense(as(by), expense({ categoryId: w.category })),
		expect: only({ owner: "ok" }),
	},
	{
		name: "updateExpense: shared, with the owner's tag",
		run: (w, by) =>
			expenses.updateExpense(as(by), {
				...editFields(w, w.shared, [w.people.owner, w.people.friend]),
				tagIds: [w.tag],
			}),
		// The friend may edit the expense, but the tag is not theirs to use.
		expect: only({ owner: "ok" }),
	},
	{
		name: "createExpense: with the owner's receipt",
		run: (w, by) => expenses.createExpense(as(by), expense({ receiptIds: [w.upload] })),
		expect: { ...everyone("BAD_REQUEST"), owner: "ok" },
	},
	{
		name: "createExpense: from the owner's draft",
		run: (w, by) => expenses.createExpense(as(by), expense({ draftId: w.draft })),
		expect: only({ owner: "ok" }),
	},
	{
		name: "createDraft: with the owner's upload",
		run: (w, by) => receipts.createDraft(as(by), [w.upload]),
		expect: { ...everyone("BAD_REQUEST"), owner: "ok" },
	},
	{
		name: "deleteDraft: the owner's",
		run: (w, by) => receipts.deleteDraft(as(by), w.draft),
		expect: only({ owner: "ok" }),
	},
	{
		name: "setNotDuplicate: shared",
		run: (w, by) => expenses.setNotDuplicate(as(by), w.shared, true),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "setNotDuplicate: in the group, before the former member left",
		run: (w, by) => expenses.setNotDuplicate(as(by), w.oldExpense, true),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "getFriend",
		run: (w, by) => friends.getFriend(as(by), w.people.friend),
		expect: only({ owner: "ok" }),
	},
	{
		name: "updateFriend",
		run: (w, by) => friends.updateFriend(as(by), { personId: w.people.member, hidden: true }),
		expect: only({ owner: "ok" }),
	},
	// Task 90: people, threads, invites and joining.
	{
		name: "listPeople",
		run: (_w, by) => threads.listPeople(as(by), { q: "" }),
		expect: everyone(),
	},
	{
		name: "getGroupThread",
		run: (w, by) => threads.getGroupThread(as(by), w.group),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "getFriendThread",
		run: (w, by) => threads.getFriendThread(as(by), w.people.friend),
		expect: only({ owner: "ok" }),
	},
	{
		name: "setFriendEmail (the owner's contact)",
		run: (w, by) => friends.setFriendEmail(as(by), { personId: w.people.spare, email: "spare@elsewhere.example" }),
		// The guest is refused before anything is looked up: guests add names only.
		expect: only({ owner: "ok", guest: "FORBIDDEN" }),
	},
	{
		name: "inviteFriend",
		run: (w, by) => invites.inviteFriend(as(by), { personId: w.people.invitee }),
		expect: only({ owner: "ok", guest: "FORBIDDEN" }),
	},
	{
		name: "inviteFriend (from the group, the invitee not in it)",
		run: (w, by) => invites.inviteFriend(as(by), { personId: w.people.invitee, groupId: w.group }),
		expect: only({ owner: "BAD_REQUEST", guest: "FORBIDDEN" }),
	},
	{
		name: "acceptInvite",
		run: (w, by) => invites.acceptInvite(as(by), w.inviteToken),
		// Anyone signed in with a link may take it (that's what it's for), never its sender or a guest.
		expect: {
			owner: "FORBIDDEN",
			friend: "ok",
			member: "ok",
			former: "ok",
			stranger: "ok",
			guest: "FORBIDDEN",
			admin: "ok",
		},
	},
	{
		name: "addNewMember",
		run: (w, by) => groups.addNewMember(as(by), { groupId: w.group, name: "Newcomer" }),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	// Task 91: balances and settling up.
	{
		name: "getSettleUp: in the group",
		run: (w, by) => settle.getSettleUp(as(by), { groupId: w.group }),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "getSettleUp: with the friend",
		run: (w, by) => settle.getSettleUp(as(by), { groupId: null, personId: w.people.friend }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "getSettleUp: everything of the caller's",
		run: (_w, by) => settle.getSettleUp(as(by), { groupId: null }),
		expect: everyone(),
	},
	{
		name: "remindFriend (the friend owes the owner)",
		run: (w, by) => settle.remindFriend(as(by), w.people.friend),
		expect: only({ owner: "ok" }),
	},
	{
		name: "getGroupTotals",
		run: (w, by) => totals.getGroupTotals(as(by), w.group),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "createComment: in the group's thread",
		run: (w, by) => talk.createComment(as(by), { thread: `g:${w.group}`, body: "Hello", mentions: [] }),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "createComment: on the shared expense",
		run: (w, by) => talk.createComment(as(by), { thread: `e:${w.shared}`, body: "Hello", mentions: [] }),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "createComment: on an expense in the trash",
		run: (w, by) => talk.createComment(as(by), { thread: `e:${w.trashed}`, body: "Hello", mentions: [] }),
		expect: only({ owner: "FORBIDDEN", friend: "FORBIDDEN" }),
	},
	{
		name: "createComment: to the owner's friend (their thread)",
		run: (w, by) => talk.createComment(as(by), { thread: `f:${w.people.friend}`, body: "Hello", mentions: [] }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "updateComment: the owner's, in the group",
		run: (w, by) => talk.updateComment(as(by), { commentId: w.groupComment, body: "Boat at seven?", mentions: [] }),
		expect: only({ owner: "ok", member: "FORBIDDEN" }),
	},
	{
		name: "deleteComment: the owner's, in the group",
		run: (w, by) => talk.deleteComment(as(by), w.groupComment),
		expect: only({ owner: "ok", member: "FORBIDDEN" }),
	},
	{
		name: "react: to the owner's comment in the group",
		run: (w, by) => talk.react(as(by), { commentId: w.groupComment, emoji: "👍", on: true }),
		expect: only({ owner: "ok", member: "ok" }),
	},
	{
		name: "markThreadRead: the group's",
		run: (w, by) => talk.markThreadRead(as(by), `g:${w.group}`),
		expect: only({ owner: "ok", member: "ok", former: "ok" }),
	},
	{
		name: "markThreadRead: the shared expense's",
		run: (w, by) => talk.markThreadRead(as(by), `e:${w.shared}`),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "markRead (the caller's own notifications)",
		run: (_w, by) => inbox.markRead(as(by)),
		expect: everyone(),
	},
	{
		name: "updateNotifySettings (the caller's own)",
		run: (_w, by) => inbox.updateNotifySettings(as(by), { notify: { "expense.added": "instant" } }),
		expect: everyone(),
	},
	{
		name: "setFocus (the caller's own)",
		run: (_w, by) => inbox.setFocus(as(by), true),
		expect: everyone(),
	},
	// Task 93: Spend's chart, CSV, bulk actions, saved searches and import.
	{ name: "spendChart", run: (_w, by) => spend.spendChart(as(by), { q: "", groupBy: "category" }), expect: everyone() },
	{ name: "exportSpend", run: (_w, by) => spend.exportSpend(as(by), { q: "" }), expect: everyone() },
	{
		// A row the caller isn't on is skipped, not refused: none changed reads as NOT_FOUND here.
		name: "bulkExpenses: a category on the shared expense",
		run: async (w, by) => {
			const made = await lists.createCategory(as(by), { name: "Bulk", icon: "gift", color: "pink" });
			const categoryId = made.categories.find((each) => each.name === "Bulk")?.id ?? null;
			return changed(bulkExpenses(as(by), { ids: [w.shared], action: { kind: "category", categoryId } }));
		},
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "bulkExpenses: the personal expense to the trash",
		run: (w, by) => changed(bulkExpenses(as(by), { ids: [w.personal], action: { kind: "delete" } })),
		expect: only({ owner: "ok" }),
	},
	{
		name: "saveSearch",
		run: (_w, by) => saved.saveSearch(as(by), { name: "Food", query: "category:food" }),
		expect: everyone(),
	},
	{
		name: "renameSearch: the owner's",
		run: (w, by) => saved.renameSearch(as(by), { id: w.search, name: "Renamed" }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "reorderSearches: the owner's",
		run: (w, by) => saved.reorderSearches(as(by), [w.search]),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteSearch: the owner's",
		run: (w, by) => saved.deleteSearch(as(by), w.search),
		expect: only({ owner: "ok" }),
	},
	{
		name: "importSpend (the caller's own)",
		run: (_w, by) =>
			importSpend(as(by), {
				key: crypto.randomUUID(),
				rows: [
					{
						spentOn: today,
						kind: "expense",
						amountMinor: 100,
						currency: "NPR",
						title: "Tea",
						merchant: "",
						notes: "",
						category: "Snacks",
						tags: ["x"],
						method: "Cash",
					},
				],
			}),
		expect: everyone(),
	},
	{
		name: "listBudgets (the caller's own)",
		run: (_w, by) => budgets.listBudgets(as(by)),
		expect: everyone(),
	},
	{
		name: "createBudget (the caller's own)",
		run: (_w, by) =>
			budgets.createBudget(as(by), {
				categoryId: null,
				currency: "NPR",
				period: "week",
				amountMinor: 5_000,
				startsOn: today,
			}),
		expect: everyone(),
	},
	{
		name: "updateBudget: the owner's",
		run: (w, by) =>
			budgets.updateBudget(as(by), { budgetId: w.budget, version: 1, amountMinor: 9_000, startsOn: today }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "setBudgetMonth: the owner's",
		run: (w, by) => budgets.setBudgetMonth(as(by), { budgetId: w.budget, month: "2026-12", amountMinor: 9_000 }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteBudget: the owner's",
		run: (w, by) => budgets.deleteBudget(as(by), w.budget),
		expect: only({ owner: "ok" }),
	},
	{
		name: "listRecurring (the caller's own)",
		run: (_w, by) => recurring.listRecurring(as(by)),
		expect: everyone(),
	},
	{
		name: "repeatExpense: shared",
		run: (w, by) => recurring.repeatExpense(as(by), { expenseId: w.shared, unit: "month", every: 1, endsOn: null }),
		expect: only({ owner: "ok", friend: "ok" }),
	},
	{
		name: "repeatExpense: the group's old expense",
		run: (w, by) => recurring.repeatExpense(as(by), { expenseId: w.oldExpense, unit: "week", every: 2, endsOn: null }),
		expect: only({ owner: "ok", member: "ok", former: "FORBIDDEN" }),
	},
	{
		name: "repeatExpense: the personal one, already repeating",
		run: (w, by) => recurring.repeatExpense(as(by), { expenseId: w.personal, unit: "week", every: 1, endsOn: null }),
		expect: only({ owner: "CONFLICT" }),
	},
	{
		name: "updateRecurring: the owner's",
		run: (w, by) =>
			recurring.updateRecurring(as(by), { recurringId: w.recurring, version: 1, unit: "week", every: 1, endsOn: null }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "pauseRecurring: the owner's",
		run: (w, by) => recurring.pauseRecurring(as(by), { recurringId: w.recurring, paused: true }),
		expect: only({ owner: "ok" }),
	},
	{
		name: "skipRecurring: the owner's",
		run: (w, by) => recurring.skipRecurring(as(by), w.recurring),
		expect: only({ owner: "ok" }),
	},
	{
		name: "deleteRecurring: the owner's",
		run: (w, by) => recurring.deleteRecurring(as(by), w.recurring),
		expect: only({ owner: "ok" }),
	},
	{
		name: "insights (the caller's own): overview, trends, statement",
		run: async (_w, by) => {
			await insights.insightsOverview(as(by), {});
			await insights.insightsTrends(as(by), {});
			return insights.insightsStatement(as(by), {});
		},
		expect: everyone(),
	},
	{
		name: "updateProfile (the caller's own)",
		run: (_w, by) => me.updateProfile(as(by), { homeCurrency: "USD", timeZone: "Asia/Kolkata", payNote: "Cash" }),
		expect: everyone(),
	},
];

describe("Kharcha's access matrix", () => {
	beforeEach(async () => {
		world = await setUp();
	});

	for (const operation of OPERATIONS) {
		it(operation.name, async () => {
			const results: Partial<Record<Caller, string>> = {};
			for (const by of CALLERS) {
				results[by] = await code(operation.run(world, by));
				// A change by one caller mustn't decide the next one's answer.
				if (results[by] === "ok") world = await setUp();
			}
			const expected = Object.fromEntries(CALLERS.map((by) => [by, operation.expect[by] ?? "NOT_FOUND"]));
			expect(results).toEqual(expected);
		});
	}

	it("lists only the caller's own: groups, friends and balances", async () => {
		expect((await groups.listGroups(as("former"))).map((group) => [group.name, group.left])).toEqual([["Trip", true]]);
		expect(await groups.listGroups(as("stranger"))).toEqual([]);
		expect(await groups.listGroups(as("admin"))).toEqual([]);
		expect(await friends.listFriends(as("guest"))).toEqual([]);
		expect(await me.getBalances(as("stranger"))).toEqual({ owed: [], owe: [] });
	});

	it("shows Home only what the caller may see (Task 88)", async () => {
		const stranger = await home.getHome(as("stranger"));
		expect(stranger.recent).toEqual([]);
		expect(stranger.balances).toEqual({ owed: [], owe: [] });
		expect((await home.getHome(as("admin"))).recent).toEqual([]);

		// The friend: the two people's thread (the shared expense, the payment), never the group's.
		const friend = await home.getHome(as("friend"));
		expect(friend.recent.length).toBeGreaterThan(0);
		expect(friend.recent.every((line) => line.group === null)).toBe(true);
		expect(friend.recent.some((line) => line.kind === "payment.created")).toBe(true);

		// The former member: the group up to leaving; nothing the member did after.
		const former = await home.getHome(as("former"));
		expect(former.recent.some((line) => line.kind === "member.left" && line.subject?.isMe)).toBe(true);
		expect(former.recent.some((line) => line.actor?.id === world.people.member)).toBe(false);

		// The member sees what they did in the group, the payment in words.
		const member = await home.getHome(as("member"));
		const paid = member.recent.find((line) => line.kind === "payment.created");
		expect(paid?.payment?.from?.isMe).toBe(true);
		expect(paid?.payment?.amount).toEqual({ currency: "NPR", amountMinor: 1_000 });
	});

	it("keeps onboarding the caller's own (Task 88)", async () => {
		await me.completeOnboarding(as("guest"), { homeCurrency: "USD", timeZone: "Asia/Kolkata", start: "split" });
		const after = await me.getMe(as("guest"));
		expect(after.profile).toMatchObject({
			homeCurrency: "USD",
			timeZone: "Asia/Kolkata",
			start: "split",
			onboarded: true,
		});
		expect(after.rev).toBeGreaterThan(0);
		expect((await me.getMe(as("stranger"))).profile.onboarded).toBe(false);
	});
});
