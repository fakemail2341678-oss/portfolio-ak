import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { expenseDebts, paymentDebt } from "@/features/kharcha/money/ledger";
import { isAppError } from "@/lib/errors";
import type { ImageStore } from "@/server/attachments/cloudinary";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { KharchaServices } from "@/server/kharcha/access";
import * as receipts from "@/server/kharcha/receipts/service";

/** Shared by Kharcha's server tests (docs/guides/kharcha.md "Testing"). */

/** A caller of Kharcha's services; receipts need an `imageStore` (tests/utils/fake-cloudinary.ts). */
export const caller = (
	db: Db,
	id: string,
	{ guest = false, permissions = [] as string[], imageStore = null as ImageStore | null } = {},
): KharchaServices => ({
	db,
	user: { id, isGuest: guest, permissions },
	imageStore,
});

/** A receipt the caller uploaded (signed, put on the fake Cloudinary, confirmed): its attachment id. */
export async function uploadReceipt(
	services: KharchaServices,
	fake: { put: (publicId: string, asset?: { format?: string }) => void },
	format = "jpg",
): Promise<string> {
	const ticket = await receipts.signReceiptUpload(services);
	fake.put(ticket.publicId, { format });
	return (await receipts.confirmReceiptUpload(services, ticket.publicId)).id;
}

/** Accounts with verified addresses (`<id>@example.com`), and guests. */
export const insertUsers = (db: Db, ids: ReadonlyArray<string>, guests: ReadonlyArray<string> = []) =>
	db.insert(schema.user).values([
		...ids.map((id) => ({
			id,
			name: id[0]?.toUpperCase() + id.slice(1),
			email: `${id}@example.com`,
			emailVerified: true,
		})),
		...guests.map((id) => ({ id, name: "Guest", email: `${id}@anonymous.invalid`, isAnonymous: true })),
	]);

/** The error code a call ends with, or "ok". */
export const code = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		if (isAppError(error)) return error.code;
		throw error;
	}
};

/** The localized reason a refusal carries. */
export const reason = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	} catch (error) {
		// Intl puts a no-break space between a code and its amount.
		if (isAppError(error)) return (error.fieldErrors?._form?.[0] ?? error.code).replace(/\s/g, " ");
		throw error;
	}
	return "ok";
};

const key = (row: { debtor: string; creditor: string; amount: number }) =>
	`${row.debtor}>${row.creditor}:${row.amount}`;

/**
 * The ledger's invariants (PLAN 14.5), checked against every row in the database:
 * - each expense's payers and shares add up to its amount;
 * - each expense's and payment's ledger rows are exactly the debts the money core gives,
 *   in its group and currency, and none while it is in the trash;
 * - the nets of every currency, overall and in every group, sum to zero.
 */
export async function expectLedgerConsistent(db: Db): Promise<void> {
	const ledger = await db.select().from(schema.khLedger);
	for (const expense of await db.select().from(schema.khExpense)) {
		const payers = await db
			.select({ person: schema.khExpensePayer.personId, amount: schema.khExpensePayer.amountMinor })
			.from(schema.khExpensePayer)
			.where(eq(schema.khExpensePayer.expenseId, expense.id))
			.orderBy(schema.khExpensePayer.position);
		const shares = await db
			.select({ person: schema.khExpenseShare.personId, owed: schema.khExpenseShare.owedMinor })
			.from(schema.khExpenseShare)
			.where(eq(schema.khExpenseShare.expenseId, expense.id))
			.orderBy(schema.khExpenseShare.position);
		const what = `expense ${expense.title || expense.id}`;
		expect(
			payers.reduce((sum, payer) => sum + payer.amount, 0),
			what,
		).toBe(expense.amountMinor);
		expect(
			shares.reduce((sum, share) => sum + share.owed, 0),
			what,
		).toBe(expense.amountMinor);
		const rows = ledger.filter((row) => row.expenseId === expense.id);
		const expected = expense.deletedAt ? [] : expenseDebts(expense.kind, payers, shares);
		expect(
			rows.map((row) => key({ debtor: row.debtorId, creditor: row.creditorId, amount: row.amountMinor })).sort(),
			what,
		).toEqual(expected.map(key).sort());
		for (const row of rows) {
			expect(row.groupId, what).toBe(expense.groupId);
			expect(row.currency, what).toBe(expense.currency);
		}
	}
	for (const payment of await db.select().from(schema.khPayment)) {
		const rows = ledger.filter((row) => row.paymentId === payment.id);
		const expected = payment.deletedAt ? [] : [paymentDebt(payment.fromPerson, payment.toPerson, payment.amountMinor)];
		expect(
			rows.map((row) => key({ debtor: row.debtorId, creditor: row.creditorId, amount: row.amountMinor })),
			`payment ${payment.id}`,
		).toEqual(expected.map(key));
		for (const row of rows) {
			expect(row.groupId).toBe(payment.groupId);
			expect(row.currency).toBe(payment.currency);
		}
	}
	const scopes = new Map<string, number>();
	for (const row of ledger) {
		for (const scope of [`all|${row.currency}`, `${row.groupId}|${row.currency}`]) {
			scopes.set(`${scope}|${row.creditorId}`, (scopes.get(`${scope}|${row.creditorId}`) ?? 0) + row.amountMinor);
			scopes.set(`${scope}|${row.debtorId}`, (scopes.get(`${scope}|${row.debtorId}`) ?? 0) - row.amountMinor);
		}
	}
	const sums = new Map<string, number>();
	for (const [scopeKey, value] of scopes) {
		const scope = scopeKey.split("|").slice(0, 2).join("|");
		sums.set(scope, (sums.get(scope) ?? 0) + value);
	}
	for (const [scope, sum] of sums) expect(sum, `nets of ${scope}`).toBe(0);
}
