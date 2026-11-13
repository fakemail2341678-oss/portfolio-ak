import "@tanstack/react-start/server-only";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import type { SpendExportInput } from "@/features/kharcha/schema";
import type { SpendChartInput, SpendGroupBy, SpendListInput } from "@/features/kharcha/search";
import { parseQuery } from "@/features/kharcha/spend/query/parse";
import type {
	Amount,
	SpendBucket,
	SpendChart,
	SpendExportRow,
	SpendItem,
	SpendPage,
	SpendRow,
	ThreadPayment,
} from "@/features/kharcha/types";
import { SPEND_OTHER_BUCKET } from "@/features/kharcha/types";
import { type IsoDate, todayInZone } from "@/lib/i18n/date-only";
import { pageWindow } from "@/lib/list/paging";
import { notFound } from "@/server/db/crud";
import {
	khCategory,
	khExpense,
	khExpensePayer,
	khExpenseShare,
	khGroup,
	khMethod,
	khPayment,
	khProfile,
	khShareTag,
	khTag,
} from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import * as repo from "../expenses/repository";
import { fixesOf } from "../expenses/service";
import { byCurrency } from "../ledger";
import * as lists from "../lists/repository";
import { loadPeople } from "../people";
import { receiptCounts } from "../receipts/service";
import { asksDuplicates, type CompiledQuery, compileQuery } from "./compile";

/**
 * Spend (docs/guides/kharcha.md "Spend", Tasks 89 and 93): the expenses the caller is on,
 * outside the trash, matching a query in the search language (decision 0287), on the URL
 * list contract; the amounts that count are their share, a refund against it (PLAN 14.5
 * "Money"). Payments are listed when the query asks (`type:payment`) and never counted as
 * spending. The same query draws the chart and fills the CSV.
 */

/** The caller's share, a refund counting against it. */
const signedShare = sql<number>`case when ${khExpense.kind} = 'refund' then -${khExpenseShare.owedMinor} else ${khExpenseShare.owedMinor} end`;

/** The rows of Spend for some of the caller's expenses, in the order given. */
export async function spendRows(db: Db | Tx, me: Me, expenseIds: ReadonlyArray<string>): Promise<SpendRow[]> {
	if (expenseIds.length === 0) return [];
	const ids = [...expenseIds];
	const rows = await db.select().from(khExpense).where(inArray(khExpense.id, ids));
	const parts = await repo.partsOfMany(db, ids);
	const mines = await repo.minesOf(db, me.personId, ids);
	const duplicates = await repo.duplicatesOf(db, me.personId, ids);
	const chips = await lists.chipsOf(
		db,
		[...mines.values()].map((mine) => mine.categoryId),
	);
	const counts = await receiptCounts(db, ids);
	const people = await loadPeople(db, me.personId, [
		...new Set([...parts.values()].flatMap((part) => repo.partsPeople(part))),
	]);
	return ids.flatMap((id) => {
		const expense = rows.find((row) => row.id === id);
		const part = parts.get(id);
		const mine = mines.get(id);
		if (!expense || !part || !mine) return [];
		const myShare = part.shares.find((share) => share.person === me.personId);
		const named = new Set(repo.partsPeople(part));
		return [
			{
				id: expense.id,
				groupId: expense.groupId,
				kind: expense.kind,
				title: expense.title || expense.merchant,
				merchant: expense.merchant,
				amountMinor: expense.amountMinor,
				currency: expense.currency,
				spentOn: expense.spentOn,
				payers: part.payers.map((payer) => ({ personId: payer.person, amountMinor: payer.amount })),
				people: people.filter((person) => named.has(person.id)),
				myShareMinor: myShare?.owed ?? 0,
				myPaidMinor: part.payers.find((payer) => payer.person === me.personId)?.amount ?? 0,
				category: mine.categoryId ? (chips.get(mine.categoryId) ?? null) : null,
				fixes: fixesOf(expense, myShare ? myShare.owed : null, mine, duplicates.get(id)?.length ?? 0),
				receipts: counts.get(id) ?? 0,
			},
		];
	});
}

