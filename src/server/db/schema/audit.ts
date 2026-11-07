import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AuditValues } from "@/features/audit/schema";
import { user } from "./auth";

/**
 * The audit log (docs/decisions.md 0132): one row per admin action, written by
 * the service in the same transaction as the change, so a change and its row
 * commit or roll back together.
 *
 * - `actorId` is who acted (null once that account is deleted; `actorLabel` keeps
 *   their email from the time). `impersonatorId` is the admin behind an
 *   impersonated session.
 * - `targetLabel` is the target's name or title at the time (it may be gone since).
 * - `before` / `after`: a short summary of the fields the action changed.
 * - `requestId` matches the response's x-request-id, the log lines and Sentry (0123).
 */
export const auditEvent = pgTable(
	"audit_event",
	{
		id: uuid().primaryKey().defaultRandom(),
		actorId: text().references(() => user.id, { onDelete: "set null" }),
		actorLabel: text().notNull().default(""),
		impersonatorId: text(),
		action: text().notNull(),
		targetType: text().notNull(),
		targetId: text().notNull(),
		targetLabel: text().notNull().default(""),
		before: jsonb().$type<AuditValues>(),
		after: jsonb().$type<AuditValues>(),
		requestId: text(),
		ip: text(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("audit_event_created_idx").on(table.createdAt.desc(), table.id),
		index("audit_event_actor_idx").on(table.actorId),
		index("audit_event_target_idx").on(table.targetType, table.targetId),
	],
);
