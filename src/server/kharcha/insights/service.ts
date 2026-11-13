import "@tanstack/react-start/server-only";
import { eq, type SQL, sql } from "drizzle-orm";
import {
	type InsightsInput,
	STATEMENT_LINES_MAX as STATEMENT_MAX,
	type StatementInput,
} from "@/features/kharcha/search";
import {
	type InsightsOverview,
	type InsightsStatement,
	type InsightsTrends,
	SPEND_OTHER_BUCKET,
	type SpendBucket,
	type StatementLine,
	type TrendSeries,
} from "@/features/kharcha/types";
import { addDays, addMonths, type IsoDate, type IsoMonth, monthDays, todayInZone } from "@/lib/i18n/date-only";
import { notFound } from "@/server/db/crud";
import { khExpense, khExpensePayer, khExpenseShare, khGroup, khProfile, khShareTag, khTag } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { byCurrency } from "../ledger";
import { chipsOf } from "../lists/repository";
import { loadPeople } from "../people";

/**
 * Insights (Task 94, decision 0288; docs/guides/kharcha.md "Insights"): sums of the
 * caller's spending, which is their share of each expense outside the trash, a refund
 * counting against it (PLAN 14.5 "Money"). Each total is one currency's; nothing is
 * converted. Days are calendar days (`spent_on`), months in the caller's time zone's today.
 */

/** Merchants the overview lists, and lines a trend keeps before the rest are "Other" (with it, the kit's five colours). */
export const TOP_MERCHANTS = 8;
export const TREND_SERIES = 4;

const signed = sql`case when ${khExpense.kind} = 'refund' then -${khExpenseShare.owedMinor} else ${khExpenseShare.owedMinor} end`;

type Rows<T> = { rows: T[] };

async function context(services: KharchaServices) {
	const me = await resolveMe(services.db, services.user);
	const [profile] = await services.db
		.select({ timeZone: khProfile.timeZone, homeCurrency: khProfile.homeCurrency })
		.from(khProfile)
		.where(eq(khProfile.userId, services.user.id));
	if (!profile) throw notFound("Profile");
	return { me, profile, today: todayInZone(profile.timeZone) };
}

/** The caller's shares outside the trash between two days (and in a currency), as a `where`. */
const mine = (me: Me, from: IsoDate, to: IsoDate, currency?: string): SQL =>
	sql`${khExpenseShare.personId} = ${me.personId} and ${khExpense.deletedAt} is null
		and ${khExpense.spentOn} between ${from} and ${to}${currency ? sql` and ${khExpense.currency} = ${currency}` : sql``}`;

const from = sql`from ${khExpenseShare} inner join ${khExpense} on ${khExpense.id} = ${khExpenseShare.expenseId}`;

/** The currency to show: the one asked for when the caller spent in it, else their home currency, else their largest. */
function pickCurrency(
	totals: ReadonlyArray<{ currency: string; total: number }>,
	asked: string | undefined,
	home: string,
) {
	const codes = totals.map((row) => row.currency);
	if (asked && codes.includes(asked)) return asked;
	if (codes.includes(home)) return home;
	return [...totals].sort((a, b) => Math.abs(b.total) - Math.abs(a.total))[0]?.currency ?? asked ?? home;
}

async function currencyTotals(db: Db, me: Me, first: IsoDate, last: IsoDate) {
	const rows = (await db.execute(sql`
		select ${khExpense.currency} as currency, sum(${signed}) as total ${from}
		where ${mine(me, first, last)}
		group by 1
	`)) as unknown as Rows<{ currency: string; total: string }>;
	return rows.rows.map((row) => ({ currency: row.currency, total: Number(row.total) })).sort(byCurrency);
}

const monthOr = (asked: string | undefined, today: IsoDate): IsoMonth => asked ?? today.slice(0, 7);

