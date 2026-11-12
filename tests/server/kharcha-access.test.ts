import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, insertUsers } from "./kharcha-helpers";

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

const as = (id: Caller) =>
	caller(env.db, id === "admin" ? "staff" : id, {
		guest: id === "guest",
		permissions: id === "admin" ? ["kharcha:read", "kharcha:configure"] : [],
	});
const today = "2026-11-12";

type World = {
	people: Record<"owner" | "friend" | "member" | "former" | "spare", string>;
	personal: string;
	shared: string;
	trashed: string;
	pairPayment: string;
	group: string;
	oldExpense: string;
	newExpense: string;
	groupPayment: string;
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
	return {
		people: { owner, friend, member, former, spare },
		personal,
		shared,
		trashed,
		pairPayment,
		group,
		oldExpense,
		newExpense,
		groupPayment,
	};
}

type Expected = Partial<Record<Caller, string>>;
type Operation = { name: string; run: (w: World, by: Caller) => Promise<unknown>; expect: Expected };

/** Everyone not named gets NOT_FOUND. */
const only = (expected: Expected): Expected => expected;

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
});
