import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { guestOwnersFor } from "@/server/guests/data";
import { claimGuest, deleteExpiredGuests, seedGuest } from "@/server/guests/service";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import { KHARCHA_GUEST_DATA } from "@/server/kharcha/guest-data";
import * as me from "@/server/kharcha/me/service";
import { KHARCHA_DEMO, seedKharcha } from "../../scripts/lib/kharcha-seed.ts";
import { createTestDb } from "../utils/test-db";
import { caller, expectLedgerConsistent, insertUsers } from "./kharcha-helpers";

/**
 * Kharcha's sample data (decision 0277): a guest's, in their language, claimed on sign-up
 * through `mergePerson` and removed with an expired guest; and the demo accounts of
 * `pnpm db:seed-kharcha`, read back through the services.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya"], ["guest"]));
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => caller(env.db, id, { guest: id === "guest" });
const kharchaRows = async () => {
	const counts: Record<string, number> = {};
	for (const table of ["kh_person", "kh_group", "kh_expense", "kh_payment", "kh_ledger", "kh_activity", "kh_friend"]) {
		const result = await env.client.query<{ count: number }>(`select count(*)::int as "count" from "${table}"`);
		counts[table] = Number(result.rows[0]?.count ?? 0);
	}
	return counts;
};

describe("a guest's sample data", () => {
	it("is seeded only for guests started in Kharcha, in their language", async () => {
		expect(guestOwnersFor("kharcha")).toEqual([KHARCHA_GUEST_DATA]);
		expect(guestOwnersFor(null)).not.toContain(KHARCHA_GUEST_DATA);
		await seedGuest(env.db, "guest", "ne", guestOwnersFor("kharcha"));
		expect((await friends.listFriends(as("guest"))).map((friend) => friend.person.name).sort()).toEqual(
			["आशा", "विकास", "सीता"].sort(),
		);
		const mine = await groups.listGroups(as("guest"));
		expect(mine.map((group) => group.name).sort()).toEqual(["पोखरा यात्रा", "फ्ल्याट ३बी"].sort());
		const trip = await groups.getGroup(as("guest"), mine.find((group) => group.kind === "trip")?.id ?? "");
		expect(trip.members).toHaveLength(3);
		expect(trip.nets[0]?.suggested.length).toBeGreaterThan(0);
		const balances = await me.getBalances(as("guest"));
		expect(balances.owed.length + balances.owe.length).toBeGreaterThan(0);
		// Twelve a month for three months, and 13 shared: a coffee, the trip's 4, the flat's 8.
		expect((await kharchaRows()).kh_expense).toBe(36 + 13);
		await expectLedgerConsistent(env.db);
		// Seeding again lands on nothing: the guest has friends already.
		await env.db.transaction((tx) => KHARCHA_GUEST_DATA.seedGuestData(tx, "guest", "ne"));
		expect((await kharchaRows()).kh_expense).toBe(49);
	});

	it("moves to the account the guest signs up as, next to what the account had", async () => {
		await seedGuest(env.db, "guest", "en", [KHARCHA_GUEST_DATA]);
		await expenses.createExpense(as("maya"), {
			groupId: null,
			kind: "expense",
			title: "Own",
			merchant: "",
			notes: "",
			amountMinor: 1_000,
			currency: "NPR",
			spentOn: "2026-11-12",
		});
		const guestBalances = await me.getBalances(as("guest"));
		expect(await claimGuest(env.db, "guest", "maya", [KHARCHA_GUEST_DATA])).toBe(true);
		expect(await env.db.select().from(schema.user).where(eq(schema.user.id, "guest"))).toEqual([]);
		expect((await friends.listFriends(as("maya"))).map((friend) => friend.person.name).sort()).toEqual([
			"Asha",
			"Bikash",
			"Sita",
		]);
		expect(await groups.listGroups(as("maya"))).toHaveLength(2);
		expect(await me.getBalances(as("maya"))).toEqual(guestBalances);
		expect((await kharchaRows()).kh_expense).toBe(50);
		await expectLedgerConsistent(env.db);
	});

	it("goes with the guest when it expires", async () => {
		await seedGuest(env.db, "guest", "en", [KHARCHA_GUEST_DATA]);
		await me.getMe(as("maya"));
		const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
		expect((await deleteExpiredGuests(env.db, null, later, [KHARCHA_GUEST_DATA])).guests).toBe(1);
		expect(await kharchaRows()).toEqual({
			kh_person: 1,
			kh_group: 0,
			kh_expense: 0,
			kh_payment: 0,
			kh_ledger: 0,
			kh_activity: 0,
			kh_friend: 0,
		});
	});
});

describe("pnpm db:seed-kharcha", () => {
	it("writes three demo accounts who share a group, once", async () => {
		const query = async (text: string, params?: unknown[]) => {
			const result = await env.client.query<Record<string, unknown>>(text, params);
			return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
		};
		const passwordHash = await hashPassword("demo-password-123");
		expect(await seedKharcha(query, { passwordHash })).toEqual({ accounts: 3, expenses: 8 });
		expect(await seedKharcha(query, { passwordHash })).toEqual({ accounts: 0, expenses: 0 });
		await expectLedgerConsistent(env.db);

		const asha = async () => {
			const { rows } = await query(`select "id" from "user" where "email" = $1`, [KHARCHA_DEMO[0].email]);
			return caller(env.db, String(rows[0]?.id));
		};
		const [trip] = await groups.listGroups(await asha());
		// Three accounts, and Maya: a member without an account, invited (Task 90).
		expect(trip).toMatchObject({ name: "Pokhara trip", members: 4 });
		const view = await groups.getGroup(await asha(), trip?.id ?? "");
		expect(view.nets[0]?.people.reduce((sum, net) => sum + net.netMinor, 0)).toBe(0);
		const ashasFriends = await friends.listFriends(await asha());
		expect(ashasFriends).toHaveLength(3);
		expect(ashasFriends.find((friend) => !friend.person.hasAccount)?.invite).not.toBeNull();
	});
});
