import "@tanstack/react-start/server-only";
import { and, desc, eq, gte, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { Amount, DuplicateRef, HomeActivity, HomeTodo, KharchaHome } from "@/features/kharcha/types";
import { addDays, addMonths, type IsoDate, monthDays, todayInZone } from "@/lib/i18n/date-only";
import { notFound } from "@/server/db/crud";
import { khActivity, khExpense, khExpenseShare, khGroupMember, khProfile } from "@/server/db/schema";
import { type KharchaServices, type Me, resolveMe } from "../access";
import { activityLines } from "../activity-lines";
import { duplicatesOf } from "../expenses/repository";
import { byCurrency, pairBalances } from "../ledger";
import { unreadCount, updatesOf } from "../notify/inbox";
import { loadPeople } from "../people";
import { draftsOf } from "../receipts/service";
import { spendRows } from "../spend/service";

/** How many lines Home's "Recent" shows. */
export const RECENT_LIMIT = 8;

/** How many friends the caller owes Home lists as debts to settle (Task 91). */
export const SETTLE_LIMIT = 5;

/** How many possible duplicates Home lists at most, and how far back it looks for them. */
export const DUPLICATES_LIMIT = 5;
const DUPLICATE_DAYS = 60;

/**
 * Home's to-dos (Task 89): receipts waiting for their details, newest first, then possible
 * duplicates among the caller's last two months (one line per pair: the later one).
 */
async function todosOf(services: KharchaServices, me: Me, today: IsoDate): Promise<HomeTodo[]> {
	const { db, imageStore } = services;
	const drafts = await draftsOf(db, imageStore, me);
	const recent = await db
		.select({ id: khExpense.id })
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(
			and(
				eq(khExpenseShare.personId, me.personId),
				eq(khExpenseShare.duplicateOk, false),
				isNull(khExpense.deletedAt),
				gte(khExpense.spentOn, addDays(today, -DUPLICATE_DAYS)),
			),
		)
		.orderBy(desc(khExpense.spentOn), desc(khExpense.createdAt))
		.limit(500);
	const found = await duplicatesOf(
		db,
		me.personId,
		recent.map((row) => row.id),
	);
	const seen = new Set<string>();
	const pairs: Array<{ id: string; of: DuplicateRef }> = [];
	for (const { id } of recent) {
		const [of] = found.get(id) ?? [];
		if (!of || seen.has(id) || pairs.length >= DUPLICATES_LIMIT) continue;
		seen.add(id).add(of.id);
		pairs.push({ id, of });
	}
	const rows = await spendRows(
		db,
		me,
		pairs.map((pair) => pair.id),
	);
	return [
		...drafts.map((draft): HomeTodo => ({ kind: "receipt", draft })),
		...pairs.flatMap((pair): HomeTodo[] => {
			const expense = rows.find((row) => row.id === pair.id);
			return expense ? [{ kind: "duplicate", expense, of: pair.of }] : [];
		}),
	];
}

/**
 * Home (docs/guides/kharcha.md "Home"): the caller's to-dos, totals, this month against
 * last and recent activity, in one read. To-dos arrive with their routes (PLAN 14.3):
 * receipts and possible duplicates in Task 89.
 */
export async function getHome(services: KharchaServices): Promise<KharchaHome> {
	const { db, user } = services;
	const me = await resolveMe(db, user);
	const [profile] = await db.select().from(khProfile).where(eq(khProfile.userId, user.id));
	if (!profile) throw notFound("Profile");

	const pairs = await pairBalances(db, me.personId);
	const owed = new Map<string, number>();
	const owe = new Map<string, number>();
	const open = new Set<string>();
	for (const pair of pairs) {
		if (pair.amountMinor === 0) continue;
		open.add(pair.personId);
		const side = pair.amountMinor > 0 ? owed : owe;
		side.set(pair.currency, (side.get(pair.currency) ?? 0) + Math.abs(pair.amountMinor));
	}
	const amounts = (side: Map<string, number>): Amount[] =>
		[...side].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort(byCurrency);

	const today = todayInZone(profile.timeZone);
	const current = today.slice(0, 7);
	const previous = addMonths(current, -1);

	// Debts to settle (Task 91): each friend the caller owes, in all, per currency.
	const owing = new Map<string, Amount[]>();
	for (const pair of pairs) {
		if (pair.amountMinor >= 0) continue;
		owing.set(pair.personId, [
			...(owing.get(pair.personId) ?? []),
			{ currency: pair.currency, amountMinor: -pair.amountMinor },
		]);
	}
	const owingIds = [...owing.keys()].slice(0, SETTLE_LIMIT);
	const settle = (await loadPeople(db, me.personId, owingIds)).map(
		(person): HomeTodo => ({ kind: "settle", person, owe: (owing.get(person.id) ?? []).sort(byCurrency) }),
	);
	const todos = await todosOf(services, me, today);
	const receipts = todos.filter((todo) => todo.kind === "receipt");
	const others = todos.filter((todo) => todo.kind !== "receipt");

	return {
		todos: [...receipts, ...settle, ...others],
		balances: { owed: amounts(owed), owe: amounts(owe) },
		openWith: open.size,
		month: { current, previous, spent: await monthSpending(db, me.personId, current, previous) },
		recent: await recentActivity(db, me.personId),
		updates: await updatesOf(db, me.id),
		unread: await unreadCount(db, me.id),
	};
}

/**
 * The caller's spending in two months, per currency (PLAN 14.5 "Money"): their share of
 * each expense outside the trash, a refund counting against it. Payments are never spending.
 */
async function monthSpending(
	db: KharchaServices["db"],
	personId: string,
	current: string,
	previous: string,
): Promise<KharchaHome["month"]["spent"]> {
	const { first } = monthDays(previous);
	const { last } = monthDays(current);
	const signed = sql<number>`case when ${khExpense.kind} = 'refund' then -${khExpenseShare.owedMinor} else ${khExpenseShare.owedMinor} end`;
	const rows = await db
		.select({
			currency: khExpense.currency,
			month: sql<string>`to_char(${khExpense.spentOn}, 'YYYY-MM')`,
			total: sql<string>`sum(${signed})`,
		})
		.from(khExpenseShare)
		.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
		.where(
			and(
				eq(khExpenseShare.personId, personId),
				isNull(khExpense.deletedAt),
				gte(khExpense.spentOn, first),
				lte(khExpense.spentOn, last),
			),
		)
		.groupBy(khExpense.currency, sql`to_char(${khExpense.spentOn}, 'YYYY-MM')`);
	const byCode = new Map<string, { currency: string; current: number; previous: number }>();
	for (const row of rows) {
		const entry = byCode.get(row.currency) ?? { currency: row.currency, current: 0, previous: 0 };
		entry[row.month === current ? "current" : "previous"] += Number(row.total);
		byCode.set(row.currency, entry);
	}
	return [...byCode.values()].filter((entry) => entry.current !== 0 || entry.previous !== 0).sort(byCurrency);
}

/**
 * What happened lately that the caller may see (the access table in the guide): their
 * groups' threads (a former member's up to when they left), the threads of two people they
 * are one of, and what they did themselves. An edit writes a row per field; it is one line here.
 */
async function recentActivity(db: KharchaServices["db"], personId: string): Promise<HomeActivity[]> {
	const memberships = db
		.select({ groupId: khGroupMember.groupId })
		.from(khGroupMember)
		.where(
			and(
				eq(khGroupMember.personId, personId),
				or(isNull(khGroupMember.leftAt), sql`${khActivity.at} <= ${khGroupMember.leftAt}`),
				eq(khGroupMember.groupId, khActivity.groupId),
			),
		);
	const visible: SQL | undefined = or(
		sql`exists (${memberships})`,
		eq(khActivity.personLo, personId),
		eq(khActivity.personHi, personId),
		and(isNull(khActivity.groupId), eq(khActivity.actorId, personId)),
	);
	return activityLines(db, personId, visible, RECENT_LIMIT);
}
