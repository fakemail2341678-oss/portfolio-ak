import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers, reason } from "./kharcha-helpers";

/**
 * Kharcha's services on PGlite (docs/guides/kharcha.md): expenses, payments, groups and
 * friends, with the ledger's invariants checked after every kind of change (PLAN 14.5).
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha", "bikash"], ["guest"]));
}, 60_000);
afterAll(() => env.close());

const as = (id: string) => caller(env.db, id, { guest: id === "guest" });
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;
const today = "2026-11-12";

/** Maya, with Asha and Bikash as friends (added by their addresses, so their accounts' people). */
async function friendsOfMaya() {
	const maya = await personOf("maya");
	const asha = await personOf("asha");
	const bikash = await personOf("bikash");
	await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
	await friends.addFriend(as("maya"), { name: "Bikash", email: "BIKASH@example.com" });
	return { maya, asha, bikash };
}

beforeEach(async () => {
	await env.reset();
});

describe("Kharcha: the caller", () => {
	it("makes a person and a profile on first use, once", async () => {
		const first = await me.getMe(as("maya"));
		const again = await me.getMe(as("maya"));
		expect(again.person.id).toBe(first.person.id);
		expect(first.person).toMatchObject({ name: "Maya", isMe: true, hasAccount: true });
		expect(first.profile).toMatchObject({ homeCurrency: "NPR", timeZone: "Asia/Kathmandu", onboarded: false });
		expect(first.currencies).toContain("JPY");
		expect(await me.getRev(as("maya"))).toBe(0);
	});
});