/** The overview: a month against the one before, by category, the top merchants, and every day. */
export async function insightsOverview(services: KharchaServices, input: InsightsInput): Promise<InsightsOverview> {
	const { db } = services;
	const { me, profile, today } = await context(services);
	const month = monthOr(input.month, today);
	const previous = addMonths(month, -1);
	const { first, last } = monthDays(month);
	const before = monthDays(previous);
	const totals = await currencyTotals(db, me, before.first, last);
	const currency = pickCurrency(totals, input.currency, profile.homeCurrency);

	const categories = (await db.execute(sql`
		select coalesce(${khExpenseShare.categoryId}::text, '') as key,
			sum(case when ${khExpense.spentOn} >= ${first} then ${signed} else 0 end) as current,
			sum(case when ${khExpense.spentOn} < ${first} then ${signed} else 0 end) as previous
		${from}
		where ${mine(me, before.first, last, currency)}
		group by 1
	`)) as unknown as Rows<{ key: string; current: string; previous: string }>;
	const chips = await chipsOf(
		db,
		categories.rows.map((row) => row.key || null),
	);
	const merchants = (await db.execute(sql`
		select coalesce(nullif(${khExpense.merchant}, ''), nullif(${khExpense.title}, ''), '') as key, sum(${signed}) as amount
		${from}
		where ${mine(me, first, last, currency)}
		group by 1
		order by 2 desc, 1
		limit ${TOP_MERCHANTS}
	`)) as unknown as Rows<{ key: string; amount: string }>;
	const days = (await db.execute(sql`
		select ${khExpense.spentOn}::text as day, sum(${signed}) as amount ${from}
		where ${mine(me, first, last, currency)}
		group by 1
	`)) as unknown as Rows<{ day: string; amount: string }>;

	const daily: InsightsOverview["days"] = [];
	for (let day = first; day <= last; day = addDays(day, 1)) {
		daily.push({ day, amountMinor: Number(days.rows.find((row) => row.day === day)?.amount ?? 0) });
	}
	const sum = (key: "current" | "previous") => categories.rows.reduce((total, row) => total + Number(row[key]), 0);
	return {
		month,
		previous,
		currencies: totals.map((row) => row.currency),
		currency,
		total: sum("current"),
		previousTotal: sum("previous"),
		byCategory: categories.rows
			.map((row) => {
				const chip = row.key ? chips.get(row.key) : undefined;
				return {
					key: row.key,
					label: chip?.name ?? "",
					color: chip?.color ?? null,
					amountMinor: Number(row.current),
					previousMinor: Number(row.previous),
				};
			})
			.filter((row) => row.amountMinor !== 0 || row.previousMinor !== 0)
			.sort((a, b) => b.amountMinor - a.amountMinor || b.previousMinor - a.previousMinor),
		merchants: merchants.rows
			.map((row): SpendBucket => ({ key: row.key, label: row.key, amountMinor: Number(row.amount) }))
			.filter((row) => row.amountMinor > 0),
		days: daily,
	};
}

/** Keeps the largest lines of a trend and sums the rest into "Other". */
function topSeries(series: TrendSeries[], months: number): TrendSeries[] {
	const total = (line: TrendSeries) => line.values.reduce((sum, value) => sum + value, 0);
	const sorted = [...series].sort((a, b) => total(b) - total(a) || a.label.localeCompare(b.label));
	const kept = sorted.slice(0, TREND_SERIES);
	const rest = sorted.slice(TREND_SERIES);
	if (rest.length === 0) return kept;
	const values = Array.from({ length: months }, (_, index) =>
		rest.reduce((sum, line) => sum + (line.values[index] ?? 0), 0),
	);
	return [...kept, { key: SPEND_OTHER_BUCKET, label: "", color: null, values }];
}

