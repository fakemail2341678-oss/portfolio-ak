/**
 * Kharcha's demo accounts (`pnpm db:seed-kharcha`, `pnpm dev:local` on a fresh database,
 * and the e2e harness): three people who share a group, a few expenses and one payment,
 * so splitting and balances have something to show from more than one side. Plain SQL
 * through an injected query (as ./demo-data.ts), so it runs on node-postgres and is tested
 * on PGlite (tests/server/kharcha-seed.test.ts). Safe to run again: accounts and people are
 * kept, and the data is only written while the first account is in no group.
 *
 * The shares and the ledger rows come from Kharcha's own money core, the same code the
 * services run. Run by Node directly (type stripping): it imports only relative `.ts`
 * files that import nothing at run time.
 */
import { createHash, randomUUID } from "node:crypto";
import { expenseDebts, paymentDebt } from "../../src/features/kharcha/money/ledger.ts";
import { computeShares, type Split } from "../../src/features/kharcha/money/split.ts";
import type { DemoQuery } from "./demo-data.ts";

export const KHARCHA_DEMO = [
	{ email: "asha@kharcha.example.com", name: "Asha Gurung", color: "teal" },
	{ email: "bikash@kharcha.example.com", name: "Bikash Thapa", color: "indigo" },
	{ email: "sita@kharcha.example.com", name: "Sita Rai", color: "amber" },
] as const;

const CURRENCY = "NPR";

/**
 * Asha's open invite to Maya, a friend in the trip without an account (Task 90): its link is
 * /app/kharcha/join/<this>, for the e2e review of the join page and for trying it locally.
 * A demo token: only its SHA-256 is stored, as for any invite.
 */
export const KHARCHA_DEMO_INVITE_TOKEN = "kharcha-demo-invite-token-000001";

type DemoExpense = {
	title: string;
	merchant?: string;
	/** Minor units of NPR (paisa). */
	amount: number;
	daysAgo: number;
	/** Index into KHARCHA_DEMO. */
	paidBy: number;
	/** In the shared group, or outside any. */
	group: boolean;
	split: (people: string[]) => Split;
};

const everyone = (people: string[]): Split => ({ method: "equal", people });

const EXPENSES: DemoExpense[] = [
	{ title: "Tourist bus tickets", amount: 360_000, daysAgo: 12, paidBy: 0, group: true, split: everyone },
	{ title: "Lakeside hotel, 2 nights", amount: 900_000, daysAgo: 11, paidBy: 1, group: true, split: everyone },
	{ title: "Dinner by the lake", amount: 410_190, daysAgo: 11, paidBy: 2, group: true, split: everyone },
	{
		title: "Boating on Phewa",
		amount: 150_000,
		daysAgo: 10,
		paidBy: 0,
		group: true,
		split: (people) => ({
			method: "shares",
			parts: people.map((person, index) => ({ person, weight: index === 1 ? 2 : 1 })),
		}),
	},
	{
		title: "Coffee",
		merchant: "Himalayan Java",
		amount: 56_000,
		daysAgo: 3,
		paidBy: 0,
		group: false,
		split: (people) => ({ method: "equal", people: people.slice(0, 2) }),
	},
	...KHARCHA_DEMO.map(
		(_, index): DemoExpense => ({
			title: "Groceries",
			merchant: "Bhat-Bhateni",
			amount: 245_000 + index * 12_500,
			daysAgo: 2 + index,
			paidBy: index,
			group: false,
			split: (people) => ({ method: "full", person: people[index] ?? "" }),
		}),
	),
];

const firstId = (rows: Array<Record<string, unknown>>, what: string): string => {
	const id = rows[0]?.id;
	if (typeof id !== "string") throw new Error(`kharcha seed: no ${what}`);
	return id;
};

