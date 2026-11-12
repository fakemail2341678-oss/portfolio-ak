import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import * as expenses from "@/server/kharcha/expenses/service";
import { forgetUser } from "@/server/kharcha/forget";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import { befriend, ensurePerson, mergePerson } from "@/server/kharcha/people";
import { createTestDb } from "../utils/test-db";
import { caller, expectLedgerConsistent, insertUsers } from "./kharcha-helpers";

/**
 * Kharcha's people (decision 0277): a person per account made on first use, a waiting
 * person taken over by the verified account with its address, two people merged into one
 * (every reference, checked from the database's own list of foreign keys), and what stays
 * when an account goes.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await insertUsers(db, ["maya", "asha"], ["guest"]);
		await db.insert(schema.user).values({ id: "unverified", name: "Ram", email: "ram@example.com" });
	});
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => caller(env.db, id, { guest: id === "guest" });
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;
const today = "2026-11-12";
const base = {
	kind: "expense" as const,
	title: "Test",
	merchant: "",
	notes: "",
	currency: "NPR" as const,
	spentOn: today,
};

/** Every column of a Kharcha table that points at `kh_person`, from the database's own catalogue. */
async function personReferences(): Promise<Array<{ table: string; column: string }>> {
	const result = await env.client.query<{ table: string; column: string }>(`
		select c.conrelid::regclass::text as "table", a.attname as "column"
		from pg_constraint c
		join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
		where c.contype = 'f' and c.confrelid = 'kh_person'::regclass
		order by 1, 2
	`);
	return result.rows;
}

async function referencesTo(personId: string): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const { table, column } of await personReferences()) {
		// Names from the catalogue, quoted; the id is a parameter.
		const result = await env.client.query<{ count: number }>(
			`select count(*)::int as "count" from "${table}" where "${column}" = $1`,
			[personId],
		);
		counts[`${table}.${column}`] = Number(result.rows[0]?.count ?? 0);
	}
	return counts;
}

