import "@tanstack/react-start/server-only";
import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { TRASH_DAYS } from "@/features/kharcha/types";
import { removeForEntities } from "@/server/attachments/repository";
import { khExpense, khInvite, khPayment } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { EmailProvider } from "@/server/email/types";
import { errorFields, log } from "@/server/log";
import { rollupDaily } from "./admin/daily";
import { sendBudgetAlerts } from "./budgets/service";
import { deliverInstant, sendDigests } from "./notify/deliver";
import { pruneRead } from "./notify/inbox";
import { EXPENSE_RECEIPTS } from "./receipts/service";
import { makeDueRecurring } from "./recurring/service";

/**
 * `GET /api/cron/kharcha` (PLAN 14.5, decision 0286), daily at 01:30 UTC (07:15 in
 * Kathmandu). Each step is idempotent and runs on its own: one failing doesn't stop the
 * others, and running the whole job twice changes nothing the second time.
 *
 * 1. Recurring expenses due (Task 94): each occurrence missed by today in its owner's time
 *    zone, once (catch-up); one that can't be made is paused with the reason.
 * 2. Budget alerts (Task 94): 80% and 100% of a period, once each per period.
 * 3. The digests: each person's notifications not yet emailed (the two above included).
 * 4. Purging the trash: expenses and payments deleted more than 30 days ago (receipts go
 *    to the attachments' own clean-up).
 * 5. Expiring invites: open ones a month past their date go (a link past its date is
 *    refused when used; this only clears them away).
 * 6. Pruning read notifications older than 90 days.
 *
 * 0. The admin's daily counts (Task 96, decision 0290), first: the purges below take rows
 *    the day's counts still need.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_GRACE_DAYS = 30;

export type CronStep = { ok: boolean; [detail: string]: unknown };
export type KharchaCronResult = Record<
	"stats" | "recurring" | "budgets" | "digests" | "trash" | "invites" | "notifications",
	CronStep
>;

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
	const instantly = async (ids: string[]) => {
		if (ids.length > 0) await deliverInstant(db, ids, { ...(provider ? { provider } : {}), now });
	};
	return {
		stats: await step("stats", async () => ({ days: await rollupDaily(db, now) })),
		recurring: await step("recurring", async () => {
			const { instant, ...run } = await makeDueRecurring(db, now);
			await instantly(instant);
			return run;
		}),
		budgets: await step("budgets", async () => {
			const { instant, sent } = await sendBudgetAlerts(db, now);
			await instantly(instant);
			return { sent };
		}),
		digests: await step("digests", async () => ({
			...(await sendDigests(db, { ...(provider ? { provider } : {}), now })),
		})),
		trash: await step("trash", async () => ({ ...(await purgeTrash(db, now)) })),
		invites: await step("invites", async () => ({ expired: await expireInvites(db, now) })),
		notifications: await step("notifications", async () => ({ pruned: await pruneRead(db, now) })),
	};
}