function seriesOf(
	rows: ReadonlyArray<{ key: string; month: string; amount: string }>,
	months: ReadonlyArray<IsoMonth>,
	label: (key: string) => { label: string; color: TrendSeries["color"] },
): TrendSeries[] {
	const byKey = new Map<string, number[]>();
	for (const row of rows) {
		const values = byKey.get(row.key) ?? months.map(() => 0);
		const index = months.indexOf(row.month);
		if (index >= 0) values[index] = (values[index] ?? 0) + Number(row.amount);
		byKey.set(row.key, values);
	}
	return topSeries(
		[...byKey].map(([key, values]) => ({ key, ...label(key), values })),
		months.length,
	);
}

/** Twelve months to `month`: the totals, by category, by tag, and shared spending by group and friend. */
export async function insightsTrends(services: KharchaServices, input: InsightsInput): Promise<InsightsTrends> {
	const { db } = services;
	const { me, profile, today } = await context(services);
	const month = monthOr(input.month, today);
	const months = Array.from({ length: 12 }, (_, index) => addMonths(month, index - 11));
	const first = monthDays(months[0] ?? month).first;
	const { last } = monthDays(month);
	const totals = await currencyTotals(db, me, first, last);
	const currency = pickCurrency(totals, input.currency, profile.homeCurrency);
	const where = mine(me, first, last, currency);
	const monthKey = sql`to_char(${khExpense.spentOn}, 'YYYY-MM')`;

	const categories = (await db.execute(sql`
		select coalesce(${khExpenseShare.categoryId}::text, '') as key, ${monthKey} as month, sum(${signed}) as amount
		${from} where ${where} group by 1, 2
	`)) as unknown as Rows<{ key: string; month: string; amount: string }>;
	const tags = (await db.execute(sql`
		select ${khShareTag.tagId}::text as key, max(${khTag.name}) as label, ${monthKey} as month, sum(${signed}) as amount
		${from}
		inner join ${khShareTag} on ${khShareTag.expenseId} = ${khExpense.id} and ${khShareTag.personId} = ${me.personId}
		inner join ${khTag} on ${khTag.id} = ${khShareTag.tagId}
		where ${where} group by 1, 3
	`)) as unknown as Rows<{ key: string; label: string; month: string; amount: string }>;
	// A group's expenses count for the group; one outside groups for each other person on it.
	const shared = (await db.execute(sql`
		select coalesce('g:' || ${khExpense.groupId}::text, 'f:' || other.person::text) as key,
			max(${khGroup.name}) as label, ${monthKey} as month, sum(${signed}) as amount
		${from}
		left join ${khGroup} on ${khGroup.id} = ${khExpense.groupId}
		left join (select ${khExpenseShare.expenseId} as expense_id, ${khExpenseShare.personId} as person from ${khExpenseShare}
			union select ${khExpensePayer.expenseId}, ${khExpensePayer.personId} from ${khExpensePayer}) as other
			on ${khExpense.groupId} is null and other.expense_id = ${khExpense.id} and other.person <> ${me.personId}
		where ${where} and (${khExpense.groupId} is not null or other.person is not null)
		group by 1, 3
	`)) as unknown as Rows<{ key: string; label: string | null; month: string; amount: string }>;

	const chips = await chipsOf(
		db,
		categories.rows.map((row) => row.key || null),
	);
	const people = await loadPeople(
		db,
		me.personId,
		shared.rows.flatMap((row) => (row.key.startsWith("f:") ? [row.key.slice(2)] : [])),
	);
	const tagNames = new Map(tags.rows.map((row) => [row.key, row.label]));
	const groupNames = new Map(shared.rows.map((row) => [row.key, row.label ?? ""]));
	const monthly = months.map(() => 0);
	for (const row of categories.rows) {
		const index = months.indexOf(row.month);
		if (index >= 0) monthly[index] = (monthly[index] ?? 0) + Number(row.amount);
	}
	return {
		months,
		currencies: totals.map((row) => row.currency),
		currency,
		totals: monthly,
		byCategory: seriesOf(categories.rows, months, (key) => {
			const chip = key ? chips.get(key) : undefined;
			return { label: chip?.name ?? "", color: chip?.color ?? null };
		}),
		byTag: seriesOf(tags.rows, months, (key) => ({ label: tagNames.get(key) ?? "", color: null })),
		shared: seriesOf(shared.rows, months, (key) =>
			key.startsWith("g:")
				? { label: groupNames.get(key) ?? "", color: null }
				: {
						label: people.find((person) => person.id === key.slice(2))?.name ?? "",
						color: people.find((person) => person.id === key.slice(2))?.color ?? null,
					},
		),
	};
}

