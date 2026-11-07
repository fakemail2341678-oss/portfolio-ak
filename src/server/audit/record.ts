import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import type { AuditAction, AuditTarget, AuditValue, AuditValues } from "@/features/audit/schema";
import type { Actor } from "@/features/rbac/types";
import { auditEvent, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { currentRequestId } from "@/server/http/request-scope";

/**
 * Writes audit rows (docs/decisions.md 0132). Services report them through
 * `withAudit` (src/server/db/crud.ts), which runs the change and writes its rows
 * in the same transaction, so both commit or neither does.
 */

/**
 * Who acted, and where from: the actor's id, the admin behind an impersonated
 * session, the request id (defaults to the current request's) and the client IP.
 * Server functions pass `context.actor` (src/middleware/services.ts); tests pass `{ id }`.
 */
export type AuditActor = Pick<Actor, "id" | "impersonatorId" | "requestId" | "ip">;

export type AuditEntry = {
	action: AuditAction;
	target: { type: AuditTarget; id: string; label?: string };
	before?: AuditValues | null;
	after?: AuditValues | null;
};

/** Writes the rows; returns their ids. */
export async function recordAudit(
	db: Db,
	actor: AuditActor,
	entries: AuditEntry | ReadonlyArray<AuditEntry>,
): Promise<string[]> {
	const list = Array.isArray(entries) ? entries : [entries as AuditEntry];
	if (list.length === 0) return [];
	// The email is kept on the row, so the log still names the actor after their account is deleted.
	const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, actor.id));
	const requestId = actor.requestId ?? currentRequestId() ?? null;
	const rows = await db
		.insert(auditEvent)
		.values(
			list.map((entry) => ({
				actorId: account ? actor.id : null,
				actorLabel: account?.email ?? actor.id,
				impersonatorId: actor.impersonatorId ?? null,
				action: entry.action,
				targetType: entry.target.type,
				targetId: entry.target.id,
				targetLabel: entry.target.label ?? "",
				before: entry.before ?? null,
				after: entry.after ?? null,
				requestId,
				ip: actor.ip ?? null,
			})),
		)
		.returning({ id: auditEvent.id });
	return rows.map((row) => row.id);
}

/**
 * The summary of an edit: the fields among `keys` whose value changed, before and
 * after (lists compared by value). Null when none did, so an unchanged save writes
 * no row. Long fields (a body, image ids) count as a change but aren't copied into
 * the row: list them in `keys` and leave them out of `recorded`.
 */
export function changes<K extends string>(
	before: Readonly<Record<K, AuditValue>>,
	after: Readonly<Record<K, AuditValue>>,
	keys: ReadonlyArray<K>,
	recorded: ReadonlyArray<K> = keys,
): { before: AuditValues; after: AuditValues } | null {
	const changed = keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
	if (changed.length === 0) return null;
	const shown = changed.filter((key) => recorded.includes(key));
	return {
		before: Object.fromEntries(shown.map((key) => [key, before[key] ?? null])),
		after: Object.fromEntries(shown.map((key) => [key, after[key] ?? null])),
	};
}
