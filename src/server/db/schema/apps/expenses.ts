import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	date,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth";

/**
 * Expenses (/apps/expenses, decision 0192). Every row has `owner_id` (the user, a guest
 * included), deleted with them; the repository scopes every query by it (`ownedBy`).
 * Amounts are integers in the currency's minor unit (paisa, cents): never floats.
 */
const owner = () =>
	text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });

const timestamps = {
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

export const expenseCategory = pgTable(
	"expense_category",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		name: text().notNull(),
		/** A palette name (src/features/apps/colors.ts). */
		color: text().notNull(),
		/** An icon name (src/features/apps/expenses/icons.ts). */
		icon: text().notNull(),
		...timestamps,
	},
	// One "Food" per user, whatever the case: an import matches categories by name.
	(table) => [uniqueIndex("expense_category_name_unique").on(table.ownerId, sql`lower(${table.name})`)],
);

export const expenseTransaction = pgTable(
	"expense_transaction",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		/** Null is "Uncategorized" (also what a deleted category leaves behind). */
		categoryId: uuid().references(() => expenseCategory.id, { onDelete: "set null" }),
		amountMinor: bigint({ mode: "number" }).notNull(),
		currency: text().notNull(),
		/** The calendar day it was spent. */
		occurredOn: date({ mode: "string" }).notNull(),
		note: text().notNull().default(""),
		/** The CSV import that made it, if one did (its idempotency key). */
		importKey: uuid(),
		...timestamps,
	},
	(table) => [
		index("expense_transaction_owner_idx").on(table.ownerId, table.occurredOn),
		check("expense_transaction_amount_positive", sql`${table.amountMinor} > 0`),
	],
);

/** How much a user means to spend in a category in one month, in one currency. */
export const expenseBudget = pgTable(
	"expense_budget",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: owner(),
		categoryId: uuid()
			.notNull()
			.references(() => expenseCategory.id, { onDelete: "cascade" }),
		/** The month's first day. */
		month: date({ mode: "string" }).notNull(),
		currency: text().notNull(),
		amountMinor: bigint({ mode: "number" }).notNull(),
		...timestamps,
	},
	(table) => [
		unique("expense_budget_month_unique").on(table.categoryId, table.month, table.currency),
		index("expense_budget_owner_idx").on(table.ownerId, table.month),
		check("expense_budget_amount_positive", sql`${table.amountMinor} > 0`),
	],
);

/**
 * One CSV import, by the idempotency key the import page made for it: a repeat of the
 * same request (a double click, a retry after a lost answer) returns `result` instead
 * of inserting the rows twice (docs/guides/routing-data.md, "Idempotency keys").
 */
export const expenseImport = pgTable("expense_import", {
	key: uuid().primaryKey(),
	ownerId: owner(),
	/** A hash of the rows: the same key with other rows is refused. */
	fingerprint: text().notNull(),
	result: jsonb().$type<{ inserted: number; categoriesCreated: number }>(),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type ExpenseCategoryRow = typeof expenseCategory.$inferSelect;
export type ExpenseTransactionRow = typeof expenseTransaction.$inferSelect;
export type ExpenseBudgetRow = typeof expenseBudget.$inferSelect;
