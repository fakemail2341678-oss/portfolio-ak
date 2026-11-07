import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "./types";

/**
 * Serializes the quota checks of one scope (an owner, a form, a workspace) until the
 * transaction ends: a count followed by an insert is only a limit when two requests
 * can't both count before either inserts. Call it in the transaction, before the
 * count. A transaction-scoped advisory lock, so there's no row to lock and nothing
 * to release (decisions 0199, 0206).
 */
export async function lockQuota(tx: Tx, scope: string): Promise<void> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope}, 0))`);
}
