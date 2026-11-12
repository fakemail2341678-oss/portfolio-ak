import "@tanstack/react-start/server-only";
import { and, eq, gte, inArray, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { SpendListInput } from "@/features/kharcha/search";
import type { Amount, SpendPage, SpendRow } from "@/features/kharcha/types";
import { monthDays, todayInZone } from "@/lib/i18n/date-only";
import { pageWindow } from "@/lib/list/paging";
import { notFound } from "@/server/db/crud";
import { allOf, orderBySort, textSearch } from "@/server/db/list";
import { khExpense, khExpenseShare, khProfile } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveMe } from "../access";
import * as repo from "../expenses/repository";
import { fixesOf } from "../expenses/service";
import { byCurrency } from "../ledger";
import * as lists from "../lists/repository";
import { loadPeople } from "../people";
import { receiptCounts } from "../receipts/service";

/**
 * Spend (docs/guides/kharcha.md "Spend", Task 89): the expenses the caller is on, outside
 * the trash, on the URL list contract. This month by default (in their time zone), newest
 * first; the amounts that count are their share, a refund against it (PLAN 14.5 "Money").
 * Task 93 adds the search language, saved searches and the other views.
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

export async function listSpend({ db, user }: KharchaServices, input: SpendListInput): Promise<SpendPage> {
	const me = await resolveMe(db, user);
	const [profile] = await db
		.select({ timeZone: khProfile.timeZone })
		.from(khProfile)
		.where(eq(khProfile.userId, user.id));
	if (!profile) throw notFound("Profile");
	const month = input.month ?? todayInZone(profile.timeZone).slice(0, 7);
	const range = month === "all" ? null : monthDays(month);
	const categories = input.category.filter((value) => value !== "none");
	const categoryFilter: SQL | undefined =
		input.category.length === 0
			? undefined
			: or(
					categories.length > 0 ? inArray(khExpenseShare.categoryId, categories) : undefined,
					input.category.includes("none") ? isNull(khExpenseShare.categoryId) : undefined,
				);
	const where = allOf(
		eq(khExpenseShare.personId, me.personId),
		isNull(khExpense.deletedAt),
		range ? and(gte(khExpense.spentOn, range.first), lte(khExpense.spentOn, range.last)) : undefined,
		textSearch(input.q, [khExpense.title, khExpense.merchant, khExpense.notes]),
		categoryFilter,
	);
	const base = () =>
		db
			.select({ id: khExpense.id })
			.from(khExpenseShare)
			.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
			.where(where);
	const totals = await db
		.select({
			currency: khExpense.currency,
			count: sql<number>`count(*)`.mapWith(Number),
			sum: sql<string>`sum(${signedShare})`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(where)
		.groupBy(khExpense.currency);
	const total = totals.reduce((sum, row) => sum + row.count, 0);
	const window = pageWindow({ page: input.page, pageSize: input.pageSize, total });
	const order = orderBySort(
		input.sort,
		{ date: khExpense.spentOn, amount: khExpenseShare.owedMinor },
		{ tiebreaker: khExpense.id, fallback: "date" },
	);
	// Newest first within a day too: the one added last on top.
	const [first, ...rest] = order;
	const ids =
		total === 0
			? []
			: (
					await base()
						.orderBy(...(first ? [first, sql`${khExpense.createdAt} desc`] : []), ...rest)
						.limit(window.limit)
						.offset(window.offset)
				).map((row) => row.id);
	return {
		items: await spendRows(db, me, ids),
		total,
		page: window.page,
		pageCount: window.pageCount,
		totals: totals.map((row): Amount => ({ currency: row.currency, amountMinor: Number(row.sum) })).sort(byCurrency),
	};
}
