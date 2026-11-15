import type { AuditEventItem } from "@/features/audit/schema";

/** What the admin dashboard shows (src/server/admin/dashboard.ts builds it). */

/** "Recent" on the dashboard: created in the last 7 days. */
export const DASHBOARD_RECENT_DAYS = 7;
/** How many audit events the dashboard lists. */
export const DASHBOARD_ACTIVITY_SIZE = 10;

/**
 * Each part is null when the user may not read that section (its read permission),
 * so the browser never receives numbers it couldn't open.
 */
export type Dashboard = {
	testCrud: { total: number; published: number; draft: number; recent: number } | null;
	users: { total: number; banned: number; recent: number } | null;
	roles: { total: number } | null;
	activity: AuditEventItem[] | null;
	/** When it was read (ISO): the "now" of relative times, the same on the server and in the browser. */
	generatedAt: string;
};
