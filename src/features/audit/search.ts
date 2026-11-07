import type { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { dateParam, enumParam, searchParam } from "@/lib/list/params";
import { AUDIT_ACTIONS, AUDIT_TARGETS } from "./schema";

/** The URL contract of /admin/audit (route files import this, not ./schema.ts's DTO). */

export const AUDIT_TABLE_ID = "admin-audit";
export const AUDIT_ACTION_FILTERS = ["all", ...AUDIT_ACTIONS] as const;
export const AUDIT_TARGET_FILTERS = ["all", ...AUDIT_TARGETS] as const;

/**
 * Newest first. Filters: `q` (the target's name or id, or a request id), `actor`
 * (name or email), the action, the target type and the day range (app time zone).
 */
export const auditList = listSchema({
	sorts: ["-time", "time"],
	filters: {
		actor: searchParam(),
		action: enumParam(AUDIT_ACTION_FILTERS, "all"),
		target: enumParam(AUDIT_TARGET_FILTERS, "all"),
		from: dateParam(),
		to: dateParam(),
	},
});
export type AuditSearch = z.output<typeof auditList.search>;
export type AuditListInput = z.output<typeof auditList.input>;
