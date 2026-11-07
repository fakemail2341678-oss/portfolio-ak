import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExpenseInput } from "@/features/apps/expenses/schema";
import { EXPENSES_QUOTAS } from "@/features/apps/expenses/types";
import { isAppError } from "@/lib/errors";
import * as expenses from "@/server/apps/expenses/service";
import type { AppServices } from "@/server/apps/ownership";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Expenses (decision 0192) on PGlite: every call sees and changes only its caller's
 * rows (categories included), the month's totals, trend and budgets, the CSV import
 * once per idempotency key, quotas, and a guest's sample data, claim and usage.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values([
			{ id: "alice", name: "Alice", email: "alice@example.com" },
			{ id: "bob", name: "Bob", email: "bob@example.com" },
			{ id: "guest-1", name: "Guest", email: "g1@anonymous.placeholder.invalid", isAnonymous: true },
		]),
	);
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string, isGuest = false): AppServices => ({ db: env.db, user: { id, isGuest } });
const alice = () => as("alice");
const bob = () => as("bob");
const guest = () => as("guest-1", true);

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return isAppError(error) ? error.code : "thrown";
	}
};

/** 30 October 2026, 10:00 in Kathmandu. */
const NOW = new Date("2026-10-30T04:15:00Z");

const category = (services: AppServices, name = "Food") =>
	expenses.createCategory(services, { id: crypto.randomUUID(), name, color: "orange", icon: "utensils" });

const expense = (services: AppServices, patch: Partial<ExpenseInput> = {}) =>
	expenses.createExpense(services, {
		id: crypto.randomUUID(),
		categoryId: null,
		amountMinor: 45_000,
		currency: "NPR",
		occurredOn: "2026-10-01",
		note: "Momo",
		...patch,
	});

describe("Expenses ownership", () => {
	it("never shows one user's rows to another", async () => {
		const food = await category(alice());
		await expense(alice(), { categoryId: food.id });
		const month = await expenses.getMonth(bob(), { month: "2026-10", currency: "NPR" }, NOW);
		expect(month.expenses).toEqual([]);
		expect(month.categories).toEqual([]);
		expect(await expenses.listCategories(bob())).toEqual([]);
		expect(await expenses.exportExpenses(bob())).toEqual([]);
	});

	it("refuses every change to someone else's rows as not found", async () => {
		const food = await category(alice());
		const mine = await expense(alice(), { categoryId: food.id });
		const update = { ...mine, note: "Bob's" };
		expect(await code(expenses.updateExpense(bob(), update))).toBe("NOT_FOUND");
		expect(await code(expenses.deleteExpense(bob(), mine.id))).toBe("NOT_FOUND");
		expect(await code(expenses.updateCategory(bob(), { ...food, name: "Mine" }))).toBe("NOT_FOUND");
		expect(await code(expenses.deleteCategory(bob(), food.id))).toBe("NOT_FOUND");
		const [row] = await env.db.select().from(schema.expenseTransaction);
		expect(row?.note).toBe("Momo");
	});

	it("never lets an expense or a budget name someone else's category", async () => {
		const food = await category(alice());
		expect(await code(expense(bob(), { categoryId: food.id }))).toBe("NOT_FOUND");
		expect(
			await code(
				expenses.setBudget(bob(), { categoryId: food.id, month: "2026-10", currency: "NPR", amountMinor: 100 }),
			),
		).toBe("NOT_FOUND");
		const bobs = await expense(bob());
		expect(await code(expenses.updateExpense(bob(), { ...bobs, categoryId: food.id }))).toBe("NOT_FOUND");
	});
});