describe("ensurePerson", () => {
	it("hands a verified account the person waiting under its address; never to an unverified one or a guest", async () => {
		const waiting = (await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" })).person.id;
		expect(await personOf("asha")).toBe(waiting);
		const ram = (await friends.addFriend(as("maya"), { name: "Ram", email: "ram@example.com" })).person.id;
		expect(await personOf("unverified")).not.toBe(ram);
		const guest = await env.db.transaction((tx) => ensurePerson(tx, "guest"));
		expect(guest.email).toBeNull();
	});
});

describe("mergePerson", () => {
	it("moves every reference, adds up what both were on, and drops what was between them", async () => {
		const guest = await personOf("guest");
		const maya = await personOf("maya");
		// The guest's own world: a contact, a group with an expense, payments both ways, one outside a group.
		const sita = (await friends.addFriend(as("guest"), { name: "Sita" })).person.id;
		const group = await groups.createGroup(as("guest"), {
			name: "Flat",
			kind: "home",
			color: "amber",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [sita],
		});
		await expenses.createExpense(as("guest"), {
			...base,
			groupId: group.id,
			amountMinor: 60_000,
			split: { method: "equal", people: [guest, sita] },
		});
		await expenses.createExpense(as("guest"), {
			...base,
			groupId: null,
			amountMinor: 9_000,
			payers: [{ person: sita, amount: 9_000 }],
			split: { method: "equal", people: [guest, sita] },
		});
		for (const [from, to] of [
			[guest, sita],
			[sita, guest],
		] as const) {
			await payments.createPayment(as("guest"), {
				groupId: null,
				fromId: from,
				toId: to,
				amountMinor: 500,
				currency: "NPR",
				paid: null,
				method: "",
				note: "",
				paidOn: today,
			});
		}
		// The guest leaves a group of their own making and is added back: a subject in the history.
		const spare = (await friends.addFriend(as("guest"), { name: "Spare" })).person.id;
		const other = await groups.createGroup(as("guest"), {
			name: "Other",
			kind: "other",
			color: "gray",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [spare],
		});
		await groups.leaveGroup(as("guest"), other.id);

		// And Maya and the guest on one expense, a payment between them, friends both ways.
		await env.db.transaction((tx) => befriend(tx, [[maya, guest]]));
		await friends.updateFriend(as("maya"), { personId: guest, nickname: "Me on my phone" });
		const both = await expenses.createExpense(as("maya"), {
			...base,
			groupId: null,
			amountMinor: 30_000,
			payers: [
				{ person: maya, amount: 20_000 },
				{ person: guest, amount: 10_000 },
			],
			split: {
				method: "shares",
				parts: [
					{ person: maya, weight: 1 },
					{ person: guest, weight: 2 },
				],
			},
		});
		await payments.createPayment(as("maya"), {
			groupId: null,
			fromId: maya,
			toId: guest,
			amountMinor: 700,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: today,
		});
		// Their own lists (Task 89): categories and methods from the defaults, a tag, a rule,
		// a receipt draft, and an expense that carries them.
		const mayaLists = await lists.getLists(as("maya"));
		const guestLists = await lists.getLists(as("guest"));
		const food = guestLists.categories.find((category) => category.key === "food");
		const cash = guestLists.methods[0];
		const tag = (await lists.createTag(as("guest"), "Trip")).tags[0];
		await lists.createTag(as("maya"), "trip");
		if (!food || !cash || !tag) throw new Error("the guest's lists are missing");
		await lists.createCategory(as("guest"), { name: "Momos", icon: "utensils", color: "orange" });
		await lists.createRule(as("guest"), {
			match: "contains",
			pattern: "Momo",
			categoryId: food.id,
			tagIds: [tag.id],
			methodId: cash.id,
		});
		await env.db.insert(schema.khReceiptDraft).values({ ownerId: guest });
		// Invites (Task 90): one to the guest, one from them (guests send none through the service).
		const invite = { email: "x@example.com", expiresAt: new Date(Date.now() + 86_400_000) };
		await env.db.insert(schema.khInvite).values([
			{ ...invite, personId: guest, invitedBy: sita, tokenHash: "a".repeat(64) },
			{ ...invite, personId: sita, invitedBy: guest, tokenHash: "b".repeat(64) },
		]);
		const tagged = await expenses.createExpense(as("guest"), {
			...base,
			groupId: null,
			amountMinor: 1_000,
			merchant: "Momo house",
		});
		expect(tagged.mine).toMatchObject({ categoryId: food.id, tagIds: [tag.id], methodId: cash.id });
		await expectLedgerConsistent(env.db);

		const before = await referencesTo(guest);
		// The scenario reaches every column that points at a person.
		// A thread's two people are stored lower id first: the guest is one or the other.
		const pair = (before["kh_activity.person_lo"] ?? 0) + (before["kh_activity.person_hi"] ?? 0);
		expect(pair).toBeGreaterThan(0);
		expect(
			Object.entries(before).filter(([column, count]) => count === 0 && !column.startsWith("kh_activity.person_")),
		).toEqual([]);
		expect(Object.keys(before).length).toBeGreaterThanOrEqual(18);

		await env.db.transaction((tx) => mergePerson(tx, guest, maya));

		expect(Object.values(await referencesTo(guest)).every((count) => count === 0)).toBe(true);
		expect(await env.db.select().from(schema.khPerson).where(eq(schema.khPerson.id, guest))).toEqual([]);
		// The expense both were on: one payer and one share, the split now the shares it gave.
		const merged = await expenses.getExpense(as("maya"), both.id);
		expect(merged.payers).toEqual([{ personId: maya, amountMinor: 30_000 }]);
		expect(merged.shares).toEqual([{ personId: maya, owedMinor: 30_000 }]);
		expect(merged.split).toEqual({ method: "exact", parts: [{ person: maya, amount: 30_000 }] });
		// One list: the same built-in and the same names are one; the guest's own category moved.
		const after = await lists.getLists(as("maya"));
		const mayaFood = mayaLists.categories.find((category) => category.key === "food");
		expect(after.categories.filter((category) => category.key === "food").map((category) => category.id)).toEqual([
			mayaFood?.id,
		]);
		expect(after.categories.at(-1)?.name).toBe("Momos");
		expect(after.tags.map((each) => each.name)).toEqual(["trip"]);
		expect(after.methods).toHaveLength(mayaLists.methods.length);
		expect(after.rules).toHaveLength(1);
		const moved = await expenses.getExpense(as("maya"), tagged.id);
		expect(moved.category?.id).toBe(mayaFood?.id);
		expect(moved.tags.map((each) => each.name)).toEqual(["trip"]);
		expect(moved.method?.name).toBe("Cash");
		// The payment between them is gone; the rest is Maya's now.
		const mine = await env.db.select().from(schema.khPayment).where(eq(schema.khPayment.createdBy, maya));
		expect(mine.map((payment) => payment.amountMinor).sort()).toEqual([500, 500]);
		expect((await friends.listFriends(as("maya"))).map((friend) => friend.person.name).sort()).toEqual([
			"Sita",
			"Spare",
		]);
		expect((await groups.listGroups(as("maya"))).map((row) => [row.name, row.left])).toEqual(
			expect.arrayContaining([
				["Flat", false],
				["Other", true],
			]),
		);
		// With Sita, all of it: 300 for the flat, 5 paid each way, 45 for her side outside: she owes 255.
		expect(await me.getBalances(as("maya"))).toEqual({ owed: [{ currency: "NPR", amountMinor: 25_500 }], owe: [] });
		await expectLedgerConsistent(env.db);
	});
});

describe("when an account goes", () => {
	it("what was theirs alone goes; what they shared stays, under their name, without the account", async () => {
		const maya = await personOf("maya");
		const asha = await personOf("asha");
		await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
		const contact = (await friends.addFriend(as("maya"), { name: "Bikash" })).person.id;
		const personal = await expenses.createExpense(as("maya"), { ...base, groupId: null, amountMinor: 1_000 });
		const withContact = await expenses.createExpense(as("maya"), {
			...base,
			groupId: null,
			amountMinor: 2_000,
			split: { method: "equal", people: [maya, contact] },
		});
		const shared = await expenses.createExpense(as("maya"), {
			...base,
			groupId: null,
			amountMinor: 3_000,
			split: { method: "equal", people: [maya, asha] },
		});
		const alone = await groups.createGroup(as("maya"), {
			name: "Mine",
			kind: "other",
			color: "gray",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [contact],
		});

		await forgetUser(env.db, "maya");
		await env.db.delete(schema.user).where(eq(schema.user.id, "maya"));

		const left = async (table: typeof schema.khExpense, id: string) =>
			(await env.db.select({ id: table.id }).from(table).where(eq(table.id, id))).length;
		expect(await left(schema.khExpense, personal.id)).toBe(0);
		expect(await left(schema.khExpense, withContact.id)).toBe(0);
		expect(await left(schema.khExpense, shared.id)).toBe(1);
		expect(await env.db.select().from(schema.khGroup).where(eq(schema.khGroup.id, alone.id))).toEqual([]);
		expect(await env.db.select().from(schema.khPerson).where(eq(schema.khPerson.id, contact))).toEqual([]);
		const [kept] = await env.db.select().from(schema.khPerson).where(eq(schema.khPerson.id, maya));
		expect(kept).toMatchObject({ userId: null, displayName: "Maya" });
		// Asha's side doesn't change: Maya still owes her, under Maya's name.
		expect(await me.getBalances(as("asha"))).toEqual({ owed: [], owe: [{ currency: "NPR", amountMinor: 1_500 }] });
		expect(
			(await friends.listFriends(as("asha"))).map((friend) => [friend.person.name, friend.person.hasAccount]),
		).toEqual([["Maya", false]]);
		await expectLedgerConsistent(env.db);
	});
});
