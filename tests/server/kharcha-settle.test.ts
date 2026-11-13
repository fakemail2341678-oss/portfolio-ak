import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { khActivity, khSettings } from "@/server/db/schema";
import type { ReminderEmail } from "@/server/kharcha/access";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as totals from "@/server/kharcha/groups/totals";
import * as home from "@/server/kharcha/home/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import * as settle from "@/server/kharcha/settle/service";
import * as threads from "@/server/kharcha/threads/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers } from "./kharcha-helpers";

/**
 * Kharcha's balances and settling up (Task 91; docs/guides/kharcha.md "Balances and settling
 * up", decision 0285): balances after every kind of change, simplified and pair by pair,
 * partial payments, payments in another currency, the settle-up dialog's choices, the
 * group's totals, Home's debts, and reminders with their limits.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const sent: ReminderEmail[] = [];

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha", "bikash"], ["guest"]));
}, 60_000);
afterAll(() => env.close());

const as = (id: string) => ({
	...caller(env.db, id, { guest: id === "guest" }),
	sendReminder: (email: ReminderEmail) => sent.push(email),
});
const today = "2026-11-12";
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;

beforeEach(async () => {
	await env.reset();
	sent.length = 0;
});

const expense = (overrides: Partial<Parameters<typeof expenses.createExpense>[1]> = {}) => ({
	groupId: null,
	kind: "expense" as const,
	title: "Dinner",
	merchant: "",
	notes: "",
	amountMinor: 300_000,
	currency: "NPR" as const,
	spentOn: today,
	...overrides,
});

const payment = (overrides: Partial<Parameters<typeof payments.createPayment>[1]>) => ({
	groupId: null,
	fromId: "",
	toId: "",
	amountMinor: 0,
	currency: "NPR" as const,
	paid: null,
	method: "",
	note: "",
	paidOn: today,
	...overrides,
});

/** Maya's trip with Asha and Bikash: Maya paid NPR 3,000 for the three. */
async function trip(simplify = true) {
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
	if (!simplify) {
		await groups.updateGroup(as("maya"), {
			groupId: group.id,
			version: group.version,
			name: group.name,
			kind: group.kind,
			color: group.color,
			icon: group.icon,
			currency: "NPR",
			startOn: null,
			endOn: null,
			defaultSplit: "equal",
			simplify: false,
		});
	}
	await expenses.createExpense(
		as("maya"),
		expense({ groupId: group.id, split: { method: "equal", people: [maya, asha, bikash] } }),
	);
	return { maya, asha, bikash, group: group.id };
}

const netsOf = async (by: string, groupId: string) =>
	Object.fromEntries(
		((await groups.getGroup(as(by), groupId)).nets.find((net) => net.currency === "NPR")?.people ?? []).map((net) => [
			net.personId,
			net.netMinor,
		]),
	);

