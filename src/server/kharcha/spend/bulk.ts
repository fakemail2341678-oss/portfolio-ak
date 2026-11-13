import "@tanstack/react-start/server-only";
import { type AnyColumn, and, count, eq, inArray, type SQL, sql } from "drizzle-orm";
import { type BulkInput, TAGS_MAX } from "@/features/kharcha/schema";
import type { BulkResult } from "@/features/kharcha/types";
import { AppError } from "@/lib/errors";
import { khExpensePayer, khExpenseShare, khShareTag } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";
import { type KharchaServices, type Me, resolveExpense, resolveMe } from "../access";
import { trashInTx } from "../expenses/service";
import * as lists from "../lists/repository";
import { deliverAfter } from "../notify/produce";
import { bumpRevs } from "../rev";

/**
 * Spend's bulk actions (Task 93): on up to a page of the caller's expenses at once, in one
 * transaction. Categorizing, tagging and the method change the caller's own part, as the
 * dialog does; deleting is the trash's own change (`trashInTx`: the ledger, the history,
 * who is told). A row the caller can't see, isn't on, or that is already so is skipped and
 * counted; a category, tag or method that isn't theirs refuses the whole action.
 */

type Access = Awaited<ReturnType<typeof resolveExpense>>;

const differs = (column: AnyColumn, value: string | null): SQL => sql`${column} is distinct from ${value}`;

/** The expense if the caller may see it, else null (another's is skipped, not an error). */
async function seen(tx: Tx, me: Me, id: string, now: Date): Promise<Access | null> {
	try {
		return await resolveExpense(tx, me, id, now);
	} catch (error) {
		if (error instanceof AppError && error.code === "NOT_FOUND") return null;
		throw error;
	}
}

async function ownPart(tx: Tx, me: Me, access: Access, action: BulkInput["action"]): Promise<boolean> {
	if (access.expense.deletedAt) return false;
	const expenseId = access.expense.id;
	const share = and(eq(khExpenseShare.expenseId, expenseId), eq(khExpenseShare.personId, me.personId));
	switch (action.kind) {
		case "category": {
			const rows = await tx
				.update(khExpenseShare)
				.set({ categoryId: action.categoryId })
				.where(and(share, differs(khExpenseShare.categoryId, action.categoryId)))
				.returning({ id: khExpenseShare.expenseId });
			return rows.length > 0;
		}
		case "method": {
			const rows = await tx
				.update(khExpensePayer)
				.set({ methodId: action.methodId })
				.where(
					and(
						eq(khExpensePayer.expenseId, expenseId),
						eq(khExpensePayer.personId, me.personId),
						differs(khExpensePayer.methodId, action.methodId),
					),
				)
				.returning({ id: khExpensePayer.expenseId });
			return rows.length > 0;
		}
		case "tags": {
			const [mine] = await tx.select({ id: khExpenseShare.expenseId }).from(khExpenseShare).where(share);
			if (!mine) return false;
			const added = await tx
				.insert(khShareTag)
				.values(action.tagIds.map((tagId) => ({ expenseId, personId: me.personId, tagId })))
				.onConflictDoNothing()
				.returning({ id: khShareTag.tagId });
			if (added.length === 0) return false;
			const [tags] = await tx
				.select({ count: count() })
				.from(khShareTag)
				.where(and(eq(khShareTag.expenseId, expenseId), eq(khShareTag.personId, me.personId)));
			if ((tags?.count ?? 0) > TAGS_MAX) {
				// Over the limit: this row keeps the tags it had.
				await tx.delete(khShareTag).where(
					and(
						eq(khShareTag.expenseId, expenseId),
						eq(khShareTag.personId, me.personId),
						inArray(
							khShareTag.tagId,
							added.map((row) => row.id),
						),
					),
				);
				return false;
			}
			return true;
		}
		case "delete":
			return false;
	}
}

export async function bulkExpenses(services: KharchaServices, input: BulkInput, now = new Date()): Promise<BulkResult> {
	const { db, user, deliver } = services;
	const { result, instant } = await db.transaction(async (tx) => {
		const me = await resolveMe(tx, user);
		const { action } = input;
		if (action.kind === "category" && action.categoryId) await lists.ownCategory(tx, me.personId, action.categoryId);
		if (action.kind === "method" && action.methodId) await lists.ownMethod(tx, me.personId, action.methodId);
		if (action.kind === "tags") await lists.ownTags(tx, me.personId, action.tagIds);
		const result: BulkResult = { changed: 0, skipped: 0 };
		const instant: string[] = [];
		for (const id of new Set(input.ids)) {
			const access = await seen(tx, me, id, now);
			let done = false;
			if (access && action.kind === "delete") {
				if (access.can.delete && !access.expense.deletedAt) {
					instant.push(...(await trashInTx(tx, me, access, true, now)).instant);
					done = true;
				}
			} else if (access) {
				done = await ownPart(tx, me, access, action);
			}
			if (done) result.changed += 1;
			else result.skipped += 1;
		}
		if (action.kind !== "delete" && result.changed > 0) await bumpRevs(tx, [me.personId]);
		return { result, instant };
	});
	deliverAfter(deliver, instant);
	return result;
}
