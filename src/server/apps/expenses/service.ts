import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import type { AppColor } from "@/features/apps/colors";
import type { BudgetInput, CategoryInput, ExpenseInput, ImportInput } from "@/features/apps/expenses/schema";
import {
	type CategoryIcon,
	type CategoryWithUsage,
	EXPENSES_QUOTAS,
	type ExpenseCategory,
	type ExpenseCurrency,
	type ExpenseExportRow,
	type ExpenseItem,
	type ExpensesMonth,
	type ImportResult,
} from "@/features/apps/expenses/types";
import { AppError, ruleError } from "@/lib/errors";
import { addDays, addMonths, type IsoMonth, monthDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { AppServices } from "@/server/apps/ownership";
import { notFound, uniqueViolation } from "@/server/db/crud";
import { lockQuota } from "@/server/db/quota";
import type { Tx } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import * as repo from "./repository";

/**
 * Expenses' rules (decision 0192): every call acts on the caller's own rows (the
 * repository scopes by owner), an expense or budget only names the caller's own
 * category, quotas per user, and a CSV import runs once per idempotency key. Not
 * audited: app data isn't an admin action (0186).
 */

/** Months in the dashboard's trend chart, the shown one included. */
export const TREND_MONTHS = 6;

const categoryTaken = (error: unknown) =>
	uniqueViolation(error, { expense_category_name_unique: { field: "name", message: m.expenses_error_category_taken } });

const expensesQuota = () =>
	ruleError(
		"CONFLICT",
		"Expenses quota reached",
		m.expenses_quota({ max: formatNumber(EXPENSES_QUOTAS.transactions) }),
	);
const categoriesQuota = () =>
	ruleError(
		"CONFLICT",
		"Categories quota reached",
		m.expenses_categories_quota({ max: formatNumber(EXPENSES_QUOTAS.categories) }),
	);

/** A category id from the browser: null, or one of the caller's own (else NOT_FOUND). */
async function checkCategory(tx: Tx, ownerId: string, id: string | null) {
	if (id && !(await repo.ownsCategory(tx, ownerId, id))) throw notFound("Category");
}

/** The dashboard's month: its expenses, totals by category and month, and budgets, in one currency. */
export async function getMonth(
	{ db, user }: AppServices,
	input: { month?: IsoMonth | undefined; currency: ExpenseCurrency },
	now = new Date(),
): Promise<ExpensesMonth> {
	const today = todayInZone(APP_TIME_ZONE, now);
	const month = input.month ?? today.slice(0, 7);
	const { first, last } = monthDays(month);
	const trendFirst = monthDays(addMonths(month, -(TREND_MONTHS - 1))).first;
	const [categories, expenses, byCategory, byMonth, budgets] = await Promise.all([
		repo.listCategories(db, user.id),
		repo.expensesBetween(db, user.id, first, last),
		repo.spentByCategory(db, user.id, first, last, input.currency),
		repo.spentByMonth(db, user.id, trendFirst, last, input.currency),
		repo.budgetsFor(db, user.id, first, input.currency),
	]);
	const perMonth = new Map(byMonth.map((row) => [row.month, row.amountMinor]));
	const spent = new Map(byCategory.map((row) => [row.categoryId, row.amountMinor]));
	return {
		month,
		currency: input.currency,
		today,
		categories,
		expenses,
		totalMinor: byCategory.reduce((sum, row) => sum + row.amountMinor, 0),
		byCategory,
		trend: Array.from({ length: TREND_MONTHS }, (_, index) => {
			const each = addMonths(month, index - (TREND_MONTHS - 1));
			return { month: each, amountMinor: perMonth.get(each) ?? 0 };
		}),
		budgets: budgets.map((budget) => ({ ...budget, spentMinor: spent.get(budget.categoryId) ?? 0 })),
	};
}

export async function createExpense({ db, user }: AppServices, { id, ...expense }: ExpenseInput): Promise<ExpenseItem> {
	return db.transaction(async (tx) => {
		await lockQuota(tx, `expenses:${user.id}`);
		if ((await repo.countExpenses(tx, user.id)) >= EXPENSES_QUOTAS.transactions) throw expensesQuota();
		await checkCategory(tx, user.id, expense.categoryId);
		const [row] = await repo.insertExpenses(tx, user.id, [{ id, ...expense }]);
		if (!row) throw new Error("Expense insert returned no row");
		return row;
	});
}

export async function updateExpense({ db, user }: AppServices, { id, ...expense }: ExpenseInput): Promise<ExpenseItem> {
	return db.transaction(async (tx) => {
		await checkCategory(tx, user.id, expense.categoryId);
		const row = await repo.updateExpense(tx, user.id, id, expense);
		if (!row) throw notFound("Expense");
		return row;
	});
}

export async function deleteExpense({ db, user }: AppServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.deleteExpense(tx, user.id, id))) throw notFound("Expense");
	});
}