describe("balances and payments", () => {
	it("follow full and partial payments, edits, the trash and restoring", async () => {
		const { maya, asha, bikash, group } = await trip();
		expect(await netsOf("maya", group)).toEqual({ [maya]: 200_000, [asha]: -100_000, [bikash]: -100_000 });

		// A partial payment: Asha pays 400 of her 1,000.
		const partial = await payments.createPayment(
			as("asha"),
			payment({ groupId: group, fromId: asha, toId: maya, amountMinor: 40_000 }),
		);
		expect(await netsOf("maya", group)).toEqual({ [maya]: 160_000, [asha]: -60_000, [bikash]: -100_000 });
		await expectLedgerConsistent(env.db);

		// Edited up to the rest of it: Asha is settled.
		await payments.updatePayment(as("asha"), {
			paymentId: partial.id,
			version: partial.version,
			amountMinor: 100_000,
			currency: "NPR",
			paid: null,
			method: "eSewa",
			note: "",
			paidOn: today,
		});
		expect(await netsOf("maya", group)).toEqual({ [maya]: 100_000, [bikash]: -100_000 });

		// To the trash and back.
		await payments.deletePayment(as("maya"), partial.id);
		expect(await netsOf("maya", group)).toEqual({ [maya]: 200_000, [asha]: -100_000, [bikash]: -100_000 });
		await payments.restorePayment(as("maya"), partial.id);
		expect(await netsOf("maya", group)).toEqual({ [maya]: 100_000, [bikash]: -100_000 });

		// Bikash settles: everyone is, and the group's suggestions are gone.
		await payments.createPayment(
			as("bikash"),
			payment({ groupId: group, fromId: bikash, toId: maya, amountMinor: 100_000 }),
		);
		const settled = await groups.getGroup(as("maya"), group);
		expect(settled.nets).toEqual([]);
		expect(settled.balances).toEqual([]);
		await expectLedgerConsistent(env.db);
	});

	it("suggest the fewest payments when simplified, and who owes whom pair by pair when not", async () => {
		const simplified = await trip();
		// Asha pays for Bikash and Maya: Asha 600 up, Bikash owes both.
		await expenses.createExpense(
			as("asha"),
			expense({
				groupId: simplified.group,
				amountMinor: 90_000,
				split: { method: "equal", people: [simplified.maya, simplified.asha, simplified.bikash] },
			}),
		);
		const view = await groups.getGroup(as("maya"), simplified.group);
		const nets = view.nets[0];
		expect(nets?.suggested.length).toBeLessThanOrEqual((nets?.people.length ?? 0) - 1);
		const sum = (personId: string) =>
			(nets?.suggested ?? []).reduce(
				(total, t) => total + (t.to === personId ? t.amount : 0) - (t.from === personId ? t.amount : 0),
				0,
			);
		for (const entry of nets?.people ?? []) expect(sum(entry.personId)).toBe(entry.netMinor);

		await env.reset();
		const { maya, asha, bikash, group } = await trip(false);
		await expenses.createExpense(
			as("asha"),
			expense({ groupId: group, amountMinor: 90_000, split: { method: "equal", people: [maya, asha, bikash] } }),
		);
		const pairwise = (await groups.getGroup(as("maya"), group)).nets[0]?.suggested;
		// Asha owes Maya 1,000 and Maya owes Asha 300: netted to 700. Bikash owes each of them.
		expect(pairwise).toEqual(
			expect.arrayContaining([
				{ from: asha, to: maya, amount: 70_000 },
				{ from: bikash, to: maya, amount: 100_000 },
				{ from: bikash, to: asha, amount: 30_000 },
			]),
		);
		expect(pairwise).toHaveLength(3);
	});

	it("note a payment in another currency at the typed rate, settling the debt in its own", async () => {
		const { maya, asha, group } = await trip();
		const made = await payments.createPayment(
			as("asha"),
			payment({
				groupId: group,
				fromId: asha,
				toId: maya,
				amountMinor: 100_000,
				paid: { currency: "INR", amountMinor: 62_500, rate: "0.625" },
			}),
		);
		// The rate is stored as a decimal with its 8 places.
		expect(made.paid).toEqual({ currency: "INR", amountMinor: 62_500, rate: "0.62500000" });
		expect((await netsOf("maya", group))[asha]).toBeUndefined();
		// Nothing in INR is owed: the debt was NPR.
		expect((await groups.getGroup(as("maya"), group)).nets.map((net) => net.currency)).toEqual(["NPR"]);

		const wrong = payment({
			groupId: group,
			fromId: asha,
			toId: maya,
			amountMinor: 10_000,
			paid: { currency: "INR", amountMinor: 6_000, rate: "0.625" },
		});
		expect(await code(payments.createPayment(as("asha"), wrong))).toBe("BAD_REQUEST");
		const same = { ...wrong, paid: { currency: "NPR" as const, amountMinor: 10_000, rate: "1" } };
		expect(await code(payments.createPayment(as("asha"), same))).toBe("BAD_REQUEST");
		// Yen have no minor digits: NPR 1,000.00 at 1.1 yen a rupee is ¥1,100.
		const yen = payment({
			groupId: group,
			fromId: asha,
			toId: maya,
			amountMinor: 100_000,
			paid: { currency: "JPY", amountMinor: 1_100, rate: "1.1" },
		});
		expect(await code(payments.createPayment(as("asha"), yen))).toBe("ok");
		await expectLedgerConsistent(env.db);
	});
});