describe("Kharcha: expenses", () => {
	it("a personal expense is the caller's alone: no debts, their whole share", async () => {
		const expense = await expenses.createExpense(as("maya"), {
			groupId: null,
			kind: "expense",
			title: "Groceries",
			merchant: "Bhat-Bhateni",
			notes: "",
			amountMinor: 245_000,
			currency: "NPR",
			spentOn: today,
		});
		expect(expense).toMatchObject({ myShareMinor: 245_000, myPaidMinor: 245_000, split: { method: "full" } });
		expect(await env.db.select().from(schema.khLedger)).toHaveLength(0);
		expect(await me.getRev(as("maya"))).toBe(1);
		await expectLedgerConsistent(env.db);
	});

	it("a shared expense writes who owes whom, and the balances follow every change", async () => {
		const { maya, asha, bikash } = await friendsOfMaya();
		const created = await expenses.createExpense(as("maya"), {
			groupId: null,
			kind: "expense",
			title: "Dinner",
			merchant: "",
			notes: "",
			amountMinor: 90_000,
			currency: "NPR",
			spentOn: today,
			split: { method: "equal", people: [maya, asha, bikash] },
		});
		await expectLedgerConsistent(env.db);
		expect(await me.getBalances(as("maya"))).toEqual({ owed: [{ currency: "NPR", amountMinor: 60_000 }], owe: [] });
		expect(await me.getBalances(as("asha"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 30_000 }] });
		// The first debt makes Asha and Bikash Maya's friends both ways; they aren't each other's.
		expect((await friends.listFriends(as("asha"))).map((friend) => friend.person.id)).toEqual([maya]);
		// Bumped by being added as a friend, then by the expense.
		expect(await me.getRev(as("asha"))).toBe(2);

		// The amount, the payers and the split change: the debts are written again, each change in the history.
		const updated = await expenses.updateExpense(as("asha"), {
			expenseId: created.id,
			version: created.version,
			kind: "expense",
			title: "Dinner by the lake",
			merchant: "",
			notes: "",
			amountMinor: 120_000,
			currency: "NPR",
			spentOn: today,
			payers: [
				{ person: maya, amount: 60_000 },
				{ person: asha, amount: 60_000 },
			],
			split: {
				method: "exact",
				parts: [
					{ person: maya, amount: 20_000 },
					{ person: asha, amount: 40_000 },
					{ person: bikash, amount: 60_000 },
				],
			},
		});
		expect(updated.version).toBe(2);
		await expectLedgerConsistent(env.db);
		expect(await me.getBalances(as("bikash"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 60_000 }] });
		const history = await env.db
			.select({ kind: schema.khActivity.kind, data: schema.khActivity.data })
			.from(schema.khActivity)
			.where(eq(schema.khActivity.expenseId, created.id));
		expect(history.map((row) => row.data.field ?? row.kind).sort()).toEqual(
			["expense.created", "amountMinor", "payers", "split", "title"].sort(),
		);

		// A save from the old version is stale.
		expect(
			await code(
				expenses.updateExpense(as("maya"), {
					expenseId: created.id,
					version: created.version,
					kind: "expense",
					title: "Old",
					merchant: "",
					notes: "",
					amountMinor: 90_000,
					currency: "NPR",
					spentOn: today,
					split: { method: "equal", people: [maya, asha, bikash] },
				}),
			),
		).toBe("CONFLICT");

		// To the trash and back: the debts go and come back with it.
		const trashed = await expenses.deleteExpense(as("bikash"), created.id);
		expect(trashed.can).toEqual({ edit: false, delete: false, restore: true });
		expect(await env.db.select().from(schema.khLedger)).toHaveLength(0);
		expect(await code(expenses.deleteExpense(as("maya"), created.id))).toBe("FORBIDDEN");
		await expectLedgerConsistent(env.db);
		await expenses.restoreExpense(as("maya"), created.id);
		expect(await code(expenses.restoreExpense(as("maya"), created.id))).toBe("FORBIDDEN");
		await expectLedgerConsistent(env.db);
		expect(await me.getBalances(as("bikash"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 60_000 }] });
		// After 30 days in the trash it is gone for everyone.
		await expenses.deleteExpense(as("maya"), created.id);
		const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
		expect(await code(expenses.restoreExpense(as("maya"), created.id, later))).toBe("NOT_FOUND");
	});

	it("refuses splits that don't add up, people who aren't friends, and currencies not offered", async () => {
		const { maya, asha } = await friendsOfMaya();
		const base = {
			groupId: null,
			kind: "expense" as const,
			title: "Taxi",
			merchant: "",
			notes: "",
			amountMinor: 1_000,
			currency: "NPR" as const,
			spentOn: today,
		};
		expect(
			await reason(
				expenses.createExpense(as("maya"), {
					...base,
					split: { method: "exact", parts: [{ person: maya, amount: 400 }] },
				}),
			),
		).toBe("NPR 6.00 left to assign");
		expect(await code(expenses.createExpense(as("maya"), { ...base, payers: [{ person: maya, amount: 900 }] }))).toBe(
			"BAD_REQUEST",
		);
		const stranger = crypto.randomUUID();
		expect(
			await code(expenses.createExpense(as("maya"), { ...base, split: { method: "equal", people: [maya, stranger] } })),
		).toBe("BAD_REQUEST");
		// Outside a group the caller has to be on it.
		expect(await code(expenses.createExpense(as("maya"), { ...base, split: { method: "full", person: asha } }))).toBe(
			"ok",
		);
		expect(
			await code(
				expenses.createExpense(as("maya"), {
					...base,
					payers: [{ person: asha, amount: 1_000 }],
					split: { method: "full", person: asha },
				}),
			),
		).toBe("BAD_REQUEST");
		await env.db.insert(schema.khSettings).values({ settings: { currencies: ["NPR"] } });
		expect(await code(expenses.createExpense(as("maya"), { ...base, currency: "USD" }))).toBe("BAD_REQUEST");
		await expectLedgerConsistent(env.db);
	});

	it("counts a refund as money back: its debts run the other way", async () => {
		const { maya, asha } = await friendsOfMaya();
		await expenses.createExpense(as("maya"), {
			groupId: null,
			kind: "refund",
			title: "Returned tickets",
			merchant: "",
			notes: "",
			amountMinor: 40_000,
			currency: "NPR",
			spentOn: today,
			split: { method: "equal", people: [maya, asha] },
		});
		expect(await me.getBalances(as("maya"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 20_000 }] });
		await expectLedgerConsistent(env.db);
	});

	it("holds to the quotas, a guest's smaller", async () => {
		await env.db
			.insert(schema.khSettings)
			.values({ settings: { quotas: { expenses: 2 }, guestQuotas: { expenses: 1 } } });
		const expense = (id: string) =>
			expenses.createExpense(as(id), {
				groupId: null,
				kind: "expense",
				title: "Tea",
				merchant: "",
				notes: "",
				amountMinor: 2_000,
				currency: "NPR",
				spentOn: today,
			});
		expect([await code(expense("maya")), await code(expense("maya")), await code(expense("maya"))]).toEqual([
			"ok",
			"ok",
			"FORBIDDEN",
		]);
		expect([await code(expense("guest")), await code(expense("guest"))]).toEqual(["ok", "FORBIDDEN"]);
	});
});