export async function seedKharcha(
	query: DemoQuery,
	{ passwordHash }: { passwordHash: string },
): Promise<{ accounts: number; expenses: number }> {
	let accounts = 0;
	const people: string[] = [];
	for (const person of KHARCHA_DEMO) {
		const existing = await query(`select "id" from "user" where "email" = $1`, [person.email]);
		let userId = existing.rows[0]?.id as string | undefined;
		if (!userId) {
			userId = randomUUID();
			await query(
				`insert into "user" ("id", "name", "email", "email_verified", "role") values ($1, $2, $3, true, 'user')`,
				[userId, person.name, person.email],
			);
			await query(
				`insert into "account" ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
				 values ($1, $2, 'credential', $2, $3, now(), now())`,
				[randomUUID(), userId, passwordHash],
			);
			accounts += 1;
		}
		// Their person: their own already, one waiting under their address, or a new one.
		let found = await query(`select "id" from "kh_person" where "user_id" = $1`, [userId]);
		if (found.rows.length === 0) {
			found = await query(
				`update "kh_person" set "user_id" = $1 where "email" = $2 and "user_id" is null returning "id"`,
				[userId, person.email],
			);
		}
		if (found.rows.length === 0) {
			found = await query(
				`insert into "kh_person" ("user_id", "email", "display_name", "color") values ($1, $2, $3, $4) returning "id"`,
				[userId, person.email, person.name, person.color],
			);
		}
		const personId = firstId(found.rows, "person");
		await query(
			`insert into "kh_profile" ("user_id", "person_id", "onboarded_at") values ($1, $2, now()) on conflict do nothing`,
			[userId, personId],
		);
		people.push(personId);
	}

	const [asha, bikash] = people;
	if (!asha || !bikash) throw new Error("kharcha seed: no people");
	const member = await query(`select 1 from "kh_group_member" where "person_id" = $1 limit 1`, [asha]);
	if (member.rows.length > 0) return { accounts, expenses: 0 };

	for (const owner of people) {
		for (const friend of people) {
			if (owner === friend) continue;
			await query(`insert into "kh_friend" ("owner_id", "friend_id") values ($1, $2) on conflict do nothing`, [
				owner,
				friend,
			]);
		}
	}

	const group = await query(
		`insert into "kh_group" ("name", "kind", "color", "icon", "currency", "start_on", "end_on", "created_by")
		 values ('Pokhara trip', 'trip', 'teal', 'plane', $1, current_date - 12, current_date - 9, $2) returning "id"`,
		[CURRENCY, asha],
	);
	const groupId = firstId(group.rows, "group");
	for (const [index, personId] of people.entries()) {
		await query(`insert into "kh_group_member" ("group_id", "person_id", "role") values ($1, $2, $3)`, [
			groupId,
			personId,
			index === 0 ? "owner" : "member",
		]);
	}
	await query(
		`insert into "kh_activity" ("group_id", "actor_id", "kind", "data") values ($1, $2, 'group.created', $3)`,
		[groupId, asha, JSON.stringify({ title: "Pokhara trip" })],
	);

	const ledger = async (
		source: "expense_id" | "payment_id",
		id: string,
		inGroup: boolean,
		debts: ReturnType<typeof expenseDebts>,
	) => {
		for (const debt of debts) {
			await query(
				`insert into "kh_ledger" ("${source}", "group_id", "debtor_id", "creditor_id", "amount_minor", "currency")
				 values ($1, $2, $3, $4, $5, $6)`,
				[id, inGroup ? groupId : null, debt.debtor, debt.creditor, debt.amount, CURRENCY],
			);
		}
	};

	for (const expense of EXPENSES) {
		const split = expense.split(people);
		const shares = computeShares(expense.amount, split);
		if (!shares.ok) throw new Error(`kharcha seed: ${expense.title}: ${shares.problem.code}`);
		const payer = people[expense.paidBy] ?? asha;
		const row = await query(
			`insert into "kh_expense" ("group_id", "created_by", "title", "merchant", "amount_minor", "currency", "spent_on", "split")
			 values ($1, $2, $3, $4, $5, $6, current_date - $7::int, $8::jsonb) returning "id"`,
			[
				expense.group ? groupId : null,
				payer,
				expense.title,
				expense.merchant ?? "",
				expense.amount,
				CURRENCY,
				expense.daysAgo,
				JSON.stringify(split),
			],
		);
		const expenseId = firstId(row.rows, "expense");
		await query(
			`insert into "kh_expense_payer" ("expense_id", "person_id", "amount_minor", "position") values ($1, $2, $3, 0)`,
			[expenseId, payer, expense.amount],
		);
		for (const [position, share] of shares.shares.entries()) {
			await query(
				`insert into "kh_expense_share" ("expense_id", "person_id", "owed_minor", "position") values ($1, $2, $3, $4)`,
				[expenseId, share.person, share.owed, position],
			);
		}
		await ledger(
			"expense_id",
			expenseId,
			expense.group,
			expenseDebts("expense", [{ person: payer, amount: expense.amount }], shares.shares),
		);
		// Outside a group, the thread of the two people on it (lower id first, as the table's check asks).
		const named = [...new Set([payer, ...shares.shares.map((share) => share.person)])].sort();
		const pair = !expense.group && named.length === 2 ? named : [null, null];
		await query(
			`insert into "kh_activity" ("group_id", "person_lo", "person_hi", "expense_id", "actor_id", "kind", "data")
			 values ($1, $2, $3, $4, $5, 'expense.created', $6)`,
			[expense.group ? groupId : null, pair[0], pair[1], expenseId, payer, JSON.stringify({ title: expense.title })],
		);
	}

	// Bikash paid Asha part of what he owed for the trip.
	const payment = await query(
		`insert into "kh_payment" ("group_id", "from_person", "to_person", "amount_minor", "currency", "method", "paid_on", "created_by")
		 values ($1, $2, $3, 100000, $4, 'eSewa', current_date - 8, $2) returning "id"`,
		[groupId, bikash, asha, CURRENCY],
	);
	const paymentId = firstId(payment.rows, "payment");
	await ledger("payment_id", paymentId, true, [paymentDebt(bikash, asha, 100_000)]);
	await query(
		`insert into "kh_activity" ("group_id", "payment_id", "actor_id", "kind") values ($1, $2, $3, 'payment.created')`,
		[groupId, paymentId, bikash],
	);

	// Maya: a member of the trip with an address and no account, invited by Asha.
	const maya = await query(
		`insert into "kh_person" ("email", "display_name", "color", "created_by") values ('maya@kharcha.example.com', 'Maya Tamang', 'pink', $1) returning "id"`,
		[asha],
	);
	const mayaId = firstId(maya.rows, "person");
	await query(`insert into "kh_friend" ("owner_id", "friend_id") values ($1, $2), ($2, $1) on conflict do nothing`, [
		asha,
		mayaId,
	]);
	await query(`insert into "kh_group_member" ("group_id", "person_id", "role") values ($1, $2, 'member')`, [
		groupId,
		mayaId,
	]);
	await query(
		`insert into "kh_invite" ("person_id", "email", "invited_by", "group_id", "token_hash", "expires_at")
		 values ($1, 'maya@kharcha.example.com', $2, $3, $4, now() + interval '14 days')`,
		[mayaId, asha, groupId, createHash("sha256").update(KHARCHA_DEMO_INVITE_TOKEN).digest("hex")],
	);

	for (const personId of people) {
		await query(`update "kh_profile" set "rev" = "rev" + 1 where "person_id" = $1`, [personId]);
	}
	return { accounts, expenses: EXPENSES.length };
}
