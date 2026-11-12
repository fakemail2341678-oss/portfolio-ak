import "@tanstack/react-start/server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Debt } from "@/features/kharcha/money/ledger";
import { type KharchaSettings, offeredCurrencies } from "@/features/kharcha/settings";
import type { Amount } from "@/features/kharcha/types";
import { ruleError } from "@/lib/errors";
import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import { khGroupMember } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { groupNets } from "./ledger";
import { befriend } from "./people";

/** Rules more than one Kharcha service applies (docs/guides/kharcha.md "Server patterns"). */

/** A new expense, payment or group must be in a currency the admin offers; what exists keeps its own. */
export function assertCurrencyOffered(settings: KharchaSettings, currency: string): void {
	if (!offeredCurrencies(settings).includes(currency)) {
		throw ruleError("BAD_REQUEST", `Kharcha: currency not offered: ${currency}`, m.kharcha_error_currency());
	}
}

/** A group's current members. */
export async function currentMemberIds(db: Db | Tx, groupId: string): Promise<string[]> {
	const rows = await db
		.select({ id: khGroupMember.personId })
		.from(khGroupMember)
		.where(and(eq(khGroupMember.groupId, groupId), isNull(khGroupMember.leftAt)));
	return rows.map((row) => row.id);
}

/** Everyone a change touches: the people it names, and the group's members when it is in one. */
export async function touched(tx: Tx, groupId: string | null, people: Iterable<string>): Promise<string[]> {
	return [...new Set([...people, ...(groupId ? await currentMemberIds(tx, groupId) : [])])];
}

/** The first debt between two people makes them friends, both ways. */
export const befriendDebtors = (tx: Tx, debts: ReadonlyArray<Debt>) =>
	befriend(
		tx,
		debts.map((debt) => [debt.debtor, debt.creditor] as const),
	);

/** "NPR 500.00, $12.00": amounts of several currencies in one sentence. */
export const amountList = (amounts: ReadonlyArray<Amount>): string =>
	amounts.map((amount) => formatMoney(Math.abs(amount.amountMinor), amount.currency)).join(", ");

/**
 * Someone who left a group stays at zero in it: a change to an old expense or payment that
 * would leave a former member owing or owed is refused (add them back first).
 */
export async function assertFormerSettled(tx: Tx, groupId: string): Promise<void> {
	const former = await tx
		.select({ id: khGroupMember.personId })
		.from(khGroupMember)
		.where(and(eq(khGroupMember.groupId, groupId), isNotNull(khGroupMember.leftAt)));
	if (former.length === 0) return;
	const gone = new Set(former.map((row) => row.id));
	const nets = await groupNets(tx, groupId);
	if (nets.some((net) => gone.has(net.personId))) {
		throw ruleError("FORBIDDEN", "Kharcha: a former member would owe again", m.kharcha_error_former_member());
	}
}