describe("the settle-up dialog's choices", () => {
	it("offers a group's suggestions, a friend's balances by scope, and every balance of the caller's", async () => {
		const { maya, asha, bikash, group } = await trip();
		// Outside groups, Maya owes Asha 500.
		await expenses.createExpense(
			as("asha"),
			expense({ amountMinor: 100_000, split: { method: "equal", people: [maya, asha] } }),
		);

		const inGroup = await settle.getSettleUp(as("bikash"), { groupId: group });
		expect(inGroup.group?.id).toBe(group);
		expect(inGroup.pickable.sort()).toEqual([maya, asha, bikash].sort());
		// The caller's own first: Bikash's debt before Asha's.
		expect(inGroup.choices[0]).toMatchObject({ fromId: bikash, toId: maya, amountMinor: 100_000, groupId: group });
		expect(inGroup.choices).toHaveLength(2);

		const withAsha = await settle.getSettleUp(as("maya"), { groupId: null, personId: asha });
		expect(withAsha.choices).toEqual([
			{ groupId: null, group: null, fromId: maya, toId: asha, amountMinor: 50_000, currency: "NPR" },
			{ groupId: group, group: "Pokhara trip", fromId: asha, toId: maya, amountMinor: 100_000, currency: "NPR" },
		]);

		const everything = await settle.getSettleUp(as("maya"), { groupId: null });
		// Outside groups first; in the group, its members' order (who joined first, then by id).
		expect(everything.choices[0]).toMatchObject({ group: null, fromId: maya, amountMinor: 50_000 });
		expect(
			everything.choices
				.slice(1)
				.map((choice) => [choice.group, choice.fromId, choice.amountMinor])
				.sort(),
		).toEqual(
			[
				["Pokhara trip", asha, 100_000],
				["Pokhara trip", bikash, 100_000],
			].sort(),
		);
		expect(everything.pickable).toContain(maya);

		// Asha's pay note shows to Maya, and on Asha's page.
		await me.updateProfile(as("asha"), { homeCurrency: "NPR", timeZone: "Asia/Kathmandu", payNote: " eSewa 98 " });
		expect((await settle.getSettleUp(as("maya"), { groupId: null, personId: asha })).payNotes).toEqual({
			[asha]: "eSewa 98",
		});
		expect((await threads.getFriendThread(as("maya"), asha)).payNote).toBe("eSewa 98");

		// A former member settles nothing there; a stranger sees nothing.
		expect(await code(settle.getSettleUp(as("guest"), { groupId: group }))).toBe("NOT_FOUND");
	});

	it("lists the friends the caller owes as Home's to-dos", async () => {
		const { asha, bikash } = await trip();
		const todos = (await home.getHome(as("asha"))).todos.filter((todo) => todo.kind === "settle");
		expect(todos).toEqual([
			expect.objectContaining({ kind: "settle", owe: [{ currency: "NPR", amountMinor: 100_000 }] }),
		]);
		expect((await home.getHome(as("maya"))).todos.some((todo) => todo.kind === "settle")).toBe(false);
		expect([asha, bikash]).toHaveLength(2);
	});
});

describe("a group's totals", () => {
	it("sum what was spent, each member's share and payments, and the caller's categories, refunds against them", async () => {
		const { maya, asha, bikash, group } = await trip();
		await expenses.createExpense(
			as("asha"),
			expense({
				groupId: group,
				kind: "refund",
				amountMinor: 30_000,
				split: { method: "equal", people: [maya, asha, bikash] },
			}),
		);
		// A payment is never spending.
		await payments.createPayment(
			as("bikash"),
			payment({ groupId: group, fromId: bikash, toId: maya, amountMinor: 50_000 }),
		);
		const { currencies } = await totals.getGroupTotals(as("maya"), group);
		expect(currencies).toHaveLength(1);
		const npr = currencies[0];
		expect(npr?.spentMinor).toBe(270_000);
		const member = (id: string) => npr?.members.find((each) => each.personId === id);
		expect(member(maya)).toEqual({ personId: maya, paidMinor: 300_000, shareMinor: 90_000 });
		expect(member(asha)).toEqual({ personId: asha, paidMinor: -30_000, shareMinor: 90_000 });
		expect(npr?.mine.reduce((total, row) => total + row.shareMinor, 0)).toBe(90_000);
		expect(await code(totals.getGroupTotals(as("guest"), group))).toBe("NOT_FOUND");
	});
});

