import "@tanstack/react-start/server-only";
import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { TRASH_DAYS } from "@/features/kharcha/types";
import { removeForEntities } from "@/server/attachments/repository";
import { khExpense, khInvite, khPayment } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";
import { sendDigests } from "./notify/deliver";
import { pruneRead } from "./notify/inbox";
import { EXPENSE_RECEIPTS } from "./receipts/service";

/**
 * `GET /api/cron/kharcha` (PLAN 14.5, decision 0286), daily at 01:30 UTC (07:15 in
 * Kathmandu). Each step is idempotent and runs on its own: one failing doesn't stop the
 * others, and running the whole job twice changes nothing the second time.
 *
 * 1. The digests: each person's notifications not yet emailed.
 * 2. Purging the trash: expenses and payments deleted more than 30 days ago (receipts go
 *    to the attachments' own clean-up).
 * 3. Expiring invites: open ones a month past their date go (a link past its date is
 *    refused when used; this only clears them away).
 * 4. Pruning read notifications older than 90 days.
 *
 * Recurring expenses, budget alerts (Task 94) and the admin's daily counts (Task 96) join it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_GRACE_DAYS = 30;

export type CronStep = { ok: boolean; [detail: string]: unknown };
export type KharchaCronResult = Record<"digests" | "trash" | "invites" | "notifications", CronStep>;

/** Expenses and payments in the trash past `TRASH_DAYS`, gone for good. */
export async function purgeTrash(db: Db, now = new Date()): Promise<{ expenses: number; payments: number }> {
	const before = new Date(now.getTime() - TRASH_DAYS * DAY_MS);
	return db.transaction(async (tx) => {
		const expenses = await tx
			.select({ id: khExpense.id })
			.from(khExpense)
			.where(and(isNotNull(khExpense.deletedAt), lt(khExpense.deletedAt, before)));
		const ids = expenses.map((row) => row.id);
		if (ids.length > 0) {
			await removeForEntities(tx, EXPENSE_RECEIPTS, ids, now);
			await tx.delete(khExpense).where(inArray(khExpense.id, ids));
		}
		const payments = await tx
			.delete(khPayment)
			.where(and(isNotNull(khPayment.deletedAt), lt(khPayment.deletedAt, before)))
			.returning({ id: khPayment.id });
		return { expenses: ids.length, payments: payments.length };
	});
}

/** Open invites a month past their date. */
export async function expireInvites(db: Db, now = new Date()): Promise<number> {
	const rows = await db
		.delete(khInvite)
		.where(
			and(isNull(khInvite.acceptedAt), lt(khInvite.expiresAt, new Date(now.getTime() - INVITE_GRACE_DAYS * DAY_MS))),
		)
		.returning({ id: khInvite.id });
	return rows.length;
}

async function step(name: string, run: () => Promise<Record<string, unknown>>): Promise<CronStep> {
	try {
		return { ok: true, ...(await run()) };
	} catch (error) {
		log("error", `kharcha daily job: ${name} failed`, errorFields(error));
		return { ok: false };
	}
}

export async function runKharchaCron(
	db: Db,
	{ provider, now = new Date() }: { provider?: EmailProvider; now?: Date } = {},
): Promise<KharchaCronResult> {
	return {
		digests: await step("digests", async () => ({
			...(await sendDigests(db, { ...(provider ? { provider } : {}), now })),
		})),
		trash: await step("trash", async () => ({ ...(await purgeTrash(db, now)) })),
		invites: await step("invites", async () => ({ expired: await expireInvites(db, now) })),
		notifications: await step("notifications", async () => ({ pruned: await pruneRead(db, now) })),
	};
}
