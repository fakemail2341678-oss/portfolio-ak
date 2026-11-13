import "@tanstack/react-start/server-only";
import { type AnyColumn, and, eq, isNull, lte, sql } from "drizzle-orm";
import type { CategoryChip, GroupTotals } from "@/features/kharcha/types";
import { khCategory, khExpense, khExpensePayer, khExpenseShare } from "@/server/db/schema";
import { type KharchaServices, resolveGroup, resolveMe } from "../access";
import { byCurrency } from "../ledger";
import { loadPeople } from "../people";

/**
 * A group's Totals tab (Task 91, docs/guides/kharcha.md "Balances and settling up"): per
 * currency, what the group spent, what each member paid and their share, and the caller's
 * own share by their own category. A refund counts against each; payments are never
 * spending (PLAN 14.5 "Money"). A former member's totals stop when they left, as their thread.
 */
export async function getGroupTotals({ db, user }: KharchaServices, groupId: string): Promise<GroupTotals> {
	return db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const access = await resolveGroup(tx, me, groupId);
		const until = access.current ? null : access.member.leftAt;
		const inGroup = and(
			eq(khExpense.groupId, groupId),
			isNull(khExpense.deletedAt),
			until ? lte(khExpense.createdAt, until) : undefined,
		);
		const sign = (column: AnyColumn) =>
			sql<number>`sum(case when ${khExpense.kind} = 'refund' then -${column} else ${column} end)`.mapWith(Number);

		const spent = await tx
			.select({ currency: khExpense.currency, amount: sign(khExpense.amountMinor) })
			.from(khExpense)
			.where(inGroup)
			.groupBy(khExpense.currency);
		const paid = await tx
			.select({
				currency: khExpense.currency,
				personId: khExpensePayer.personId,
				amount: sign(khExpensePayer.amountMinor),
			})
			.from(khExpensePayer)
			.innerJoin(khExpense, eq(khExpense.id, khExpensePayer.expenseId))
			.where(inGroup)
			.groupBy(khExpense.currency, khExpensePayer.personId);
		const shares = await tx
			.select({
				currency: khExpense.currency,
				personId: khExpenseShare.personId,
				amount: sign(khExpenseShare.owedMinor),
			})
			.from(khExpenseShare)
			.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
			.where(inGroup)
			.groupBy(khExpense.currency, khExpenseShare.personId);
		const mine = await tx
			.select({
				currency: khExpense.currency,
				id: khCategory.id,
				name: khCategory.name,
				icon: khCategory.icon,
				color: khCategory.color,
				amount: sign(khExpenseShare.owedMinor),
			})
			.from(khExpenseShare)
			.innerJoin(khExpense, eq(khExpense.id, khExpenseShare.expenseId))
			.leftJoin(khCategory, eq(khCategory.id, khExpenseShare.categoryId))
			.where(and(inGroup, eq(khExpenseShare.personId, me.personId)))
			.groupBy(khExpense.currency, khCategory.id, khCategory.name, khCategory.icon, khCategory.color);

		const personIds = [...new Set([...paid, ...shares].map((row) => row.personId))];
		const people = await loadPeople(tx, me.personId, personIds);
		const order = new Map(people.map((person, index) => [person.id, index]));
		const currencies = spent.sort(byCurrency).map((row) => {
			const members = new Map<string, { personId: string; paidMinor: number; shareMinor: number }>();
			const entry = (personId: string) => {
				const found = members.get(personId) ?? { personId, paidMinor: 0, shareMinor: 0 };
				members.set(personId, found);
				return found;
			};
			for (const each of paid) if (each.currency === row.currency) entry(each.personId).paidMinor += each.amount;
			for (const each of shares) if (each.currency === row.currency) entry(each.personId).shareMinor += each.amount;
			return {
				currency: row.currency,
				spentMinor: row.amount,
				members: [...members.values()]
					.filter((member) => member.paidMinor !== 0 || member.shareMinor !== 0)
					.sort((a, b) => b.shareMinor - a.shareMinor || (order.get(a.personId) ?? 0) - (order.get(b.personId) ?? 0)),
				mine: mine
					.filter((each) => each.currency === row.currency && each.amount !== 0)
					.map((each) => ({
						category:
							each.id && each.name && each.icon && each.color
								? ({ id: each.id, name: each.name, icon: each.icon, color: each.color } satisfies CategoryChip)
								: null,
						shareMinor: each.amount,
					}))
					.sort((a, b) => b.shareMinor - a.shareMinor),
			};
		});
		return { currencies, people };
	});
}