describe("Expenses month", () => {
	it("totals one currency by category and month, and budgets against what was spent", async () => {
		const food = await category(alice(), "Food");
		const bus = await category(alice(), "Bus");
		await expense(alice(), { categoryId: food.id, amountMinor: 45_000, occurredOn: "2026-10-01" });
		await expense(alice(), { categoryId: food.id, amountMinor: 5_000, occurredOn: "2026-10-31" });
		await expense(alice(), { categoryId: bus.id, amountMinor: 9_000, occurredOn: "2026-10-15" });
		await expense(alice(), { categoryId: null, amountMinor: 1_000, occurredOn: "2026-10-20" });
		await expense(alice(), { categoryId: food.id, amountMinor: 1_200, currency: "USD", occurredOn: "2026-10-02" });
		await expense(alice(), { categoryId: food.id, amountMinor: 30_000, occurredOn: "2026-09-30" });
		await expense(alice(), { categoryId: food.id, amountMinor: 7_000, occurredOn: "2026-05-31" });
		await expense(alice(), { categoryId: food.id, amountMinor: 8_000, occurredOn: "2026-04-30" });
		await expenses.setBudget(alice(), { categoryId: food.id, month: "2026-10", currency: "NPR", amountMinor: 40_000 });
		await expenses.setBudget(alice(), { categoryId: bus.id, month: "2026-10", currency: "USD", amountMinor: 500 });

		const month = await expenses.getMonth(alice(), { month: "2026-10", currency: "NPR" }, NOW);
		expect(month.expenses).toHaveLength(5);
		expect(month.expenses[0]?.occurredOn).toBe("2026-10-31");
		expect(month.totalMinor).toBe(60_000);
		expect(month.byCategory).toEqual([
			{ categoryId: food.id, amountMinor: 50_000 },
			{ categoryId: bus.id, amountMinor: 9_000 },
			{ categoryId: null, amountMinor: 1_000 },
		]);
		expect(month.trend).toEqual([
			{ month: "2026-05", amountMinor: 7_000 },
			{ month: "2026-06", amountMinor: 0 },
			{ month: "2026-07", amountMinor: 0 },
			{ month: "2026-08", amountMinor: 0 },
			{ month: "2026-09", amountMinor: 30_000 },
			{ month: "2026-10", amountMinor: 60_000 },
		]);
		expect(month.budgets).toEqual([{ categoryId: food.id, amountMinor: 40_000, spentMinor: 50_000 }]);

		const dollars = await expenses.getMonth(alice(), { month: "2026-10", currency: "USD" }, NOW);
		expect(dollars.totalMinor).toBe(1_200);
		expect(dollars.budgets).toEqual([{ categoryId: bus.id, amountMinor: 500, spentMinor: 0 }]);
	});

	it("defaults to the current month in Kathmandu, and changes or removes a budget", async () => {
		// 18:30 UTC on 31 October is 00:15 on 1 November in Kathmandu.
		const month = await expenses.getMonth(alice(), { currency: "NPR" }, new Date("2026-10-31T18:30:00Z"));
		expect(month).toMatchObject({ month: "2026-11", today: "2026-11-01" });
		const food = await category(alice());
		const budget = { categoryId: food.id, month: "2026-11", currency: "NPR" as const };
		await expenses.setBudget(alice(), { ...budget, amountMinor: 100 });
		await expenses.setBudget(alice(), { ...budget, amountMinor: 250 });
		expect(await env.db.select().from(schema.expenseBudget)).toMatchObject([{ amountMinor: 250, month: "2026-11-01" }]);
		await expenses.setBudget(alice(), { ...budget, amountMinor: null });
		expect(await env.db.select().from(schema.expenseBudget)).toEqual([]);
	});

	it("keeps a deleted category's expenses, uncategorized, and drops its budgets", async () => {
		const food = await category(alice());
		const kept = await expense(alice(), { categoryId: food.id });
		await expenses.setBudget(alice(), { categoryId: food.id, month: "2026-10", currency: "NPR", amountMinor: 100 });
		expect((await expenses.listCategories(alice()))[0]?.expenses).toBe(1);
		await expenses.deleteCategory(alice(), food.id);
		const [row] = await env.db
			.select()
			.from(schema.expenseTransaction)
			.where(eq(schema.expenseTransaction.id, kept.id));
		expect(row?.categoryId).toBeNull();
		expect(await env.db.select().from(schema.expenseBudget)).toEqual([]);
	});

	it("refuses a second category of the same name, whatever the case", async () => {
		await category(alice(), "Food");
		const error = await category(alice(), "food").catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("CONFLICT");
		expect(isAppError(error) && error.fieldErrors?.name).toHaveLength(1);
		expect(await code(category(bob(), "Food"))).toBe("ok");
	});
});

