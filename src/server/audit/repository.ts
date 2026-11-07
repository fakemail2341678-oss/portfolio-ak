import "@tanstack/react-start/server-only";
import { count, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type AuditEventItem, type AuditPage, auditEventItem } from "@/features/audit/schema";
import type { AuditListInput } from "@/features/audit/search";
import { allOf, dateRange, orderBySort, paginate, textSearch } from "@/server/db/list";
import { auditEvent, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** The audit log list (/admin/audit). Rows are only ever inserted (./record.ts), never changed. */

const SORT_COLUMNS = { time: auditEvent.createdAt };

const impersonator = alias(user, "impersonator");

export async function listAuditEvents(db: Db, input: AuditListInput): Promise<AuditPage> {
	const where = allOf(
		textSearch(input.q, [auditEvent.targetLabel, auditEvent.targetId, auditEvent.requestId]),
		// The actor's current name and email, or the email kept on the row (deleted accounts).
		textSearch(input.actor, [user.name, user.email, auditEvent.actorLabel]),
		input.action === "all" ? undefined : eq(auditEvent.action, input.action),
		input.target === "all" ? undefined : eq(auditEvent.targetType, input.target),
		dateRange(auditEvent.createdAt, input.from, input.to),
	);
	const order = orderBySort(input.sort, SORT_COLUMNS, { tiebreaker: auditEvent.id, fallback: "time" });
	return paginate(
		input,
		{
			count: async () => {
				const [row] = await db
					.select({ total: count() })
					.from(auditEvent)
					.leftJoin(user, eq(user.id, auditEvent.actorId))
					.where(where);
				return row?.total ?? 0;
			},
			rows: ({ limit, offset }) =>
				db
					.select({
						event: auditEvent,
						actorName: user.name,
						actorEmail: user.email,
						impersonatorEmail: impersonator.email,
					})
					.from(auditEvent)
					.leftJoin(user, eq(user.id, auditEvent.actorId))
					.leftJoin(impersonator, eq(impersonator.id, auditEvent.impersonatorId))
					.where(where)
					.orderBy(...order)
					.limit(limit)
					.offset(offset),
		},
		({ event, actorName, actorEmail, impersonatorEmail }): AuditEventItem =>
			// Actions and targets are written only by recordAudit, which takes catalogued values.
			auditEventItem.parse({
				...event,
				actor: { id: event.actorId, name: actorName ?? "", email: actorEmail ?? event.actorLabel },
				impersonator: event.impersonatorId ? (impersonatorEmail ?? event.impersonatorId) : null,
				target: { type: event.targetType, id: event.targetId, label: event.targetLabel },
			}),
	);
}
