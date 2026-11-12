import "@tanstack/react-start/server-only";
import { type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { type KharchaQuotas, type KharchaSettings, kharchaSettings } from "@/features/kharcha/settings";
import { ruleError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { lockQuota } from "@/server/db/quota";
import { khSettings } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * Kharcha's settings on the server (docs/guides/kharcha.md "Settings and quotas"): the one
 * row, parsed with the defaults in code. A missing row is the defaults.
 */
export async function getSettings(db: Db | Tx): Promise<KharchaSettings> {
	const [row] = await db.select({ settings: khSettings.settings }).from(khSettings);
	return kharchaSettings.parse(row?.settings ?? {});
}

/** The limits that apply to the caller: a guest's are smaller. */
export const quotasFor = (settings: KharchaSettings, user: { isGuest: boolean }): KharchaQuotas =>
	user.isGuest ? settings.guestQuotas : settings.quotas;

export const quotaError = (scope: string, max: number) =>
	ruleError("FORBIDDEN", `Kharcha quota reached: ${scope}`, m.kharcha_error_quota({ max: formatNumber(max) }));

/**
 * Refuses a create once `scope` holds `max` rows. The count and the insert that follows
 * can't be raced: `lockQuota` holds the scope until the transaction ends (decision 0199).
 */
export async function assertQuota(
	tx: Tx,
	scope: string,
	{ table, where, max, adding = 1 }: { table: PgTable; where: SQL | undefined; max: number; adding?: number },
): Promise<void> {
	await lockQuota(tx, `kharcha:${scope}`);
	const [row] = await tx
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(table)
		.where(where);
	if ((row?.count ?? 0) + adding > max) throw quotaError(scope, max);
}