describe("Kharcha: payments", () => {
	it("settle a debt in its currency, noting another one at a typed rate", async () => {
		const { maya, asha } = await friendsOfMaya();
		await expenses.createExpense(as("maya"), {
			groupId: null,
			kind: "expense",
			title: "Hotel",
			merchant: "",
			notes: "",
			amountMinor: 100_000,
			currency: "NPR",
			spentOn: today,
			split: { method: "equal", people: [maya, asha] },
		});
		const payment = await payments.createPayment(as("asha"), {
			groupId: null,
			fromId: asha,
			toId: maya,
			amountMinor: 30_000,
			currency: "NPR",
			paid: { currency: "INR", amountMinor: 18_750, rate: "0.625" },
			method: "Cash",
			note: "",
			paidOn: today,
		});
		expect(payment.paid).toEqual({ currency: "INR", amountMinor: 18_750, rate: "0.62500000" });
		expect(await me.getBalances(as("asha"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 20_000 }] });
		await expectLedgerConsistent(env.db);

		const edited = await payments.updatePayment(as("maya"), {
			paymentId: payment.id,
			version: payment.version,
			amountMinor: 50_000,
			currency: "NPR",
			paid: null,
			method: "eSewa",
			note: "",
			paidOn: today,
		});
		expect(edited.paid).toBeNull();
		expect(await me.getBalances(as("asha"))).toEqual({ owed: [], owe: [] });
		await expectLedgerConsistent(env.db);

		await payments.deletePayment(as("asha"), payment.id);
		expect(await me.getBalances(as("asha"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 50_000 }] });
		await payments.restorePayment(as("asha"), payment.id);
		await expectLedgerConsistent(env.db);
		// Between two people other than the caller, outside a group: refused.
		expect(
			await code(
				payments.createPayment(as("bikash"), {
					groupId: null,
					fromId: asha,
					toId: maya,
					amountMinor: 1_000,
					currency: "NPR",
					paid: null,
					method: "",
					note: "",
					paidOn: today,
				}),
			),
		).toBe("BAD_REQUEST");
	});
});

