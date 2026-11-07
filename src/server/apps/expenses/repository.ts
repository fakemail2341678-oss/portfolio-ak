import "@tanstack/react-start/server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type AppColor, isAppColor } from "@/features/apps/colors";
import {
	type CategoryIcon,
	type ExpenseCategory,
	type ExpenseCurrency,
	type ExpenseExportRow,
	type ExpenseItem,
	isCategoryIcon,
	isExpenseCurrency,
} from "@/features/apps/expenses/types";
import type { IsoDate } from "@/lib/i18n/date-only";
import { ownedBy } from "@/server/apps/ownership";
import {
	type ExpenseCategoryRow,
	type ExpenseTransactionRow,
	expenseBudget,
	expenseCategory,
	expenseImport,
	expenseTransaction,
	user,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Expenses' data access (decision 0192). Every function takes the owner and scopes by
 * it (`ownedBy`), so one user's call never reads or changes another's rows.
 */

const toColor = (value: string): AppColor => (isAppColor(value) ? value : "slate");
const toIcon = (value: string): CategoryIcon => (isCategoryIcon(value) ? value : "tag");
const toCurrency = (value: string): ExpenseCurrency => (isExpenseCurrency(value) ? value : "NPR");

export const toCategory = (row: ExpenseCategoryRow): ExpenseCategory => ({
	id: row.id,
	name: row.name,
	color: toColor(row.color),
	icon: toIcon(row.icon),
});

export const toExpense = (row: ExpenseTransactionRow): ExpenseItem => ({
	id: row.id,
	categoryId: row.categoryId,
	amountMinor: row.amountMinor,
	currency: toCurrency(row.currency),
	occurredOn: row.occurredOn,
	note: row.note,
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(db: Db | Tx, ownerId: string): Promise<ExpenseCategory[]> {
	const rows = await db
		.select()
		.from(expenseCategory)
		.where(ownedBy(expenseCategory, ownerId))
		.orderBy(sql`lower(${expenseCategory.name})`, asc(expenseCategory.id));
	return rows.map(toCategory);
}

/** The owner's categories, each with how many expenses it holds. */
export async function categoriesWithUsage(db: Db, ownerId: string) {
	const usage = db
		.select({ categoryId: expenseTransaction.categoryId, total: count().as("expenses") })
		.from(expenseTransaction)
		.where(ownedBy(expenseTransaction, ownerId))
		.groupBy(expenseTransaction.categoryId)
		.as("usage");
	const rows = await db
		.select({ category: expenseCategory, expenses: sql<number>`coalesce(${usage.total}, 0)`.mapWith(Number) })
		.from(expenseCategory)
		.leftJoin(usage, eq(usage.categoryId, expenseCategory.id))
		.where(ownedBy(expenseCategory, ownerId))
		.orderBy(sql`lower(${expenseCategory.name})`, asc(expenseCategory.id));
	return rows.map((row) => ({ ...toCategory(row.category), expenses: row.expenses }));
}

export const countCategories = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(expenseCategory).where(ownedBy(expenseCategory, ownerId)))[0]?.total ?? 0;

/** Whether `id` is one of the owner's categories (an expense or budget may only name one of those). */
export const ownsCategory = async (db: Db | Tx, ownerId: string, id: string) =>
	(
		await db
			.select({ id: expenseCategory.id })
			.from(expenseCategory)
			.where(and(eq(expenseCategory.id, id), ownedBy(expenseCategory, ownerId)))
	).length > 0;

export type NewCategory = { id?: string; name: string; color: AppColor; icon: CategoryIcon };

export async function insertCategories(tx: Tx, ownerId: string, categories: ReadonlyArray<NewCategory>) {
	if (categories.length === 0) return [];
	const rows = await tx
		.insert(expenseCategory)
		.values(categories.map((each) => ({ ...each, ownerId })))
		.returning();
	return rows.map(toCategory);
}

export async function updateCategory(
	tx: Tx,
	ownerId: string,
	id: string,
	set: Pick<NewCategory, "name" | "color" | "icon">,
): Promise<ExpenseCategory | null> {
	const [row] = await tx
		.update(expenseCategory)
		.set(set)
		.where(and(eq(expenseCategory.id, id), ownedBy(expenseCategory, ownerId)))
		.returning();
	return row ? toCategory(row) : null;
}

/** Deletes a category: its expenses become uncategorized, its budgets go with it. */
export async function deleteCategory(tx: Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await tx
		.delete(expenseCategory)
		.where(and(eq(expenseCategory.id, id), ownedBy(expenseCategory, ownerId)))
		.returning({ id: expenseCategory.id });
	return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

/** The owner's expenses between two days (inclusive), every currency, newest first. */
export async function expensesBetween(db: Db, ownerId: string, first: IsoDate, last: IsoDate): Promise<ExpenseItem[]> {
	const rows = await db
		.select()
		.from(expenseTransaction)
		.where(
			and(
				ownedBy(expenseTransaction, ownerId),
				gte(expenseTransaction.occurredOn, first),
				lte(expenseTransaction.occurredOn, last),
			),
		)
		.orderBy(desc(expenseTransaction.occurredOn), desc(expenseTransaction.createdAt), desc(expenseTransaction.id));
	return rows.map(toExpense);
}

const spentIn = (ownerId: string, first: IsoDate, last: IsoDate, currency: ExpenseCurrency) =>
	and(
		ownedBy(expenseTransaction, ownerId),
		eq(expenseTransaction.currency, currency),
		gte(expenseTransaction.occurredOn, first),
		lte(expenseTransaction.occurredOn, last),
	);

const total = sql<number>`sum(${expenseTransaction.amountMinor})`.mapWith(Number);

/** Spent per category in one currency between two days, largest first. */
export async function spentByCategory(
	db: Db,
	ownerId: string,
	first: IsoDate,
	last: IsoDate,
	currency: ExpenseCurrency,
) {
	return db
		.select({ categoryId: expenseTransaction.categoryId, amountMinor: total })
		.from(expenseTransaction)
		.where(spentIn(ownerId, first, last, currency))
		.groupBy(expenseTransaction.categoryId)
		.orderBy(desc(total), expenseTransaction.categoryId);
}

/** Spent per calendar month ("YYYY-MM") in one currency between two days. */
export async function spentByMonth(db: Db, ownerId: string, first: IsoDate, last: IsoDate, currency: ExpenseCurrency) {
	const month = sql<string>`to_char(${expenseTransaction.occurredOn}, 'YYYY-MM')`;
	return db
		.select({ month, amountMinor: total })
		.from(expenseTransaction)
		.where(spentIn(ownerId, first, last, currency))
		.groupBy(month);
}

export const countExpenses = async (tx: Tx, ownerId: string) =>
	(await tx.select({ total: count() }).from(expenseTransaction).where(ownedBy(expenseTransaction, ownerId)))[0]
		?.total ?? 0;

export type NewExpense = Omit<ExpenseItem, "id"> & { id?: string; importKey?: string };

/** Inserts in batches (a 1,000-row import stays far under Postgres' parameter limit). */
export async function insertExpenses(tx: Tx, ownerId: string, expenses: ReadonlyArray<NewExpense>) {
	const inserted: ExpenseItem[] = [];
	for (let start = 0; start < expenses.length; start += 500) {
		const rows = await tx
			.insert(expenseTransaction)
			.values(expenses.slice(start, start + 500).map((each) => ({ ...each, ownerId })))
			.returning();
		inserted.push(...rows.map(toExpense));
	}
	return inserted;
}

export async function updateExpense(
	tx: Tx,
	ownerId: string,
	id: string,
	set: Omit<ExpenseItem, "id">,
): Promise<ExpenseItem | null> {
	const [row] = await tx
		.update(expenseTransaction)
		.set(set)
		.where(and(eq(expenseTransaction.id, id), ownedBy(expenseTransaction, ownerId)))
		.returning();
	return row ? toExpense(row) : null;
}

export async function deleteExpense(tx: Tx, ownerId: string, id: string): Promise<boolean> {
	const rows = await tx
		.delete(expenseTransaction)
		.where(and(eq(expenseTransaction.id, id), ownedBy(expenseTransaction, ownerId)))
		.returning({ id: expenseTransaction.id });
	return rows.length > 0;
}

/** Every expense of the owner for the CSV export, oldest first, with its category's name. */
export async function exportRows(db: Db, ownerId: string): Promise<ExpenseExportRow[]> {
	const rows = await db
		.select({ expense: expenseTransaction, category: expenseCategory.name })
		.from(expenseTransaction)
		.leftJoin(expenseCategory, eq(expenseCategory.id, expenseTransaction.categoryId))
		.where(ownedBy(expenseTransaction, ownerId))
		.orderBy(asc(expenseTransaction.occurredOn), asc(expenseTransaction.createdAt), asc(expenseTransaction.id));
	return rows.map(({ expense, category }) => ({
		occurredOn: expense.occurredOn,
		amountMinor: expense.amountMinor,
		currency: toCurrency(expense.currency),
		category: category ?? "",
		note: expense.note,
	}));
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export async function budgetsFor(db: Db, ownerId: string, month: IsoDate, currency: ExpenseCurrency) {
	return db
		.select({ categoryId: expenseBudget.categoryId, amountMinor: expenseBudget.amountMinor })
		.from(expenseBudget)
		.where(and(ownedBy(expenseBudget, ownerId), eq(expenseBudget.month, month), eq(expenseBudget.currency, currency)));
}

export async function setBudget(
	tx: Tx,
	ownerId: string,
	budget: { categoryId: string; month: IsoDate; currency: ExpenseCurrency; amountMinor: number },
) {
	await tx
		.insert(expenseBudget)
		.values({ ...budget, ownerId })
		.onConflictDoUpdate({
			target: [expenseBudget.categoryId, expenseBudget.month, expenseBudget.currency],
			set: { amountMinor: budget.amountMinor, updatedAt: new Date() },
		});
}

export async function deleteBudget(
	tx: Tx,
	ownerId: string,
	budget: { categoryId: string; month: IsoDate; currency: ExpenseCurrency },
) {
	await tx
		.delete(expenseBudget)
		.where(
			and(
				ownedBy(expenseBudget, ownerId),
				eq(expenseBudget.categoryId, budget.categoryId),
				eq(expenseBudget.month, budget.month),
				eq(expenseBudget.currency, budget.currency),
			),
		);
}

// ---------------------------------------------------------------------------
// Imports (idempotency keys)
// ---------------------------------------------------------------------------

/** Takes `key` for this import; false when it is already taken (by an earlier attempt, or someone else). */
export async function claimImportKey(tx: Tx, ownerId: string, key: string, fingerprint: string): Promise<boolean> {
	const rows = await tx
		.insert(expenseImport)
		.values({ key, ownerId, fingerprint })
		.onConflictDoNothing()
		.returning({ key: expenseImport.key });
	return rows.length > 0;
}

export async function getImport(tx: Db | Tx, key: string) {
	const [row] = await tx.select().from(expenseImport).where(eq(expenseImport.key, key));
	return row ?? null;
}

export async function setImportResult(tx: Tx, key: string, result: { inserted: number; categoriesCreated: number }) {
	await tx.update(expenseImport).set({ result }).where(eq(expenseImport.key, key));
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/**
 * Moves every row of a guest to an account (decision 0186). Category names are unique
 * per owner, so a guest's "Food" joins the account's "Food": its expenses move over,
 * its budgets too unless the account already has one for that month and currency.
 */
export async function transferExpenses(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	const guest = alias(expenseCategory, "guest");
	const pairs = await tx
		.select({ from: guest.id, to: expenseCategory.id })
		.from(expenseCategory)
		.innerJoin(guest, and(eq(guest.ownerId, fromUserId), sql`lower(${guest.name}) = lower(${expenseCategory.name})`))
		.where(ownedBy(expenseCategory, toUserId));
	const mine = alias(expenseBudget, "mine");
	for (const pair of pairs) {
		await tx
			.update(expenseTransaction)
			.set({ categoryId: pair.to })
			.where(eq(expenseTransaction.categoryId, pair.from));
		await tx
			.update(expenseBudget)
			.set({ categoryId: pair.to })
			.where(
				and(
					eq(expenseBudget.categoryId, pair.from),
					notExists(
						tx
							.select({ id: mine.id })
							.from(mine)
							.where(
								and(
									eq(mine.categoryId, pair.to),
									eq(mine.month, expenseBudget.month),
									eq(mine.currency, expenseBudget.currency),
								),
							),
					),
				),
			);
	}
	// The guest's duplicates go (with the budgets the account already had).
	if (pairs.length > 0) {
		await tx.delete(expenseCategory).where(
			inArray(
				expenseCategory.id,
				pairs.map((pair) => pair.from),
			),
		);
	}
	for (const table of [expenseCategory, expenseTransaction, expenseBudget, expenseImport]) {
		await tx.update(table).set({ ownerId: toUserId }).where(ownedBy(table, fromUserId));
	}
}

/** Usage for /admin/apps: how many accounts and guests have an expense, and the rows. */
export async function expensesUsage(db: Db) {
	const [owners] = await db
		.select({
			accounts:
				sql<number>`count(distinct ${expenseTransaction.ownerId}) filter (where not coalesce(${user.isAnonymous}, false))`.mapWith(
					Number,
				),
			guests: sql<number>`count(distinct ${expenseTransaction.ownerId}) filter (where ${user.isAnonymous})`.mapWith(
				Number,
			),
			expenses: count(),
		})
		.from(expenseTransaction)
		.innerJoin(user, eq(user.id, expenseTransaction.ownerId));
	const [categories] = await db.select({ total: count() }).from(expenseCategory);
	const [budgets] = await db.select({ total: count() }).from(expenseBudget);
	return {
		accounts: owners?.accounts ?? 0,
		guests: owners?.guests ?? 0,
		rows: { expenses: owners?.expenses ?? 0, categories: categories?.total ?? 0, budgets: budgets?.total ?? 0 },
	};
}
