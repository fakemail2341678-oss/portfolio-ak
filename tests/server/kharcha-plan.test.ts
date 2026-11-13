import { and, eq, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, addMonths, monthDays, todayInZone } from "@/lib/i18n/date-only";
import { APP_TIME_ZONE } from "@/lib/i18n/intl";
import { khBudgetAlert, khExpense, khNotification, khRecurring } from "@/server/db/schema";
import * as budgets from "@/server/kharcha/budgets/service";
import { runKharchaCron } from "@/server/kharcha/cron";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as home from "@/server/kharcha/home/service";
import * as insights from "@/server/kharcha/insights/service";
import * as lists from "@/server/kharcha/lists/service";
import * as me from "@/server/kharcha/me/service";
import * as recurring from "@/server/kharcha/recurring/service";
import { createTestDb } from "../utils/test-db";
import { caller, code, expectLedgerConsistent, insertUsers } from "./kharcha-helpers";

/**
 * Task 94 (decision 0288; docs/guides/kharcha.md "Budgets", "Recurring expenses" and
 * "Insights"): budgets and their periods, the alerts the daily job sends once, recurring
 * expenses made with catch-up and each occurrence once, and the sums Insights shows.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha", "bikash"], ["guest"]));
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => caller(env.db, id, { guest: id === "guest" });
const today = todayInZone(APP_TIME_ZONE);
const thisMonth = today.slice(0, 7);
const lastMonthDay = addDays(`${thisMonth}-01`, -1);
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;
const categoryOf = async (id: string, key: string) => {
	const found = (await lists.getLists(as(id))).categories.find((category) => category.key === key);
	if (!found) throw new Error(`no ${key}`);
	return found.id;
};

const expense = (overrides: Partial<Parameters<typeof expenses.createExpense>[1]> = {}) => ({
	groupId: null,
	kind: "expense" as const,
	title: "Groceries",
	merchant: "Bhatbhateni",
	notes: "",
	amountMinor: 100_000,
	currency: "NPR" as const,
	spentOn: today,
	...overrides,
});

describe("budgets", () => {
	it("count the owner's share in the period, refunds against it, by category or everything", async () => {
		const food = await categoryOf("maya", "food");
		const travel = await categoryOf("maya", "travel");
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 600_000 }));
		await expenses.createExpense(as("maya"), expense({ categoryId: food, kind: "refund", amountMinor: 100_000 }));
		await expenses.createExpense(as("maya"), expense({ categoryId: travel, amountMinor: 250_000 }));
		await expenses.createExpense(
			as("maya"),
			expense({ categoryId: food, spentOn: lastMonthDay, amountMinor: 900_000 }),
		);
		await expenses.createExpense(as("maya"), expense({ categoryId: food, currency: "USD", amountMinor: 5_000 }));
		await budgets.createBudget(as("maya"), {
			categoryId: food,
			currency: "NPR",
			period: "month",
			amountMinor: 1_000_000,
			startsOn: `${addMonths(thisMonth, -3)}-01`,
		});
		const all = await budgets.createBudget(as("maya"), {
			categoryId: null,
			currency: "NPR",
			period: "month",
			amountMinor: 800_000,
			startsOn: `${thisMonth}-01`,
		});
		const byName = Object.fromEntries(all.map((budget) => [budget.category ? "food" : "all", budget]));
		expect(byName.food?.current).toMatchObject({
			spentMinor: 500_000,
			amountMinor: 1_000_000,
			state: "ok",
			percent: 50,
		});
		expect(byName.all?.current).toMatchObject({ spentMinor: 750_000, state: "near", percent: 93 });
		// The food budget's earlier months; the one for everything starts this month.
		expect(byName.food?.history[0]).toMatchObject({
			start: monthDays(addMonths(thisMonth, -1)).first,
			spentMinor: 900_000,
			state: "near",
		});
		expect(byName.food?.history).toHaveLength(3);
		expect(byName.all?.history).toHaveLength(0);
	});

	it("takes one month's own amount, and refuses one for a weekly budget", async () => {
		const [monthly] = await budgets.createBudget(as("maya"), {
			categoryId: null,
			currency: "NPR",
			period: "month",
			amountMinor: 1_000_000,
			startsOn: `${thisMonth}-01`,
		});
		if (!monthly) throw new Error("no budget");
		const [own] = await budgets.setBudgetMonth(as("maya"), {
			budgetId: monthly.id,
			month: thisMonth,
			amountMinor: 2_000_000,
		});
		expect(own?.current.amountMinor).toBe(2_000_000);
		expect(own?.months).toEqual([{ month: thisMonth, amountMinor: 2_000_000 }]);
		const [back] = await budgets.setBudgetMonth(as("maya"), {
			budgetId: monthly.id,
			month: thisMonth,
			amountMinor: null,
		});
		expect(back?.current.amountMinor).toBe(1_000_000);
		const weekly = (
			await budgets.createBudget(as("maya"), {
				categoryId: null,
				currency: "NPR",
				period: "week",
				amountMinor: 200_000,
				startsOn: today,
			})
		).find((budget) => budget.period === "week");
		if (!weekly) throw new Error("no weekly budget");
		expect(
			await code(budgets.setBudgetMonth(as("maya"), { budgetId: weekly.id, month: thisMonth, amountMinor: 5 })),
		).toBe("BAD_REQUEST");
	});

	it("is one per category, currency and period, and nobody else's", async () => {
		const input = {
			categoryId: null,
			currency: "NPR" as const,
			period: "month" as const,
			amountMinor: 10_000,
			startsOn: today,
		};
		const [budget] = await budgets.createBudget(as("maya"), input);
		expect(await code(budgets.createBudget(as("maya"), input))).toBe("CONFLICT");
		// The same for another currency or period is a budget of its own.
		expect(await budgets.createBudget(as("maya"), { ...input, currency: "USD" })).toHaveLength(2);
		if (!budget) throw new Error("no budget");
		expect(
			await code(
				budgets.updateBudget(as("asha"), { budgetId: budget.id, version: 1, amountMinor: 5, startsOn: today }),
			),
		).toBe("NOT_FOUND");
		expect(await code(budgets.deleteBudget(as("asha"), budget.id))).toBe("NOT_FOUND");
		expect(await budgets.listBudgets(as("asha"))).toEqual([]);
		// Another's category can't be budgeted.
		const theirs = await categoryOf("asha", "food");
		expect(await code(budgets.createBudget(as("maya"), { ...input, categoryId: theirs }))).toBe("NOT_FOUND");
		// A stale save is a conflict.
		await budgets.updateBudget(as("maya"), { budgetId: budget.id, version: 1, amountMinor: 20_000, startsOn: today });
		expect(
			await code(
				budgets.updateBudget(as("maya"), { budgetId: budget.id, version: 1, amountMinor: 5, startsOn: today }),
			),
		).toBe("CONFLICT");
	});

	it("alert at 80% and at 100% once per period, from the daily job", async () => {
		const food = await categoryOf("maya", "food");
		const [budget] = await budgets.createBudget(as("maya"), {
			categoryId: food,
			currency: "NPR",
			period: "month",
			amountMinor: 1_000_000,
			startsOn: `${thisMonth}-01`,
		});
		if (!budget) throw new Error("no budget");
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 700_000 }));
		expect((await budgets.sendBudgetAlerts(env.db)).sent).toBe(0);
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 150_000 }));
		expect((await budgets.sendBudgetAlerts(env.db)).sent).toBe(1);
		expect((await budgets.sendBudgetAlerts(env.db)).sent).toBe(0);
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 400_000 }));
		const run = await runKharchaCron(env.db);
		expect(run.budgets).toMatchObject({ ok: true, sent: 1 });
		expect((await runKharchaCron(env.db)).budgets).toMatchObject({ ok: true, sent: 0 });
		const told = await env.db
			.select({ data: khNotification.data, thread: khNotification.thread })
			.from(khNotification)
			.where(and(eq(khNotification.userId, "maya"), eq(khNotification.kind, "budget.alert")));
		expect(told.map((row) => row.data.threshold).sort()).toEqual([100, 80]);
		expect(told.every((row) => row.thread === `b:${budget.id}`)).toBe(true);
		const claimed = await env.db.select().from(khBudgetAlert).where(eq(khBudgetAlert.budgetId, budget.id));
		expect(claimed.map((row) => row.threshold).sort()).toEqual([100, 80]);
		// Home lists it as a to-do, over its limit.
		const todo = (await home.getHome(as("maya"))).todos.find((each) => each.kind === "budget");
		expect(todo?.kind === "budget" && todo.budget.current.state).toBe("over");
	});

	it("jumping past both thresholds at once tells only the 100% one, and marks both", async () => {
		await budgets.createBudget(as("maya"), {
			categoryId: null,
			currency: "NPR",
			period: "week",
			amountMinor: 100_000,
			startsOn: today,
		});
		await expenses.createExpense(as("maya"), expense({ amountMinor: 150_000 }));
		expect((await budgets.sendBudgetAlerts(env.db)).sent).toBe(1);
		const told = await env.db.select().from(khNotification).where(eq(khNotification.kind, "budget.alert"));
		expect(told.map((row) => row.data.threshold)).toEqual([100]);
		expect(await env.db.select().from(khBudgetAlert)).toHaveLength(2);
	});
});

describe("recurring expenses", () => {
	const later = (days: number) => new Date(Date.now() + days * 86_400_000);

	it("start from an expense, are made with catch-up by the daily job, each once", async () => {
		const rent = await expenses.createExpense(
			as("maya"),
			expense({ title: "Rent", merchant: "", amountMinor: 3_000_000 }),
		);
		const [made] = await recurring.repeatExpense(as("maya"), {
			expenseId: rent.id,
			unit: "month",
			every: 1,
			endsOn: null,
		});
		if (!made) throw new Error("not recurring");
		expect(made.nextOn > today).toBe(true);
		expect(made.made).toBe(1);
		expect(
			await code(recurring.repeatExpense(as("maya"), { expenseId: rent.id, unit: "week", every: 1, endsOn: null })),
		).toBe("CONFLICT");
		// Nothing is due yet.
		expect((await recurring.makeDueRecurring(env.db)).made).toBe(0);
		// A hundred days on, three months were missed: each is made once.
		const run = await runKharchaCron(env.db, { now: later(100) });
		expect(run.recurring).toMatchObject({ ok: true, made: 3, paused: 0 });
		expect((await recurring.makeDueRecurring(env.db, later(100))).made).toBe(0);
		const rows = await env.db
			.select({ n: khExpense.recurringN, spentOn: khExpense.spentOn })
			.from(khExpense)
			.where(isNotNull(khExpense.recurringId))
			.orderBy(khExpense.recurringN);
		expect(rows.map((row) => row.n)).toEqual([0, 1, 2, 3]);
		expect(rows.map((row) => row.spentOn)).toEqual([
			today,
			...[1, 2, 3].map((n) => {
				const month = addMonths(thisMonth, n);
				const last = Number(monthDays(month).last.slice(8, 10));
				return `${month}-${String(Math.min(Number(today.slice(8, 10)), last)).padStart(2, "0")}`;
			}),
		]);
		const [after] = await recurring.listRecurring(as("maya"));
		expect(after).toMatchObject({ made: 4, lastMadeOn: rows[3]?.spentOn });
		// The owner hears of each.
		const told = await env.db.select().from(khNotification).where(eq(khNotification.kind, "recurring.made"));
		expect(told).toHaveLength(3);
		await expectLedgerConsistent(env.db);
	});

	it("skip the next one, pause and resume without catching up, stop at the end date", async () => {
		const tea = await expenses.createExpense(as("maya"), expense({ title: "Tea", amountMinor: 5_000 }));
		const [weekly] = await recurring.repeatExpense(as("maya"), {
			expenseId: tea.id,
			unit: "week",
			every: 1,
			endsOn: addDays(today, 21),
		});
		if (!weekly) throw new Error("not recurring");
		expect(weekly.nextOn).toBe(addDays(today, 7));
		const [skipped] = await recurring.skipRecurring(as("maya"), weekly.id);
		expect(skipped?.nextOn).toBe(addDays(today, 14));
		const [paused] = await recurring.pauseRecurring(as("maya"), { recurringId: weekly.id, paused: true });
		expect(paused?.paused).toBe(true);
		expect((await recurring.makeDueRecurring(env.db, later(30))).made).toBe(0);
		await recurring.pauseRecurring(as("maya"), { recurringId: weekly.id, paused: false });
		// Up to its end date: the weeks 14 and 21 days on.
		expect((await recurring.makeDueRecurring(env.db, later(60))).made).toBe(2);
		const [ended] = await recurring.listRecurring(as("maya"));
		expect(ended?.ended).toBe(true);
		// Another's is NOT_FOUND, for everything.
		expect(await code(recurring.skipRecurring(as("asha"), weekly.id))).toBe("NOT_FOUND");
		expect(await code(recurring.deleteRecurring(as("asha"), weekly.id))).toBe("NOT_FOUND");
		await recurring.deleteRecurring(as("maya"), weekly.id);
		expect(await env.db.select().from(khRecurring)).toEqual([]);
		// What it made stays.
		expect(await env.db.select({ id: khExpense.id }).from(khExpense)).toHaveLength(3);
	});

	it("make a group's shared rent for everyone on it, and pause when they can't", async () => {
		const asha = await personOf("asha");
		const maya = await personOf("maya");
		await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
		const flat = await groups.createGroup(as("maya"), {
			name: "Flat 3B",
			kind: "home",
			color: "teal",
			currency: "NPR",
			startOn: null,
			endOn: null,
			memberIds: [asha],
		});
		const rent = await expenses.createExpense(
			as("maya"),
			expense({
				groupId: flat.id,
				title: "Rent",
				amountMinor: 4_000_000,
				split: { method: "equal", people: [maya, asha] },
			}),
		);
		const [rentAgain] = await recurring.repeatExpense(as("maya"), {
			expenseId: rent.id,
			unit: "month",
			every: 1,
			endsOn: null,
		});
		if (!rentAgain) throw new Error("not recurring");
		expect(rentAgain.group?.name).toBe("Flat 3B");
		expect(rentAgain.myShareMinor).toBe(2_000_000);
		// Asha sees the expenses it makes, not the recurring expense.
		expect(await recurring.listRecurring(as("asha"))).toEqual([]);
		expect(await code(recurring.pauseRecurring(as("asha"), { recurringId: rentAgain.id, paused: true }))).toBe(
			"NOT_FOUND",
		);
		expect((await recurring.makeDueRecurring(env.db, later(40))).made).toBe(1);
		const added = await env.db
			.select()
			.from(khNotification)
			.where(and(eq(khNotification.userId, "asha"), eq(khNotification.kind, "expense.added")));
		expect(added.length).toBeGreaterThanOrEqual(2);
		await expectLedgerConsistent(env.db);
		// Archived, the group takes no expenses: the next one pauses it with the reason.
		await groups.archiveGroup(as("maya"), flat.id, true);
		const run = await recurring.makeDueRecurring(env.db, later(75));
		expect(run).toMatchObject({ made: 0, paused: 1 });
		const [stopped] = await recurring.listRecurring(as("maya"));
		expect(stopped).toMatchObject({ paused: true, problem: "group" });
	});

	it("are listed on Home the day before", async () => {
		const tea = await expenses.createExpense(
			as("maya"),
			expense({ title: "Tea", spentOn: addDays(today, -6), amountMinor: 5_000 }),
		);
		await recurring.repeatExpense(as("maya"), { expenseId: tea.id, unit: "week", every: 1, endsOn: null });
		const todo = (await home.getHome(as("maya"))).todos.find((each) => each.kind === "recurring");
		expect(todo?.kind === "recurring" && todo.recurring.nextOn).toBe(addDays(today, 1));
	});
});

describe("insights", () => {
	it("sum a month against the one before, by category, merchant and day, in one currency", async () => {
		const food = await categoryOf("maya", "food");
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 300_000 }));
		await expenses.createExpense(as("maya"), expense({ categoryId: food, kind: "refund", amountMinor: 50_000 }));
		await expenses.createExpense(
			as("maya"),
			expense({ categoryId: null, merchant: "Himalayan Java", amountMinor: 40_000 }),
		);
		await expenses.createExpense(
			as("maya"),
			expense({ categoryId: food, spentOn: lastMonthDay, amountMinor: 100_000 }),
		);
		await expenses.createExpense(as("maya"), expense({ currency: "USD", amountMinor: 999 }));
		const overview = await insights.insightsOverview(as("maya"), {});
		expect(overview).toMatchObject({ month: thisMonth, currency: "NPR", total: 290_000, previousTotal: 100_000 });
		expect(overview.currencies).toEqual(["NPR", "USD"]);
		expect(overview.byCategory.find((row) => row.key === food)).toMatchObject({
			amountMinor: 250_000,
			previousMinor: 100_000,
		});
		expect(overview.byCategory.find((row) => row.key === "")).toMatchObject({ amountMinor: 40_000 });
		expect(overview.merchants.map((row) => row.key)).toEqual(["Bhatbhateni", "Himalayan Java"]);
		expect(overview.days).toHaveLength(Number(monthDays(thisMonth).last.slice(8, 10)));
		expect(overview.days.find((row) => row.day === today)?.amountMinor).toBe(290_000);
		expect((await insights.insightsOverview(as("maya"), { currency: "USD" })).total).toBe(999);
		// Another person's spending is never in it.
		expect((await insights.insightsOverview(as("asha"), {})).total).toBe(0);
	});

	it("trend twelve months by category, tag and shared spending", async () => {
		const asha = await personOf("asha");
		const maya = await personOf("maya");
		await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
		await expenses.createExpense(as("maya"), expense({ spentOn: lastMonthDay, amountMinor: 100_000 }));
		await expenses.createExpense(
			as("maya"),
			expense({ title: "Dinner", amountMinor: 200_000, split: { method: "equal", people: [maya, asha] } }),
		);
		const trends = await insights.insightsTrends(as("maya"), {});
		expect(trends.months).toHaveLength(12);
		expect(trends.months.at(-1)).toBe(thisMonth);
		expect(trends.totals.slice(-2)).toEqual([100_000, 100_000]);
		expect(trends.shared).toEqual([
			{ key: `f:${asha}`, label: "Asha", color: expect.any(String), values: [...Array(11).fill(0), 100_000] },
		]);
	});

	it("state a range of days with totals, refunds and every expense", async () => {
		const food = await categoryOf("maya", "food");
		await expenses.createExpense(as("maya"), expense({ categoryId: food, amountMinor: 300_000 }));
		await expenses.createExpense(as("maya"), expense({ kind: "refund", amountMinor: 20_000 }));
		await expenses.createExpense(as("maya"), expense({ spentOn: addDays(today, -40), amountMinor: 70_000 }));
		const statement = await insights.insightsStatement(as("maya"), { from: addDays(today, -60), to: today });
		const [npr] = statement.currencies;
		expect(npr).toMatchObject({ currency: "NPR", spent: 370_000, refunds: 20_000, net: 350_000, count: 3 });
		expect(npr?.lines.map((line) => line.myShareMinor)).toEqual([70_000, 300_000, 20_000]);
		expect(statement.truncated).toBe(false);
		const thisMonthOnly = await insights.insightsStatement(as("maya"), {});
		expect(thisMonthOnly.from).toBe(`${thisMonth}-01`);
	});
});
