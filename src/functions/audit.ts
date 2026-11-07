import { createServerFn } from "@tanstack/react-start";
import type { AuditPage } from "@/features/audit/schema";
import { auditList } from "@/features/audit/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as audit from "@/server/audit/service";

/** The audit log (read only: rows are written by the services, decisions.md 0132). */
export const listAuditEvents = createServerFn({ method: "GET" })
	.middleware([requirePermission("audit:read"), withServices])
	.validator(zodInput(auditList.input))
	.handler(({ data, context }): Promise<AuditPage> => audit.list(context, data));