describe("Kharcha: groups", () => {
	it("keep balances per member and suggest the fewest payments", async () => {
		const { maya, asha, bikash } = await friendsOfMaya();
		const group = await groups.createGroup(as("maya"), {
			name: "Pokhara trip",
			kind: "trip",
			color: "teal",
			currency: "NPR",
			startOn: "2026-10-01",
			endOn: "2026-10-04",
			memberIds: [asha, bikash],
		});
		expect(group).toMatchObject({ icon: "plane", members: expect.any(Array), can: { edit: true, manage: true } });
		const add = (id: string, payer: string, amount: number) =>
			expenses.createExpense(as(id), {
				groupId: group.id,
				kind: "expense",
				title: "Trip",
				merchant: "",
				notes: "",
				amountMinor: amount,
				currency: "NPR",
				spentOn: today,
				payers: [{ person: payer, amount }],
				split: { method: "equal", people: [maya, asha, bikash] },
			});
		await add("maya", maya, 360_000);
		await add("asha", asha, 900_000);
		await expenses.createExpense(as("bikash"), {
			groupId: group.id,
			kind: "expense",
			title: "Taxi",
			merchant: "",
			notes: "",
			amountMinor: 3_000,
			currency: "USD",
			spentOn: today,
			split: { method: "equal", people: [asha, bikash] },
		});
		const view = await groups.getGroup(as("bikash"), group.id);
		const npr = view.nets.find((net) => net.currency === "NPR");
		const netOf = (people: Array<{ personId: string; netMinor: number }> = []) =>
			Object.fromEntries(people.map((net) => [net.personId, net.netMinor]));
		expect(netOf(npr?.people)).toEqual({ [maya]: -60_000, [asha]: 480_000, [bikash]: -420_000 });
		expect(npr?.suggested).toEqual([
			{ from: bikash, to: asha, amount: 420_000 },
			{ from: maya, to: asha, amount: 60_000 },
		]);
		expect(netOf(view.nets.find((net) => net.currency === "USD")?.people)).toEqual({ [asha]: -1_500, [bikash]: 1_500 });
		expect((await groups.listGroups(as("maya")))[0]?.balances).toEqual([{ currency: "NPR", amountMinor: -60_000 }]);
		await expectLedgerConsistent(env.db);
	});

	it("let a member go only when settled; they keep the history up to then, read only", async () => {
		const { maya, asha, bikash } = await friendsOfMaya();
		const group = await groups.createGroup(as("maya"), {
			name: "Flat 3B",
			kind: "home",
			color: "amber",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [asha, bikash],
		});
		const rent = await expenses.createExpense(as("maya"), {
			groupId: group.id,
			kind: "expense",
			title: "Rent",
			merchant: "",
			notes: "",
			amountMinor: 2_000_000,
			currency: "NPR",
			spentOn: today,
			split: { method: "equal", people: [maya, asha] },
		});
		expect(await reason(groups.leaveGroup(as("asha"), group.id))).toBe(
			"Settle up before you leave: NPR 10,000.00 is still open.",
		);
		expect(await code(groups.removeMember(as("maya"), group.id, asha))).toBe("FORBIDDEN");
		expect(await code(groups.removeMember(as("asha"), group.id, bikash))).toBe("FORBIDDEN");
		await payments.createPayment(as("asha"), {
			groupId: group.id,
			fromId: asha,
			toId: maya,
			amountMinor: 1_000_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		});
		await groups.leaveGroup(as("asha"), group.id);
		// Asha still reads the group and the rent; she can't change them, nor see what comes after.
		const seen = await groups.getGroup(as("asha"), group.id);
		expect(seen).toMatchObject({ left: true, can: { edit: false, manage: false } });
		expect(await code(expenses.getExpense(as("asha"), rent.id))).toBe("ok");
		expect(await code(expenses.deleteExpense(as("asha"), rent.id))).toBe("FORBIDDEN");
		const later = await expenses.createExpense(as("bikash"), {
			groupId: group.id,
			kind: "expense",
			title: "Internet",
			merchant: "",
			notes: "",
			amountMinor: 135_600,
			currency: "NPR",
			spentOn: today,
			split: { method: "equal", people: [maya, bikash] },
		});
		expect(await code(expenses.getExpense(as("asha"), later.id))).toBe("NOT_FOUND");
		// Deleting the old rent would leave Asha owed again: refused, until she is added back.
		expect(await reason(expenses.deleteExpense(as("maya"), rent.id))).toBe(
			"This would leave someone who left the group owing or owed. Add them back to the group first.",
		);
		await groups.addMember(as("maya"), group.id, asha);
		expect(await code(expenses.deleteExpense(as("maya"), rent.id))).toBe("ok");
		await expectLedgerConsistent(env.db);

		// The owner, settled again (the rent back and Asha's payment, the internet gone), leaves: the group is handed on.
		await expenses.restoreExpense(as("maya"), rent.id);
		await expenses.deleteExpense(as("maya"), later.id);
		await groups.leaveGroup(as("maya"), group.id);
		const after = await groups.getGroup(as("asha"), group.id);
		const owners = after.members.filter((member) => member.role === "owner" && member.leftAt === null);
		expect(owners.map((owner) => owner.person.id)).toEqual([
			expect.stringMatching(new RegExp(`^(${asha}|${bikash})$`)),
		]);
		await expectLedgerConsistent(env.db);
	});

	it("archived, take no new expenses; only the owner archives", async () => {
		const { maya, asha } = await friendsOfMaya();
		const group = await groups.createGroup(as("maya"), {
			name: "Wedding",
			kind: "event",
			color: "pink",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [asha],
		});
		expect(await code(groups.archiveGroup(as("asha"), group.id, true))).toBe("FORBIDDEN");
		await groups.archiveGroup(as("maya"), group.id, true);
		expect(
			await reason(
				expenses.createExpense(as("asha"), {
					groupId: group.id,
					kind: "expense",
					title: "Flowers",
					merchant: "",
					notes: "",
					amountMinor: 5_000,
					currency: "NPR",
					spentOn: today,
					split: { method: "equal", people: [maya, asha] },
				}),
			),
		).toBe("This group is archived. Restore it to make changes.");
		await groups.archiveGroup(as("maya"), group.id, false);
		expect((await groups.getGroup(as("asha"), group.id)).archived).toBe(false);
	});

	it("save their form with a version, and log what changed", async () => {
		await friendsOfMaya();
		const group = await groups.createGroup(as("maya"), {
			name: "Trip",
			kind: "trip",
			color: "teal",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [],
		});
		const fields = {
			groupId: group.id,
			name: "Mustang trip",
			kind: "trip" as const,
			color: "blue" as const,
			currency: "NPR" as const,
			startOn: null,
			endOn: null,
			defaultSplit: "shares" as const,
			simplify: false,
		};
		const saved = await groups.updateGroup(as("maya"), { ...fields, version: group.version });
		expect(saved).toMatchObject({ name: "Mustang trip", settings: { defaultSplit: "shares", simplify: false } });
		expect(await code(groups.updateGroup(as("maya"), { ...fields, version: group.version }))).toBe("CONFLICT");
	});
});

