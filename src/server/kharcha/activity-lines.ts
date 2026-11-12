import "@tanstack/react-start/server-only";
import { desc, eq, type SQL } from "drizzle-orm";
import type { HomeActivity } from "@/features/kharcha/types";
import { khActivity, khExpense, khGroup, khPayment } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { loadPeople } from "./people";

/**
 * History as people read it (docs/guides/kharcha.md "Server patterns"): the rows of
 * `kh_activity` matching `where`, newest first, an edit's rows (one per field, written at
 * one instant) folded into one line, at most `limit` lines; people as the caller names
 * them. Home's "Recent" and the threads' system lines read through it.
 */
export async function activityLines(
	db: Db | Tx,
	meId: string,
	where: SQL | undefined,
	limit: number,
): Promise<HomeActivity[]> {
	const rows = await db
		.select({
			id: khActivity.id,
			kind: khActivity.kind,
			at: khActivity.at,
			actorId: khActivity.actorId,
			subjectId: khActivity.subjectId,
			expenseId: khActivity.expenseId,
			paymentId: khActivity.paymentId,
			data: khActivity.data,
			expenseTitle: khExpense.title,
			expenseMerchant: khExpense.merchant,
			groupName: khGroup.name,
			payment: {
				fromId: khPayment.fromPerson,
				toId: khPayment.toPerson,
				amountMinor: khPayment.amountMinor,
				currency: khPayment.currency,
			},
		})
		.from(khActivity)
		.leftJoin(khExpense, eq(khExpense.id, khActivity.expenseId))
		.leftJoin(khGroup, eq(khGroup.id, khActivity.groupId))
		.leftJoin(khPayment, eq(khPayment.id, khActivity.paymentId))
		.where(where)
		.orderBy(desc(khActivity.at), desc(khActivity.id))
		// An edit's rows share their instant: read enough to fold them and still fill the list.
		.limit(limit * 4);

	const lines: typeof rows = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const key = `${row.kind}|${row.expenseId ?? row.paymentId ?? row.subjectId ?? ""}|${row.actorId}|${row.at.getTime()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		lines.push(row);
		if (lines.length === limit) break;
	}

	const ids = lines.flatMap((row) => [
		row.actorId,
		row.subjectId,
		row.payment?.fromId ?? null,
		row.payment?.toId ?? null,
	]);
	const people = new Map(
		(
			await loadPeople(
				db,
				meId,
				ids.filter((id): id is string => id !== null),
			)
		).map((person) => [person.id, person]),
	);
	const person = (id: string | null | undefined) => (id ? (people.get(id) ?? null) : null);
	return lines.map(
		(row): HomeActivity => ({
			id: row.id,
			kind: row.kind,
			at: row.at.toISOString(),
			actor: person(row.actorId),
			subject: person(row.subjectId),
			title: row.expenseTitle || row.expenseMerchant || row.data.title || "",
			group: row.groupName,
			payment:
				row.payment?.fromId && row.payment.currency
					? {
							from: person(row.payment.fromId),
							to: person(row.payment.toId),
							amount: { currency: row.payment.currency, amountMinor: Number(row.payment.amountMinor) },
						}
					: null,
		}),
	);
}