export async function listCategories({ db, user }: AppServices): Promise<CategoryWithUsage[]> {
	return repo.categoriesWithUsage(db, user.id);
}

export async function createCategory({ db, user }: AppServices, input: CategoryInput): Promise<ExpenseCategory> {
	try {
		return await db.transaction(async (tx) => {
			await lockQuota(tx, `expenses:${user.id}`);
			if ((await repo.countCategories(tx, user.id)) >= EXPENSES_QUOTAS.categories) throw categoriesQuota();
			const [row] = await repo.insertCategories(tx, user.id, [input]);
			if (!row) throw new Error("Category insert returned no row");
			return row;
		});
	} catch (error) {
		throw categoryTaken(error);
	}
}

export async function updateCategory(
	{ db, user }: AppServices,
	{ id, ...set }: CategoryInput,
): Promise<ExpenseCategory> {
	try {
		return await db.transaction(async (tx) => {
			const row = await repo.updateCategory(tx, user.id, id, set);
			if (!row) throw notFound("Category");
			return row;
		});
	} catch (error) {
		throw categoryTaken(error);
	}
}

export async function deleteCategory({ db, user }: AppServices, id: string): Promise<void> {
	await db.transaction(async (tx) => {
		if (!(await repo.deleteCategory(tx, user.id, id))) throw notFound("Category");
	});
}

/** Sets (or, with a null amount, removes) a category's budget for a month and currency. */
export async function setBudget({ db, user }: AppServices, input: BudgetInput): Promise<void> {
	const budget = { categoryId: input.categoryId, month: monthDays(input.month).first, currency: input.currency };
	await db.transaction(async (tx) => {
		await checkCategory(tx, user.id, input.categoryId);
		if (input.amountMinor === null) await repo.deleteBudget(tx, user.id, budget);
		else await repo.setBudget(tx, user.id, { ...budget, amountMinor: input.amountMinor });
	});
}

export const exportExpenses = ({ db, user }: AppServices): Promise<ExpenseExportRow[]> => repo.exportRows(db, user.id);

/** The colours and icons an import gives the categories it makes, in turn. */
const NEW_CATEGORY_LOOKS: ReadonlyArray<{ color: AppColor; icon: CategoryIcon }> = [
	{ color: "blue", icon: "tag" },
	{ color: "green", icon: "tag" },
	{ color: "orange", icon: "tag" },
	{ color: "violet", icon: "tag" },
	{ color: "teal", icon: "tag" },
	{ color: "pink", icon: "tag" },
];

/**
 * A CSV import (decision 0192): up to 1,000 rows, once per idempotency key. The key is
 * claimed in the same transaction as the rows, so a repeat (a double click, a retry
 * after a lost answer) waits for the first and gets its result; the same key with
 * other rows, or someone else's key, is a CONFLICT. A finished import's repeat is answered
 * before the hourly import limit counts it. Categories are matched by name
 * (any case) and made when missing.
 */
