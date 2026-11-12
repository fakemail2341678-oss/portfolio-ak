import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Split } from "@/features/kharcha/money/split";
import { khExpenseShare, khInvite, khPerson, khSettings, user } from "@/server/db/schema";
import type { InviteEmail } from "@/server/kharcha/access";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as invites from "@/server/kharcha/invites/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import * as threads from "@/server/kharcha/threads/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers, reason } from "./kharcha-helpers";

/**
 * Kharcha's friends, groups, invites, joining, splits and threads (Task 90; docs/guides/kharcha.md
 * "Invites and joining", "People and threads"): splits through the services, each person's
 * own category, the merge on joining, the invite limits, and what a thread holds.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const sent: InviteEmail[] = [];

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await insertUsers(db, ["maya", "asha", "bikash", "sita"], ["guest"]);
		// An account that used Kharcha before its address was verified.
		await db.insert(user).values({ id: "late", name: "Late", email: "late@example.com", emailVerified: false });
	});
}, 60_000);
afterAll(() => env.close());

const as = (id: string) => ({
	...caller(env.db, id, { guest: id === "guest" }),
	sendInvite: (email: InviteEmail) => sent.push(email),
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

async function trip() {
	const maya = await personOf("maya");
	const asha = await personOf("asha");
	const bikash = await personOf("bikash");
	for (const name of ["asha", "bikash"]) await friends.addFriend(as("maya"), { name, email: `${name}@example.com` });
	const group = await groups.createGroup(as("maya"), {
		name: "Pokhara trip",
		kind: "trip",
		color: "teal",
		icon: "plane",
		currency: "NPR",
		startOn: "2026-10-03",
		endOn: "2026-10-06",
		memberIds: [asha, bikash],
	});
	return { maya, asha, bikash, group: group.id };
}

describe("splits through the services", () => {
	it("saves every method with exact shares and keeps the ledger whole", async () => {
		const { maya, asha, bikash, group } = await trip();
		const splits: Split[] = [
			{ method: "equal", people: [maya, asha, bikash] },
			{
				method: "exact",
				parts: [
					{ person: maya, amount: 100_000 },
					{ person: asha, amount: 150_000 },
					{ person: bikash, amount: 50_000 },
				],
			},
			{
				method: "percent",
				parts: [
					{ person: maya, bp: 3_333 },
					{ person: asha, bp: 3_333 },
					{ person: bikash, bp: 3_334 },
				],
			},
			{
				method: "shares",
				parts: [
					{ person: maya, weight: 2 },
					{ person: asha, weight: 1 },
					{ person: bikash, weight: 1 },
				],
			},
			{
				method: "adjustment",
				parts: [
					{ person: maya, adjust: 30_000 },
					{ person: asha, adjust: 0 },
					{ person: bikash, adjust: -30_000 },
				],
			},
			{
				method: "itemized",
				lines: [
					{ label: "Momo", amount: 100_000, people: [maya, asha] },
					{ label: "Thakali set", amount: 141_640, people: [bikash] },
				],
				service: 24_164,
				tax: 34_196,
			},
			{ method: "full", person: bikash },
		];
		for (const split of splits) {
			const saved = await expenses.createExpense(as("asha"), expense({ groupId: group, split, title: split.method }));
			expect(
				saved.shares.reduce((sum, share) => sum + share.owedMinor, 0),
				split.method,
			).toBe(300_000);
		}
		// Several payers.
		await expenses.createExpense(
			as("bikash"),
			expense({
				groupId: group,
				payers: [
					{ person: bikash, amount: 200_000 },
					{ person: maya, amount: 100_000 },
				],
				split: { method: "equal", people: [maya, asha, bikash] },
			}),
		);
		await expectLedgerConsistent(env.db);
		const thread = await threads.getGroupThread(as("maya"), group);
		expect(thread.items.filter((item) => item.type === "expense")).toHaveLength(8);
	});

	it("refuses a split that doesn't add up, saying what is left", async () => {
		const { maya, asha, group } = await trip();
		const split: Split = {
			method: "exact",
			parts: [
				{ person: maya, amount: 100_000 },
				{ person: asha, amount: 80_000 },
			],
		};
		expect(await reason(expenses.createExpense(as("maya"), expense({ groupId: group, split })))).toMatch(/1,200\.00/);
	});

	it("gives each person on it their own category of the creator's built-in", async () => {
		const { maya, asha, bikash, group } = await trip();
		const mine = await lists.getLists(as("maya"));
		await lists.getLists(as("asha")); // Asha's lists exist; Bikash never opened his.
		const food = mine.categories.find((category) => category.key === "food");
		const saved = await expenses.createExpense(
			as("maya"),
			expense({
				groupId: group,
				categoryId: food?.id ?? null,
				split: { method: "equal", people: [maya, asha, bikash] },
			}),
		);
		const shares = await env.db.select().from(khExpenseShare).where(eq(khExpenseShare.expenseId, saved.id));
		const categoryOf = (personId: string) => shares.find((share) => share.personId === personId)?.categoryId ?? null;
		expect(categoryOf(maya)).toBe(food?.id);
		const ashas = await lists.getLists(as("asha"));
		expect(categoryOf(asha)).toBe(ashas.categories.find((category) => category.key === "food")?.id);
		expect(categoryOf(bikash)).toBeNull();
	});
});

describe("groups", () => {
	it("adds someone new as a member, made a friend on the way; a guest by name only", async () => {
		const { group } = await trip();
		const view = await groups.addNewMember(as("maya"), { groupId: group, name: "Ram", email: "ram@example.com" });
		expect(view.members.map((member) => member.person.name)).toContain("Ram");
		expect((await friends.listFriends(as("maya"))).map((friend) => friend.person.name)).toContain("Ram");
		const guestGroup = await groups.createGroup(as("guest"), {
			name: "Flat",
			kind: "home",
			color: "indigo",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [],
		});
		expect(
			await code(groups.addNewMember(as("guest"), { groupId: guestGroup.id, name: "Hari", email: "hari@example.com" })),
		).toBe("FORBIDDEN");
		expect(await code(groups.addNewMember(as("guest"), { groupId: guestGroup.id, name: "Hari" }))).toBe("ok");
	});
});

describe("invites and joining", () => {
	it("makes a single-use link the public lookup describes, and joining merges the person", async () => {
		const { maya, group } = await trip();
		// Maya adds Gita (no account) to the trip and splits with her.
		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		await groups.addMember(as("maya"), group, gita);
		await expenses.createExpense(
			as("maya"),
			expense({ groupId: group, split: { method: "equal", people: [maya, gita] } }),
		);

		const invite = await invites.inviteFriend(as("maya"), { personId: gita, groupId: group, send: true });
		expect(invite.sent).toBe(true);
		expect(sent.map((email) => [email.to, email.data.group])).toEqual([["gita@elsewhere.example", "Pokhara trip"]]);
		const token = invite.url.split("/join/")[1] ?? "";
		expect(token).toMatch(/^[\w-]{32}$/);
		const [row] = await env.db.select().from(khInvite);
		expect(row?.tokenHash).not.toBe(token);

		const lookup = await invites.lookupInvite(env, token, "visitor-1");
		expect(lookup).toMatchObject({ inviter: { name: "Maya" }, group: { name: "Pokhara trip" }, status: "open" });
		expect(JSON.stringify(lookup)).not.toContain("gita@");
		expect(await code(invites.lookupInvite(env, "x".repeat(32), "visitor-1"))).toBe("NOT_FOUND");

		// Sita, signed in with another address, takes it.
		expect(await code(invites.acceptInvite(as("maya"), token))).toBe("FORBIDDEN");
		expect(await code(invites.acceptInvite(as("guest"), token))).toBe("FORBIDDEN");
		const joined = await invites.acceptInvite(as("sita"), token);
		expect(joined).toEqual({ groupId: group, inviterId: maya });
		const sita = await personOf("sita");
		expect(await env.db.select().from(khPerson).where(eq(khPerson.id, gita))).toEqual([]);
		const view = await groups.getGroup(as("sita"), group);
		expect(view.balances).toEqual([{ currency: "NPR", amountMinor: -150_000 }]);
		expect((await friends.getFriend(as("maya"), sita)).person.hasAccount).toBe(true);
		expect((await invites.lookupInvite(env, token, "visitor-1")).status).toBe("accepted");
		expect(await code(invites.acceptInvite(as("bikash"), token))).toBe("FORBIDDEN");
		await expectLedgerConsistent(env.db);
	});

	it("expires, and can't be sent by guests, for someone who joined, without an address, or when off", async () => {
		await personOf("maya");
		const asha = (await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" })).person.id;
		await personOf("asha");
		expect(await code(invites.inviteFriend(as("maya"), { personId: asha }))).toBe("CONFLICT");
		const named = (await friends.addFriend(as("maya"), { name: "Hari" })).person.id;
		expect(await code(invites.inviteFriend(as("maya"), { personId: named }))).toBe("BAD_REQUEST");
		const guestFriend = (await friends.addFriend(as("guest"), { name: "Ram" })).person.id;
		expect(await code(invites.inviteFriend(as("guest"), { personId: guestFriend }))).toBe("FORBIDDEN");
		expect(await code(invites.inviteFriend(as("bikash"), { personId: named }))).toBe("NOT_FOUND");

		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		const link = await invites.inviteFriend(as("maya"), { personId: gita });
		const token = link.url.split("/join/")[1] ?? "";
		const later = new Date(Date.now() + 15 * 86_400_000);
		expect((await invites.lookupInvite(env, token, "v", later)).status).toBe("expired");
		expect(await code(invites.acceptInvite(as("sita"), token, later))).toBe("FORBIDDEN");
		// A newer link to the same friend stops the older one.
		const again = await invites.inviteFriend(as("maya"), { personId: gita });
		expect((await invites.lookupInvite(env, token, "v")).status).toBe("expired");
		expect((await invites.lookupInvite(env, again.url.split("/join/")[1] ?? "", "v")).status).toBe("open");

		await env.db
			.insert(khSettings)
			.values({ id: 1, settings: { invites: false } })
			.onConflictDoUpdate({
				target: khSettings.id,
				set: { settings: { invites: false } },
			});
		expect(await code(invites.inviteFriend(as("maya"), { personId: gita }))).toBe("FORBIDDEN");
	});

	it("emails an address at most once a day, and lets nobody send more than 20 a day", async () => {
		await personOf("maya");
		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		expect((await invites.inviteFriend(as("maya"), { personId: gita, send: true })).sent).toBe(true);
		expect((await invites.inviteFriend(as("maya"), { personId: gita, send: true })).sent).toBe(false);
		expect(sent).toHaveLength(1);
		for (let i = 2; i < invites.INVITE_LIMIT.max; i++) await invites.inviteFriend(as("maya"), { personId: gita });
		expect(await code(invites.inviteFriend(as("maya"), { personId: gita }))).toBe("RATE_LIMITED");
	});

	it("joins on a verified sign-in: the person waiting under the address merges into the account's", async () => {
		const maya = await personOf("maya");
		const late = await personOf("late"); // no address: unverified
		const waiting = (await friends.addFriend(as("maya"), { name: "L", email: "late@example.com" })).person.id;
		expect(waiting).not.toBe(late);
		await expenses.createExpense(as("maya"), expense({ split: { method: "equal", people: [maya, waiting] } }));
		await invites.inviteFriend(as("maya"), { personId: waiting });

		expect(await invites.joinOnSignIn(env.db, "late")).toBe(0);
		await env.db.update(user).set({ emailVerified: true }).where(eq(user.id, "late"));
		expect(await invites.joinOnSignIn(env.db, "late")).toBe(1);
		expect(await env.db.select().from(khPerson).where(eq(khPerson.id, waiting))).toEqual([]);
		const [invite] = await env.db.select().from(khInvite);
		expect(invite?.acceptedBy).toBe("late");
		expect((await friends.getFriend(as("maya"), late)).balances).toEqual([{ currency: "NPR", amountMinor: 150_000 }]);
		expect(
			(await threads.getFriendThread(as("late"), maya)).items.some(
				(item) => item.type === "system" && item.line.kind === "friend.joined",
			),
		).toBe(true);
		expect(await invites.joinOnSignIn(env.db, "late")).toBe(0);
		await expectLedgerConsistent(env.db);
	});
});

describe("adding an address to a contact", () => {
	it("merges into whoever has it, keeping the caller's name for them; else sets it", async () => {
		const maya = await personOf("maya");
		const asha = await personOf("asha");
		const contact = (await friends.addFriend(as("maya"), { name: "Ashu" })).person.id;
		await expenses.createExpense(as("maya"), expense({ split: { method: "equal", people: [maya, contact] } }));
		const merged = await friends.setFriendEmail(as("maya"), { personId: contact, email: "ASHA@example.com" });
		expect(merged.person).toMatchObject({ id: asha, name: "Ashu", hasAccount: true });
		expect(merged.balances).toEqual([{ currency: "NPR", amountMinor: 150_000 }]);
		await expectLedgerConsistent(env.db);

		const hari = (await friends.addFriend(as("maya"), { name: "Hari" })).person.id;
		const set = await friends.setFriendEmail(as("maya"), { personId: hari, email: "hari@example.com", invite: true });
		expect(set).toMatchObject({ email: "hari@example.com", canInvite: true, canAddEmail: false });
		expect(set.invite).not.toBeNull();
		expect(sent.map((email) => email.to)).toEqual(["hari@example.com"]);

		expect(await code(friends.setFriendEmail(as("maya"), { personId: asha, email: "x@example.com" }))).toBe(
			"FORBIDDEN",
		);
		expect(await code(friends.setFriendEmail(as("maya"), { personId: hari, email: "maya@example.com" }))).toBe(
			"FORBIDDEN",
		);
		const guests = (await friends.addFriend(as("guest"), { name: "Ram" })).person.id;
		expect(await code(friends.setFriendEmail(as("guest"), { personId: guests, email: "ram@example.com" }))).toBe(
			"FORBIDDEN",
		);
	});
});

describe("people and threads", () => {
	it("lists friends and groups by search, hidden friends on asking", async () => {
		const { asha } = await trip();
		await friends.updateFriend(as("maya"), { personId: asha, hidden: true });
		const all = await threads.listPeople(as("maya"), { q: "" });
		expect(all.friends.map((friend) => friend.person.name)).toEqual(["bikash"]);
		expect(all.hiddenCount).toBe(1);
		expect(all.groups.map((group) => group.name)).toEqual(["Pokhara trip"]);
		expect((await threads.listPeople(as("maya"), { q: "", hidden: true })).friends).toHaveLength(2);
		const found = await threads.listPeople(as("maya"), { q: "POKH" });
		expect([found.friends.length, found.groups.length]).toEqual([0, 1]);
	});

	it("holds a group's cards and system lines in order, a former member's up to leaving", async () => {
		const { maya, asha, group } = await trip();
		const first = await expenses.createExpense(
			as("maya"),
			expense({ groupId: group, spentOn: "2026-10-03", split: { method: "equal", people: [maya, asha] } }),
		);
		await payments.createPayment(as("asha"), {
			groupId: group,
			fromId: asha,
			toId: maya,
			amountMinor: 150_000,
			currency: "NPR",
			paid: null,
			method: "",
			note: "",
			paidOn: "2026-10-04",
		});
		await groups.leaveGroup(as("bikash"), group);
		await expenses.updateExpense(as("maya"), {
			expenseId: first.id,
			version: first.version,
			kind: "expense",
			title: "Dinner at the lake",
			merchant: "",
			notes: "",
			amountMinor: 300_000,
			currency: "NPR",
			spentOn: "2026-10-03",
			payers: [{ person: maya, amount: 300_000 }],
			split: { method: "equal", people: [maya, asha] },
		});
		const thread = await threads.getGroupThread(as("maya"), group);
		const types = thread.items.map((item) => (item.type === "system" ? item.line.kind : item.type));
		expect(types).toEqual(
			expect.arrayContaining(["group.created", "expense", "payment", "member.left", "expense.updated"]),
		);
		expect(types).not.toContain("expense.created");
		expect(thread.items.map((item) => item.day)).toEqual([...thread.items.map((item) => item.day)].sort());
		const former = await threads.getGroupThread(as("bikash"), group);
		expect(former.items.some((item) => item.type === "system" && item.line.kind === "expense.updated")).toBe(false);
		expect(await code(threads.getGroupThread(as("sita"), group))).toBe("NOT_FOUND");
	});

	it("holds a friend's thread outside groups, and the balance with them in each group", async () => {
		const { maya, asha, group } = await trip();
		await expenses.createExpense(
			as("maya"),
			expense({ groupId: group, split: { method: "equal", people: [maya, asha] } }),
		);
		await expenses.createExpense(
			as("asha"),
			expense({ title: "Coffee", amountMinor: 80_000, split: { method: "equal", people: [maya, asha] } }),
		);
		const thread = await threads.getFriendThread(as("maya"), asha);
		expect(
			thread.items
				.filter((item) => item.type === "expense")
				.map((item) => item.type === "expense" && item.expense.title),
		).toEqual(["Coffee"]);
		expect(thread.groups).toEqual([
			expect.objectContaining({ name: "Pokhara trip", balances: [{ currency: "NPR", amountMinor: 150_000 }] }),
		]);
		expect(thread.friend.balances).toEqual([{ currency: "NPR", amountMinor: 110_000 }]);
		expect(await code(threads.getFriendThread(as("sita"), asha))).toBe("NOT_FOUND");
	});
});