describe("reminders", () => {
	it("email a friend who owes, once a day, with the amounts and the sender's pay note", async () => {
		const { asha } = await trip();
		await me.updateProfile(as("maya"), { homeCurrency: "NPR", timeZone: "Asia/Kathmandu", payNote: "Khalti 98" });
		const before = await threads.getFriendThread(as("maya"), asha);
		expect(before.remind).toEqual({ available: true, lastAt: null });

		await settle.remindFriend(as("maya"), asha);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			to: "asha@example.com",
			data: { sender: expect.any(String), amounts: [{ currency: "NPR", amountMinor: 100_000 }], payNote: "Khalti 98" },
		});
		expect(sent[0]?.data.url).toContain("/app/kharcha/f/");
		// A line in the two people's thread, for both.
		const line = await env.db.select().from(khActivity).where(eq(khActivity.kind, "friend.reminded"));
		expect(line).toHaveLength(1);
		expect((await threads.getFriendThread(as("maya"), asha)).remind.lastAt).not.toBeNull();

		expect(await code(settle.remindFriend(as("maya"), asha))).toBe("RATE_LIMITED");
		expect(sent).toHaveLength(1);
		// A day later, again.
		const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
		expect(await code(settle.remindFriend(as("maya"), asha, tomorrow))).toBe("ok");
		expect(sent).toHaveLength(2);
	});

	it("go only where something is owed, to an address, while reminders are on", async () => {
		const { maya, asha } = await trip();
		// Asha owes Maya; Maya owes Asha nothing.
		expect(await code(settle.remindFriend(as("asha"), maya))).toBe("BAD_REQUEST");
		expect((await threads.getFriendThread(as("asha"), maya)).remind.available).toBe(false);

		// A contact without an address can't be reminded; one with an address can, in the sender's language.
		const nameOnly = (await friends.addFriend(as("maya"), { name: "Ram" })).person.id;
		const withAddress = (await friends.addFriend(as("maya"), { name: "Sita", email: "sita@elsewhere.example" })).person
			.id;
		for (const id of [nameOnly, withAddress]) {
			await expenses.createExpense(
				as("maya"),
				expense({ amountMinor: 20_000, split: { method: "equal", people: [maya, id] } }),
			);
		}
		expect(await code(settle.remindFriend(as("maya"), nameOnly))).toBe("BAD_REQUEST");
		await settle.remindFriend(as("maya"), withAddress);
		expect(sent.at(-1)).toMatchObject({ to: "sita@elsewhere.example", locale: "en" });
		expect(sent.at(-1)?.data.url).not.toContain("/f/");

		// The admin's switch.
		await env.db
			.insert(khSettings)
			.values({ id: 1, settings: { reminders: false } })
			.onConflictDoUpdate({ target: khSettings.id, set: { settings: { reminders: false } } });
		expect(await code(settle.remindFriend(as("maya"), asha))).toBe("FORBIDDEN");
		expect((await threads.getFriendThread(as("maya"), asha)).remind.available).toBe(false);
	});

	it("never come from a guest", async () => {
		const guest = await personOf("guest");
		const friend = (await friends.addFriend(as("guest"), { name: "Placeholder" })).person.id;
		await expenses.createExpense(as("guest"), expense({ split: { method: "equal", people: [guest, friend] } }));
		expect(await code(settle.remindFriend(as("guest"), friend))).toBe("FORBIDDEN");
		expect((await threads.getFriendThread(as("guest"), friend)).remind.available).toBe(false);
		expect(sent).toHaveLength(0);
	});
});
