import "@tanstack/react-start/server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
	amountFor,
	BUDGET_THRESHOLDS,
	type BudgetPeriod,
	budgetState,
	type PeriodRange,
	percentOf,
	periodCounts,
	periodOf,
	periodShift,
	thresholdsReached,
} from "@/features/kharcha/budgets/period";
import { budgetTarget } from "@/features/kharcha/notifications";
import type { BudgetMonthInput, CreateBudgetInput, UpdateBudgetInput } from "@/features/kharcha/schema";
import type { BudgetPeriodView, BudgetView } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { type IsoDate, todayInZone } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { isUniqueViolation, notFound } from "@/server/db/crud";
import {
	type KhBudgetRow,
	khBudget,
	khBudgetAlert,
	khBudgetMonth,
	khExpense,
	khExpenseShare,
	khPerson,
	khProfile,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { chipsOf, ownCategory } from "../lists/repository";
import { type Produced, produce } from "../notify/produce";
import { bumpRevs, saveVersioned } from "../rev";
import { assertCurrencyOffered } from "../rules";
import { assertQuota, getSettings, quotasFor } from "../settings";

/**
 * Budgets (Task 94, decision 0288; docs/guides/kharcha.md "Budgets"): limits on the
 * owner's own spending, which is their share of each expense outside the trash, a refund
 * counting against it (PLAN 14.5 "Money"), in one currency per period. Each is the owner's
 * alone: another's is NOT_FOUND. The daily job sends the alerts (`sendBudgetAlerts`).
 */

/** Periods before the current one a budget shows. */
export const BUDGET_HISTORY = 6;

type Conn = Db | Tx;

/** The caller's time zone, for "today" and the period holding it. */
async function zoneOf(db: Conn, userId: string): Promise<string> {
	const [row] = await db.select({ timeZone: khProfile.timeZone }).from(khProfile).where(eq(khProfile.userId, userId));
	return row?.timeZone ?? "UTC";
}

/** The owner's spending per currency, category and day in a range: the sums every budget is made of. */
async function spendingByDay(db: Conn, personId: string, currencies: ReadonlyArray<string>, range: PeriodRange) {
	if (currencies.length === 0) return [];
	const signed = sql`case when ${khExpense.kind} = 'refund' then -${khExpenseShare.owedMinor} else ${khExpenseShare.owedMinor} end`;
	const rows = await db
		.select({
			currency: khExpense.currency,
			categoryId: khExpenseShare.categoryId,
			day: khExpense.spentOn,
			total: sql<string>`sum(${signed})`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(
			and(
				eq(khExpenseShare.personId, personId),
				isNull(khExpense.deletedAt),
				inArray(khExpense.currency, [...currencies]),
				gte(khExpense.spentOn, range.start),
				lte(khExpense.spentOn, range.end),
			),
		)
		.groupBy(khExpense.currency, khExpenseShare.categoryId, khExpense.spentOn);
	return rows.map((row) => ({ ...row, total: Number(row.total) }));
}

type Day = Awaited<ReturnType<typeof spendingByDay>>[number];

const spentIn = (budget: KhBudgetRow, days: ReadonlyArray<Day>, range: PeriodRange): number =>
	days
		.filter(
			(day) =>
				day.currency === budget.currency &&
				(budget.categoryId === null || day.categoryId === budget.categoryId) &&
				day.day >= range.start &&
				day.day <= range.end,
		)
		.reduce((sum, day) => sum + day.total, 0);

type Months = Map<string, Array<{ month: string; amountMinor: number }>>;

async function monthsOf(db: Conn, ids: ReadonlyArray<string>): Promise<Months> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select()
		.from(khBudgetMonth)
		.where(inArray(khBudgetMonth.budgetId, [...ids]))
		.orderBy(asc(khBudgetMonth.month));
	const months: Months = new Map();
	for (const row of rows) {
		months.set(row.budgetId, [
			...(months.get(row.budgetId) ?? []),
			{ month: row.month.slice(0, 7), amountMinor: row.amountMinor },
		]);
	}
	return months;
}

const periodView = (budget: KhBudgetRow, months: Months, days: ReadonlyArray<Day>, range: PeriodRange) => {
	const amountMinor = amountFor(budget, months.get(budget.id) ?? [], range.start);
	const spentMinor = spentIn(budget, days, range);
	return {
		...range,
		amountMinor,
		spentMinor,
		state: budgetState(spentMinor, amountMinor),
		percent: percentOf(spentMinor, amountMinor),
	} satisfies BudgetPeriodView;
};

/** The person's budgets as of `today`, each with its period and the ones before it, in one read of their spending. */
export async function budgetViews(db: Conn, personId: string, today: IsoDate): Promise<BudgetView[]> {
	const rows = await db
		.select()
		.from(khBudget)
		.where(eq(khBudget.ownerId, personId))
		.orderBy(asc(khBudget.currency), asc(khBudget.period), asc(khBudget.createdAt));
	if (rows.length === 0) return [];
	const oldest = rows
		.map((row) => periodShift(row.period, today, -BUDGET_HISTORY).start)
		.reduce((a, b) => (a < b ? a : b));
	const latest = rows.map((row) => periodOf(row.period, today).end).reduce((a, b) => (a > b ? a : b));
	const days = await spendingByDay(db, personId, [...new Set(rows.map((row) => row.currency))], {
		start: oldest,
		end: latest,
	});
	const months = await monthsOf(
		db,
		rows.map((row) => row.id),
	);
	const chips = await chipsOf(
		db,
		rows.map((row) => row.categoryId),
	);
	return rows.map((row) => {
		const history: BudgetPeriodView[] = [];
		for (let by = -1; by >= -BUDGET_HISTORY; by -= 1) {
			const range = periodShift(row.period, today, by);
			if (!periodCounts(row.period, row.startsOn, range.start)) break;
			history.push(periodView(row, months, days, range));
		}
		return {
			id: row.id,
			category: row.categoryId ? (chips.get(row.categoryId) ?? null) : null,
			currency: row.currency,
			period: row.period,
			amountMinor: row.amountMinor,
			startsOn: row.startsOn,
			version: row.version,
			months: months.get(row.id) ?? [],
			current: periodView(row, months, days, periodOf(row.period, today)),
			history,
		};
	});
}

/** Insights' budgets and Home's progress: the caller's, as of today in their time zone. */
export async function listBudgets({ db, user }: KharchaServices): Promise<BudgetView[]> {
	const me = await resolveMe(db, user);
	return budgetViews(db, me.personId, todayInZone(await zoneOf(db, user.id)));
}

/** One of the caller's budgets, or NOT_FOUND. */
async function ownBudget(tx: Tx, me: Me, id: string): Promise<KhBudgetRow> {
	const [row] = await tx
		.select()
		.from(khBudget)
		.where(and(eq(khBudget.id, id), eq(khBudget.ownerId, me.personId)));
	if (!row) throw notFound("Budget");
	return row;
}

const duplicateBudget = () =>
	ruleError("CONFLICT", "Kharcha budget: one per category, currency and period", m.kharcha_error_budget_exists());

/** Every change answers with all the caller's budgets, and bumps their `rev`. */
async function change({ db, user }: KharchaServices, work: (tx: Tx, me: Me) => Promise<void>): Promise<BudgetView[]> {
	try {
		return await db.transaction(async (tx) => {
			const me = await resolveMe(tx, user);
			await work(tx, me);
			await bumpRevs(tx, [me.personId]);
			return budgetViews(tx, me.personId, todayInZone(await zoneOf(tx, user.id)));
		});
	} catch (error) {
		if (isUniqueViolation(error, "kh_budget_unique")) throw duplicateBudget();
		throw error;
	}
}

export const createBudget = (services: KharchaServices, input: CreateBudgetInput) =>
	change(services, async (tx, me) => {
		if (input.categoryId) await ownCategory(tx, me.personId, input.categoryId);
		const settings = await getSettings(tx);
		assertCurrencyOffered(settings, input.currency);
		await assertQuota(tx, `${me.personId}:budgets`, {
			table: khBudget,
			where: eq(khBudget.ownerId, me.personId),
			max: quotasFor(settings, me).budgets,
		});
		await tx.insert(khBudget).values({
			ownerId: me.personId,
			categoryId: input.categoryId ?? null,
			currency: input.currency,
			period: input.period as BudgetPeriod,
			amountMinor: input.amountMinor,
			startsOn: input.startsOn,
		});
	});

export const updateBudget = (services: KharchaServices, input: UpdateBudgetInput) =>
	change(services, async (tx, me) => {
		await ownBudget(tx, me, input.budgetId);
		await saveVersioned(tx, khBudget, {
			id: input.budgetId,
			version: input.version,
			set: { amountMinor: input.amountMinor, startsOn: input.startsOn },
			what: "Budget",
		});
	});

/** A monthly budget's own amount for one month, or (null) the budget's amount again. */
export const setBudgetMonth = (services: KharchaServices, input: BudgetMonthInput) =>
	change(services, async (tx, me) => {
		const budget = await ownBudget(tx, me, input.budgetId);
		if (budget.period !== "month") {
			throw ruleError("BAD_REQUEST", "Kharcha budget: a month's own amount", m.kharcha_error_budget_month());
		}
		const month = `${input.month}-01`;
		if (input.amountMinor === null) {
			await tx.delete(khBudgetMonth).where(and(eq(khBudgetMonth.budgetId, budget.id), eq(khBudgetMonth.month, month)));
			return;
		}
		await tx
			.insert(khBudgetMonth)
			.values({ budgetId: budget.id, month, amountMinor: input.amountMinor })
			.onConflictDoUpdate({
				target: [khBudgetMonth.budgetId, khBudgetMonth.month],
				set: { amountMinor: input.amountMinor },
			});
	});

export const deleteBudget = (services: KharchaServices, budgetId: string) =>
	change(services, async (tx, me) => {
		await ownBudget(tx, me, budgetId);
		await tx.delete(khBudget).where(eq(khBudget.id, budgetId));
	});

/**
 * The daily job's budget alerts (PLAN 14.5): each budget at 80% or 100% of the period
 * holding today in its owner's time zone gets one notification per threshold and period,
 * claimed in `kh_budget_alert` (`on conflict do nothing`), so a second run sends nothing.
 * A jump past both thresholds at once tells only "over" (both are marked).
 */
export async function sendBudgetAlerts(db: Db, now = new Date()): Promise<{ sent: number; instant: string[] }> {
	const owners = await db
		.selectDistinct({ personId: khBudget.ownerId, userId: khPerson.userId, timeZone: khProfile.timeZone })
		.from(khBudget)
		.innerJoin(khPerson, eq(khPerson.id, khBudget.ownerId))
		.innerJoin(khProfile, eq(khProfile.userId, khPerson.userId));
	let sent = 0;
	const instant: string[] = [];
	for (const owner of owners) {
		const views = await budgetViews(db, owner.personId, todayInZone(owner.timeZone, now));
		for (const view of views) {
			const reached = thresholdsReached(view.current.spentMinor, view.current.amountMinor);
			if (reached.length === 0) continue;
			const produced = await db.transaction(async (tx): Promise<Produced | null> => {
				const claimed = await tx
					.insert(khBudgetAlert)
					.values(reached.map((threshold) => ({ budgetId: view.id, periodStart: view.current.start, threshold })))
					.onConflictDoNothing()
					.returning({ threshold: khBudgetAlert.threshold });
				const highest = BUDGET_THRESHOLDS.filter((threshold) => claimed.some((row) => row.threshold === threshold)).at(
					-1,
				);
				if (highest === undefined) return null;
				await bumpRevs(tx, [owner.personId]);
				return produce(
					tx,
					{ personId: null, name: null },
					[
						{
							kind: "budget.alert",
							to: [owner.personId],
							thread: budgetTarget(view.id),
							data: {
								title: view.category?.name ?? "",
								threshold: highest,
								amounts: [{ currency: view.currency, amountMinor: view.current.spentMinor }],
								limit: { currency: view.currency, amountMinor: view.current.amountMinor },
							},
						},
					],
					now,
				);
			});
			if (!produced) continue;
			sent += 1;
			instant.push(...produced.instant);
		}
	}
	return { sent, instant };
}