/** Payments as their cards (a thread's and Spend's), by id. */
export async function paymentCards(
	db: Db | Tx,
	me: Me,
	ids: ReadonlyArray<string>,
): Promise<Map<string, ThreadPayment>> {
	const result = new Map<string, ThreadPayment>();
	if (ids.length === 0) return result;
	const rows = await db
		.select()
		.from(khPayment)
		.where(inArray(khPayment.id, [...ids]));
	const people = await loadPeople(
		db,
		me.personId,
		rows.flatMap((row) => [row.fromPerson, row.toPerson]),
	);
	for (const row of rows) {
		result.set(row.id, {
			id: row.id,
			groupId: row.groupId,
			fromId: row.fromPerson,
			toId: row.toPerson,
			amountMinor: row.amountMinor,
			currency: row.currency,
			paid:
				row.paidCurrency && row.paidAmountMinor !== null && row.rate !== null
					? { currency: row.paidCurrency, amountMinor: row.paidAmountMinor, rate: row.rate }
					: null,
			method: row.method,
			note: row.note,
			paidOn: row.paidOn,
			people: people.filter((person) => person.id === row.fromPerson || person.id === row.toPerson),
		});
	}
	return result;
}

/** The caller, today in their time zone, and their query compiled. */
async function compiled(
	{ db, user }: KharchaServices,
	q: string,
): Promise<{ me: Me; today: IsoDate; where: CompiledQuery }> {
	const me = await resolveMe(db, user);
	const [profile] = await db
		.select({ timeZone: khProfile.timeZone })
		.from(khProfile)
		.where(eq(khProfile.userId, user.id));
	if (!profile) throw notFound("Profile");
	const today = todayInZone(profile.timeZone);
	const terms = parseQuery(q);
	const duplicateIds = asksDuplicates(terms) ? [...(await repo.duplicatesOf(db, me.personId, null)).keys()] : [];
	return { me, today, where: compileQuery(terms, { personId: me.personId, today, duplicateIds }) };
}

