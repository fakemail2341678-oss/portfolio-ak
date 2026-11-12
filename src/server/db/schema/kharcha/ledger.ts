import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { khExpense } from "./expense";
import { khGroup } from "./group";
import { khPayment } from "./payment";
import { khPerson } from "./person";

/**
 * Kharcha's ledger (docs/guides/kharcha.md, decision 0278): who owes whom because of one
 * expense or one payment. Every balance is a sum over these rows, per currency: between
 * two people, in a group, in all. The rows of a source are written in its transaction and
 * rewritten when it changes; they go to the trash with it and come back with it
 * (src/server/kharcha/ledger.ts is the only writer).
 */
export const khLedger = pgTable(
	"kh_ledger",
	{
		id: uuid().primaryKey().defaultRandom(),
		expenseId: uuid().references(() => khExpense.id, { onDelete: "cascade" }),
		paymentId: uuid().references(() => khPayment.id, { onDelete: "cascade" }),
		/** The source's group, copied here so a group's balances are one indexed sum. */
		groupId: uuid().references(() => khGroup.id, { onDelete: "cascade" }),
		debtorId: uuid()
			.notNull()
			.references(() => khPerson.id),
		creditorId: uuid()
			.notNull()
			.references(() => khPerson.id),
		amountMinor: bigint({ mode: "number" }).notNull(),
		currency: text().notNull(),
	},
	(table) => [
		index("kh_ledger_debtor_idx").on(table.debtorId, table.creditorId),
		index("kh_ledger_creditor_idx").on(table.creditorId, table.debtorId),
		index("kh_ledger_group_idx").on(table.groupId),
		index("kh_ledger_expense_idx").on(table.expenseId),
		index("kh_ledger_payment_idx").on(table.paymentId),
		check("kh_ledger_one_source", sql`(${table.expenseId} is null) <> (${table.paymentId} is null)`),
		check("kh_ledger_two_people", sql`${table.debtorId} <> ${table.creditorId}`),
		check("kh_ledger_amount_positive", sql`${table.amountMinor} > 0`),
	],
);

export type KhLedgerRow = typeof khLedger.$inferSelect;