describe("Kharcha: friends", () => {
	it("by address are one person for everyone; by name, a contact private to its creator", async () => {
		const { asha } = await friendsOfMaya();
		const byBikash = await friends.addFriend(as("bikash"), { name: "Asha G.", email: "asha@example.com" });
		expect(byBikash.person.id).toBe(asha);
		// Bikash's own name for her; the address goes back only to whoever added a contact.
		expect(byBikash).toMatchObject({ nickname: "Asha G.", email: null, person: { name: "Asha G." } });
		const contact = await friends.addFriend(as("maya"), { name: "Sita" });
		expect(contact.person.hasAccount).toBe(false);
		expect(await code(friends.getFriend(as("bikash"), contact.person.id))).toBe("NOT_FOUND");
		expect(await code(friends.addFriend(as("guest"), { name: "Ram", email: "ram@example.com" }))).toBe("FORBIDDEN");
		expect(await code(friends.addFriend(as("guest"), { name: "Ram" }))).toBe("ok");
		expect(await code(friends.addFriend(as("maya"), { name: "Me", email: "maya@example.com" }))).toBe("BAD_REQUEST");
		const hidden = await friends.updateFriend(as("maya"), {
			personId: contact.person.id,
			nickname: "Sita didi",
			hidden: true,
		});
		expect(hidden).toMatchObject({ nickname: "Sita didi", hidden: true, person: { name: "Sita didi" } });
	});
});