export async function listSpend(services: KharchaServices, input: SpendListInput): Promise<SpendPage> {
	const { db } = services;
	const { me, where } = await compiled(services, input.q);
	const totals = await db
		.select({
			currency: khExpense.currency,
			count: sql<number>`count(*)`.mapWith(Number),
			sum: sql<string>`sum(${signedShare})`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(where.expense)
		.groupBy(khExpense.currency);
	const payments = where.payment
		? ((
				await db
					.select({ count: sql<number>`count(*)`.mapWith(Number) })
					.from(khPayment)
					.where(where.payment)
			)[0]?.count ?? 0)
		: 0;
	const total = totals.reduce((sum, row) => sum + row.count, 0) + payments;
	const window = pageWindow({ page: input.page, pageSize: input.pageSize, total });
	const descending = input.sort.startsWith("-");
	const by = input.sort.replace("-", "") === "amount" ? "amount" : "day";
	const direction = (value: SQL) => (descending ? sql`${value} desc` : sql`${value} asc`);
	// Newest first within a day too: the one added last on top.
	const order = [
		direction(sql`${sql.identifier(by)}`),
		sql`${sql.identifier("at")} desc`,
		direction(sql`${sql.identifier("id")}`),
	];
	const expenseSide = db
		.select({
			source: sql<string>`'expense'`.as("source"),
			id: sql<string>`${khExpense.id}`.as("id"),
			day: sql<string>`${khExpense.spentOn}`.as("day"),
			at: sql<string>`${khExpense.createdAt}`.as("at"),
			amount: sql<number>`${khExpenseShare.owedMinor}`.as("amount"),
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(where.expense);
	const found =
		total === 0
			? []
			: where.payment
				? await unionAll(
						expenseSide,
						db
							.select({
								source: sql<string>`'payment'`.as("source"),
								id: sql<string>`${khPayment.id}`.as("id"),
								day: sql<string>`${khPayment.paidOn}`.as("day"),
								at: sql<string>`${khPayment.createdAt}`.as("at"),
								amount: sql<number>`${khPayment.amountMinor}`.as("amount"),
							})
							.from(khPayment)
							.where(where.payment),
					)
						.orderBy(...order)
						.limit(window.limit)
						.offset(window.offset)
				: await expenseSide
						.orderBy(
							descending
								? desc(by === "amount" ? khExpenseShare.owedMinor : khExpense.spentOn)
								: asc(by === "amount" ? khExpenseShare.owedMinor : khExpense.spentOn),
							desc(khExpense.createdAt),
							descending ? desc(khExpense.id) : asc(khExpense.id),
						)
						.limit(window.limit)
						.offset(window.offset);
	const expenseIds = found.filter((row) => row.source === "expense").map((row) => row.id);
	const rows = new Map((await spendRows(db, me, expenseIds)).map((row) => [row.id, row]));
	const cards = await paymentCards(
		db,
		me,
		found.filter((row) => row.source === "payment").map((row) => row.id),
	);
	const items = found.flatMap((row): SpendItem[] => {
		if (row.source === "payment") {
			const payment = cards.get(row.id);
			return payment ? [{ source: "payment", ...payment }] : [];
		}
		const expense = rows.get(row.id);
		return expense ? [{ source: "expense", ...expense }] : [];
	});
	return {
		items,
		total,
		page: window.page,
		pageCount: window.pageCount,
		totals: totals.map((row): Amount => ({ currency: row.currency, amountMinor: Number(row.sum) })).sort(byCurrency),
	};
}

/** Charts keep the largest buckets of a list (categories, merchants…) and sum the rest into "Other". */
export const CHART_BUCKETS = 12;

const TIME_GROUPS: ReadonlyArray<SpendGroupBy> = ["day", "week", "month", "year"];

/** The bucket key of each share for `groupBy`, and the name it shows. */
function bucketOf(groupBy: SpendGroupBy, meId: string): { key: SQL; label: SQL; join?: "tag" | "friend" } {
	switch (groupBy) {
		case "category":
			return {
				key: sql`coalesce(${khExpenseShare.categoryId}::text, '')`,
				label: sql`coalesce((select ${khCategory.name} from ${khCategory} where ${khCategory.id} = ${khExpenseShare.categoryId}), '')`,
			};
		case "merchant":
			return { key: sql`lower(${khExpense.merchant})`, label: sql`${khExpense.merchant}` };
		case "method":
			return {
				key: sql`coalesce((select ${khExpensePayer.methodId}::text from ${khExpensePayer} where ${khExpensePayer.expenseId} = ${khExpense.id} and ${khExpensePayer.personId} = ${meId}), '')`,
				label: sql`coalesce((select ${khMethod.name} from ${khExpensePayer} inner join ${khMethod} on ${khMethod.id} = ${khExpensePayer.methodId}
					where ${khExpensePayer.expenseId} = ${khExpense.id} and ${khExpensePayer.personId} = ${meId}), '')`,
			};
		case "group":
			return {
				key: sql`coalesce(${khExpense.groupId}::text, '')`,
				label: sql`coalesce((select ${khGroup.name} from ${khGroup} where ${khGroup.id} = ${khExpense.groupId}), '')`,
			};
		case "tag":
			return { key: sql`coalesce(tagged.tag_id::text, '')`, label: sql`''`, join: "tag" };
		case "friend":
			return { key: sql`coalesce(other.person::text, '')`, label: sql`''`, join: "friend" };
		case "day":
			return { key: sql`${khExpense.spentOn}::text`, label: sql`''` };
		case "week":
			// Weeks start on Sunday, as `date:this-week` does.
			return { key: sql`(${khExpense.spentOn} - extract(dow from ${khExpense.spentOn})::int)::text`, label: sql`''` };
		case "month":
			return { key: sql`to_char(${khExpense.spentOn}, 'YYYY-MM')`, label: sql`''` };
		case "year":
			return { key: sql`to_char(${khExpense.spentOn}, 'YYYY')`, label: sql`''` };
	}
}

/**
 * The search's chart: the caller's spending (their share, refunds against it) summed by
 * `groupBy`, per currency. An expense with two tags counts in both; one shared with two
 * friends counts in each friend's bar (its own share each time). Lists keep their largest
 * buckets; periods run in order.
 */
export async function spendChart(services: KharchaServices, input: SpendChartInput): Promise<SpendChart> {
	const { db } = services;
	const { me, where } = await compiled(services, input.q);
	const bucket = bucketOf(input.groupBy, me.personId);
	const joined =
		bucket.join === "tag"
			? sql`left join ${khShareTag} as tagged on tagged.expense_id = ${khExpense.id} and tagged.person_id = ${me.personId}`
			: bucket.join === "friend"
				? sql`left join (select ${khExpenseShare.expenseId} as expense_id, ${khExpenseShare.personId} as person from ${khExpenseShare}
						union select ${khExpensePayer.expenseId}, ${khExpensePayer.personId} from ${khExpensePayer}) as other
						on other.expense_id = ${khExpense.id} and other.person <> ${me.personId}`
				: sql``;
	const rows = (await db.execute(sql`
		select ${khExpense.currency} as currency, ${bucket.key} as key, max(${bucket.label}) as label, sum(${signedShare}) as amount
		from ${khExpenseShare} inner join ${khExpense} on ${khExpense.id} = ${khExpenseShare.expenseId} ${joined}
		where ${where.expense}
		group by 1, 2
	`)) as unknown as { rows: Array<{ currency: string; key: string; label: string; amount: string }> };
	const byCode = new Map<string, SpendBucket[]>();
	for (const row of rows.rows) {
		byCode.set(row.currency, [
			...(byCode.get(row.currency) ?? []),
			{ key: row.key, label: row.label ?? "", amountMinor: Number(row.amount) },
		]);
	}
	const people =
		input.groupBy === "friend"
			? await loadPeople(
					db,
					me.personId,
					[...byCode.values()].flatMap((buckets) => buckets.flatMap((each) => (each.key ? [each.key] : []))),
				)
			: [];
	const tags =
		input.groupBy === "tag"
			? await db.select({ id: khTag.id, name: khTag.name }).from(khTag).where(eq(khTag.ownerId, me.personId))
			: [];
	const named = (each: SpendBucket): SpendBucket => {
		if (input.groupBy === "friend") return { ...each, label: people.find((p) => p.id === each.key)?.name ?? "" };
		if (input.groupBy === "tag") return { ...each, label: tags.find((tag) => tag.id === each.key)?.name ?? "" };
		return each;
	};
	const time = TIME_GROUPS.includes(input.groupBy);
	return {
		currencies: [...byCode.entries()]
			.map(([currency, buckets]) => {
				const all = buckets.map(named);
				const total = all.reduce((sum, each) => sum + each.amountMinor, 0);
				if (time) return { currency, total, buckets: all.sort((a, b) => a.key.localeCompare(b.key)) };
				const sorted = all.sort((a, b) => b.amountMinor - a.amountMinor || a.label.localeCompare(b.label));
				const kept = sorted.slice(0, CHART_BUCKETS);
				const rest = sorted.slice(CHART_BUCKETS).reduce((sum, each) => sum + each.amountMinor, 0);
				return {
					currency,
					total,
					buckets: rest === 0 ? kept : [...kept, { key: SPEND_OTHER_BUCKET, label: "", amountMinor: rest }],
				};
			})
			.sort((a, b) => a.currency.localeCompare(b.currency)),
	};
}

/** At most this many lines in one CSV of a search. */
export const EXPORT_MAX = 10_000;

/**
 * The search (or the rows chosen) as CSV lines: each expense's total and the caller's share,
 * with their own category, tags and method, newest first. Payments aren't spending: a CSV
 * holds expenses and refunds.
 */
export async function exportSpend(services: KharchaServices, input: SpendExportInput): Promise<SpendExportRow[]> {
	const { db } = services;
	const { me, where } = await compiled(services, input.ids ? "" : input.q);
	const rows = await db
		.select({
			id: khExpense.id,
			spentOn: khExpense.spentOn,
			kind: khExpense.kind,
			title: khExpense.title,
			merchant: khExpense.merchant,
			notes: khExpense.notes,
			currency: khExpense.currency,
			amountMinor: khExpense.amountMinor,
			shareMinor: khExpenseShare.owedMinor,
			category: sql<string>`coalesce((select ${khCategory.name} from ${khCategory} where ${khCategory.id} = ${khExpenseShare.categoryId}), '')`,
			method: sql<string>`coalesce((select ${khMethod.name} from ${khExpensePayer} inner join ${khMethod} on ${khMethod.id} = ${khExpensePayer.methodId}
				where ${khExpensePayer.expenseId} = ${khExpense.id} and ${khExpensePayer.personId} = ${me.personId}), '')`,
			group: sql<string>`coalesce((select ${khGroup.name} from ${khGroup} where ${khGroup.id} = ${khExpense.groupId}), '')`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(input.ids ? and(where.expense, inArray(khExpense.id, input.ids)) : where.expense)
		.orderBy(desc(khExpense.spentOn), desc(khExpense.createdAt))
		.limit(EXPORT_MAX);
	const ids = rows.map((row) => row.id);
	const tags =
		ids.length === 0
			? []
			: await db
					.select({ id: khShareTag.expenseId, name: khTag.name })
					.from(khShareTag)
					.innerJoin(khTag, eq(khTag.id, khShareTag.tagId))
					.where(and(eq(khShareTag.personId, me.personId), inArray(khShareTag.expenseId, ids)))
					.orderBy(khTag.name);
	const parts = await repo.partsOfMany(db, ids);
	const people = await loadPeople(db, me.personId, [
		...new Set([...parts.values()].flatMap((part) => part.payers.map((payer) => payer.person))),
	]);
	return rows.map((row) => ({
		spentOn: row.spentOn,
		kind: row.kind,
		title: row.title,
		merchant: row.merchant,
		category: row.category,
		tags: tags.filter((tag) => tag.id === row.id).map((tag) => tag.name),
		method: row.method,
		currency: row.currency,
		amountMinor: row.amountMinor,
		shareMinor: row.shareMinor,
		group: row.group,
		paidBy: (parts.get(row.id)?.payers ?? []).map(
			(payer) => people.find((person) => person.id === payer.person)?.name ?? "",
		),
		notes: row.notes,
	}));
}