describe("Expenses CSV", () => {
	const rows = [
		{ occurredOn: "2026-10-01", amountMinor: 45_000, currency: "NPR" as const, category: "Food", note: "Momo" },
		{ occurredOn: "2026-10-02", amountMinor: 1_250, currency: "USD" as const, category: "travel", note: "" },
		{ occurredOn: "2026-10-03", amountMinor: 900, currency: "NPR" as const, category: "Travel", note: "Bus" },
		{ occurredOn: "2026-10-04", amountMinor: 100, currency: "NPR" as const, category: "", note: "Tip" },
	];

	it("imports once per key: matches categories by name, makes the missing ones once", async () => {
		await category(alice(), "food");
		const key = crypto.randomUUID();
		const first = await expenses.importExpenses(alice(), { key, rows });
		expect(first).toEqual({ inserted: 4, categoriesCreated: 1, replayed: false });
		const again = await expenses.importExpenses(alice(), { key, rows });
		expect(again).toEqual({ inserted: 4, categoriesCreated: 1, replayed: true });
		expect(await env.db.select().from(schema.expenseTransaction)).toHaveLength(4);
		const categories = await expenses.listCategories(alice());
		expect(categories.map((each) => [each.name, each.expenses])).toEqual([
			["food", 1],
			["travel", 2],
		]);
	});

	it("answers a finished import's retry even after the hourly import limit", async () => {
		const key = crypto.randomUUID();
		await expenses.importExpenses(alice(), { key, rows });
		for (let index = 1; index < EXPENSES_QUOTAS.importsPerHour; index++) {
			await expenses.importExpenses(alice(), { key: crypto.randomUUID(), rows: rows.slice(0, 1) });
		}
		expect(await code(expenses.importExpenses(alice(), { key: crypto.randomUUID(), rows }))).toBe("RATE_LIMITED");
		expect(await expenses.importExpenses(alice(), { key, rows })).toMatchObject({ inserted: 4, replayed: true });
	});

	it("refuses a key reused for other rows, or by someone else", async () => {
		const key = crypto.randomUUID();
		await expenses.importExpenses(alice(), { key, rows });
		expect(await code(expenses.importExpenses(alice(), { key, rows: rows.slice(1) }))).toBe("CONFLICT");
		expect(await code(expenses.importExpenses(bob(), { key, rows }))).toBe("CONFLICT");
		expect(await env.db.select().from(schema.expenseTransaction)).toHaveLength(4);
	});

	it("rolls back a refused import, so the same key can run again", async () => {
		const key = crypto.randomUUID();
		const many = Array.from({ length: EXPENSES_QUOTAS.categories + 1 }, (_, index) => ({
			occurredOn: "2026-10-01",
			amountMinor: 100,
			currency: "NPR" as const,
			note: "",
			category: `Category ${index}`,
		}));
		expect(await code(expenses.importExpenses(alice(), { key, rows: many }))).toBe("CONFLICT");
		expect(await env.db.select().from(schema.expenseImport)).toEqual([]);
		expect((await expenses.importExpenses(alice(), { key, rows })).inserted).toBe(4);
	});

	it("exports every expense, oldest first, with its category's name", async () => {
		await expenses.importExpenses(alice(), { key: crypto.randomUUID(), rows });
		const exported = await expenses.exportExpenses(alice());
		expect(exported.map((row) => [row.occurredOn, row.amountMinor, row.currency, row.category, row.note])).toEqual([
			["2026-10-01", 45_000, "NPR", "Food", "Momo"],
			["2026-10-02", 1_250, "USD", "travel", ""],
			["2026-10-03", 900, "NPR", "travel", "Bus"],
			["2026-10-04", 100, "NPR", "", "Tip"],
		]);
	});
});

describe("Expenses quotas", () => {
	it("stops at the categories quota", async () => {
		await env.db.insert(schema.expenseCategory).values(
			Array.from({ length: EXPENSES_QUOTAS.categories }, (_, index) => ({
				ownerId: "alice",
				name: `Category ${index}`,
				color: "blue",
				icon: "tag",
			})),
		);
		expect(await code(category(alice(), "One more"))).toBe("CONFLICT");
	});
});

describe("Expenses guests", () => {
	it("seeds a guest's sample data in their language, with every chart filled", async () => {
		await env.db.transaction((tx) => expenses.seedExpenses(tx, "guest-1", "ne", NOW));
		const month = await expenses.getMonth(guest(), { currency: "NPR" }, NOW);
		expect(month.categories.map((each) => each.name)).toContain("खाना");
		expect(month.byCategory.length).toBeGreaterThanOrEqual(3);
		expect(month.trend.every((each) => each.amountMinor > 0)).toBe(true);
		expect(month.budgets).toHaveLength(3);
		expect(month.expenses.every((each) => each.occurredOn <= month.today)).toBe(true);
		expect((await expenses.getMonth(guest(), { currency: "USD" }, NOW)).totalMinor).toBe(1_200);
	});

	it("claims a guest's rows into an account, merging categories of the same name", async () => {
		await env.db.transaction((tx) => expenses.seedExpenses(tx, "guest-1", "en", NOW));
		const food = await category(alice(), "food");
		await expenses.setBudget(alice(), { categoryId: food.id, month: "2026-10", currency: "NPR", amountMinor: 999 });
		const before = (await expenses.exportExpenses(guest())).length;
		await env.db.transaction((tx) => expenses.claimExpenses(tx, "guest-1", "alice"));
		expect(await expenses.exportExpenses(guest())).toEqual([]);
		const categories = await expenses.listCategories(alice());
		expect(categories.filter((each) => each.name.toLowerCase() === "food")).toHaveLength(1);
		expect(categories.find((each) => each.id === food.id)?.expenses).toBeGreaterThan(0);
		expect((await expenses.exportExpenses(alice())).length).toBe(before);
		const month = await expenses.getMonth(alice(), { month: "2026-10", currency: "NPR" }, NOW);
		// The account's own Food budget wins over the guest's.
		expect(month.budgets.find((each) => each.categoryId === food.id)?.amountMinor).toBe(999);
		expect(month.budgets).toHaveLength(3);
	});

	it("counts accounts, guests and rows for /admin/apps", async () => {
		await env.db.transaction((tx) => expenses.seedExpenses(tx, "guest-1", "en", NOW));
		await expense(alice());
		const usage = await expenses.expensesUsage(env.db);
		expect(usage).toMatchObject({ accounts: 1, guests: 1 });
		expect(usage.rows.categories).toBe(5);
		expect(usage.rows.budgets).toBe(3);
		expect(usage.rows.expenses).toBeGreaterThan(20);
	});
});