/** A statement of a range of days (else this month): per currency, the totals, by category, and every expense. */
export async function insightsStatement(services: KharchaServices, input: StatementInput): Promise<InsightsStatement> {
	const { db } = services;
	const { me, today } = await context(services);
	const month = monthDays(today.slice(0, 7));
	const range = { from: input.from ?? month.first, to: input.to ?? month.last };
	const where = mine(me, range.from, range.to);

	const totals = (await db.execute(sql`
		select ${khExpense.currency} as currency,
			sum(case when ${khExpense.kind} = 'refund' then 0 else ${khExpenseShare.owedMinor} end) as spent,
			sum(case when ${khExpense.kind} = 'refund' then ${khExpenseShare.owedMinor} else 0 end) as refunds,
			count(*) as count
		${from} where ${where} group by 1
	`)) as unknown as Rows<{ currency: string; spent: string; refunds: string; count: string }>;
	const categories = (await db.execute(sql`
		select ${khExpense.currency} as currency, coalesce(${khExpenseShare.categoryId}::text, '') as key, sum(${signed}) as amount
		${from} where ${where} group by 1, 2 order by 3 desc
	`)) as unknown as Rows<{ currency: string; key: string; amount: string }>;
	const lines = (await db.execute(sql`
		select ${khExpense.id} as id, ${khExpense.spentOn}::text as "spentOn", ${khExpense.kind} as kind,
			${khExpense.title} as title, ${khExpense.merchant} as merchant, ${khExpenseShare.categoryId} as "categoryId",
			${khGroup.name} as "group", ${khExpense.amountMinor} as "amountMinor", ${khExpenseShare.owedMinor} as "myShareMinor",
			${khExpense.currency} as currency
		${from} left join ${khGroup} on ${khGroup.id} = ${khExpense.groupId}
		where ${where}
		order by ${khExpense.spentOn}, ${khExpense.createdAt}, ${khExpense.id}
		limit ${STATEMENT_MAX + 1}
	`)) as unknown as Rows<
		Omit<StatementLine, "category" | "amountMinor" | "myShareMinor"> & {
			categoryId: string | null;
			amountMinor: string;
			myShareMinor: string;
			currency: string;
		}
	>;
	const chips = await chipsOf(db, [
		...categories.rows.map((row) => row.key || null),
		...lines.rows.map((row) => row.categoryId),
	]);
	const listed = lines.rows.slice(0, STATEMENT_MAX);
	return {
		...range,
		truncated: lines.rows.length > STATEMENT_MAX,
		currencies: totals.rows
			.map((row) => {
				const spent = Number(row.spent);
				const refunds = Number(row.refunds);
				return {
					currency: row.currency,
					spent,
					refunds,
					net: spent - refunds,
					count: Number(row.count),
					byCategory: categories.rows
						.filter((each) => each.currency === row.currency && Number(each.amount) !== 0)
						.map((each) => ({
							key: each.key,
							label: (each.key && chips.get(each.key)?.name) || "",
							amountMinor: Number(each.amount),
						})),
					lines: listed
						.filter((line) => line.currency === row.currency)
						.map(
							(line): StatementLine => ({
								id: line.id,
								spentOn: line.spentOn,
								kind: line.kind,
								title: line.title,
								merchant: line.merchant,
								category: line.categoryId ? (chips.get(line.categoryId) ?? null) : null,
								group: line.group,
								amountMinor: Number(line.amountMinor),
								myShareMinor: Number(line.myShareMinor),
							}),
						),
				};
			})
			.sort(byCurrency),
	};
}