export async function importExpenses({ db, user }: AppServices, input: ImportInput): Promise<ImportResult> {
	const fingerprint = createHash("sha256").update(JSON.stringify(input.rows)).digest("hex");
	// A retry of an import that went through gets its result back before the rate limit counts it.
	const done = await repo.getImport(db, input.key);
	if (done?.result && done.ownerId === user.id && done.fingerprint === fingerprint)
		return { ...done.result, replayed: true };
	await enforceRateLimit(db, `expenses-import:${user.id}`, {
		max: EXPENSES_QUOTAS.importsPerHour,
		windowSeconds: 3600,
	});
	return db.transaction(async (tx) => {
		await lockQuota(tx, `expenses:${user.id}`);
		if (!(await repo.claimImportKey(tx, user.id, input.key, fingerprint))) {
			const earlier = await repo.getImport(tx, input.key);
			if (earlier?.ownerId !== user.id || earlier.fingerprint !== fingerprint || !earlier.result) {
				throw new AppError("CONFLICT", "Idempotency key reused for a different import");
			}
			return { ...earlier.result, replayed: true };
		}
		if ((await repo.countExpenses(tx, user.id)) + input.rows.length > EXPENSES_QUOTAS.transactions) {
			throw expensesQuota();
		}
		const categories = new Map(
			(await repo.listCategories(tx, user.id)).map((category) => [category.name.toLowerCase(), category.id]),
		);
		// Each missing name once, spelled as it first appears.
		const missing = new Map<string, string>();
		for (const { category: name } of input.rows) {
			const lower = name.toLowerCase();
			if (name !== "" && !categories.has(lower) && !missing.has(lower)) missing.set(lower, name);
		}
		if (missing.size > 0) {
			if ((await repo.countCategories(tx, user.id)) + missing.size > EXPENSES_QUOTAS.categories) {
				throw categoriesQuota();
			}
			const made = await repo.insertCategories(
				tx,
				user.id,
				[...missing.values()].map((name, index) => ({
					name,
					...(NEW_CATEGORY_LOOKS[index % NEW_CATEGORY_LOOKS.length] ?? { color: "slate", icon: "tag" }),
				})),
			);
			for (const category of made) categories.set(category.name.toLowerCase(), category.id);
		}
		const inserted = await repo.insertExpenses(
			tx,
			user.id,
			input.rows.map((row) => ({
				categoryId: row.category ? (categories.get(row.category.toLowerCase()) ?? null) : null,
				amountMinor: row.amountMinor,
				currency: row.currency,
				occurredOn: row.occurredOn,
				note: row.note,
				importKey: input.key,
			})),
		);
		const result = { inserted: inserted.length, categoriesCreated: missing.size };
		await repo.setImportResult(tx, input.key, result);
		return { ...result, replayed: false };
	});
}

// ---------------------------------------------------------------------------
// Guests and /admin/apps
// ---------------------------------------------------------------------------

/**
 * A new guest's sample expenses (decision 0186), in the language they started in: five
 * categories, half a year of spending (more of it this month), and three budgets for
 * this month, so every chart has something to show.
 */
export async function seedExpenses(tx: Tx, userId: string, locale: Locale, now = new Date()): Promise<void> {
	const t = { locale };
	const [food, transport, home, fun, health] = await repo.insertCategories(tx, userId, [
		{ name: m.expenses_seed_food({}, t), color: "orange", icon: "utensils" },
		{ name: m.expenses_seed_transport({}, t), color: "blue", icon: "bus" },
		{ name: m.expenses_seed_home({}, t), color: "teal", icon: "house" },
		{ name: m.expenses_seed_fun({}, t), color: "violet", icon: "film" },
		{ name: m.expenses_seed_health({}, t), color: "red", icon: "heart-pulse" },
	]);
	if (!food || !transport || !home || !fun || !health) return;
	const today = todayInZone(APP_TIME_ZONE, now);
	const month = today.slice(0, 7);
	const rows: repo.NewExpense[] = [];
	const add = (day: string, categoryId: string, rupees: number, note: string, currency: ExpenseCurrency = "NPR") =>
		rows.push({ occurredOn: day, categoryId, amountMinor: rupees * 100, currency, note });
	for (let back = 0; back < TREND_MONTHS; back++) {
		const { first } = monthDays(addMonths(month, -back));
		// This month only up to today; earlier months on their first days.
		const day = (offset: number) => {
			const candidate = addDays(first, offset);
			return back === 0 && candidate > today ? today : candidate;
		};
		add(day(0), home.id, 18_000, m.expenses_seed_rent({}, t));
		add(day(2), food.id, 3_200 + back * 150, m.expenses_seed_groceries({}, t));
		add(day(4), transport.id, 900 + back * 40, m.expenses_seed_bus({}, t));
		add(day(9), food.id, 1_450, m.expenses_seed_momo({}, t));
		if (back % 2 === 0) add(day(12), fun.id, 1_200, m.expenses_seed_cinema({}, t));
		if (back === 1 || back === 4) add(day(15), health.id, 2_500, m.expenses_seed_pharmacy({}, t));
	}
	add(today, fun.id, 12, m.expenses_seed_subscription({}, t), "USD");
	await repo.insertExpenses(tx, userId, rows);
	for (const [category, rupees] of [
		[food, 6_000],
		[transport, 1_500],
		[fun, 1_000],
	] as const) {
		await repo.setBudget(tx, userId, {
			categoryId: category.id,
			month: monthDays(month).first,
			currency: "NPR",
			amountMinor: rupees * 100,
		});
	}
}

export const claimExpenses = (tx: Tx, fromUserId: string, toUserId: string) =>
	repo.transferExpenses(tx, fromUserId, toUserId);

export const expensesUsage = repo.expensesUsage;
