import "@tanstack/react-start/server-only";
import { count, eq, gte, type SQL, sql } from "drizzle-orm";
import { DASHBOARD_ACTIVITY_SIZE, DASHBOARD_RECENT_DAYS, type Dashboard } from "@/features/admin/dashboard";
import { auditList } from "@/features/audit/search";
import type { Permission } from "@/features/rbac/permissions";
import { listAuditEvents } from "@/server/audit/repository";
import { role, testCrud, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { isAccount } from "@/server/rbac/repository";

const DAY = 24 * 60 * 60 * 1000;

/** Count of all rows and of those matching `when` (one scan). */
const countWhere = (when: SQL) => sql<number>`count(*) filter (where ${when})`.mapWith(Number);

/**
 * The admin dashboard's numbers, only for the sections `permissions` may read (the
 * same read permissions the sections' own pages and server functions require). The
 * reads run in parallel. Users are accounts: guests are left out (decision 0185).
 */
export async function getDashboard(
	db: Db,
	permissions: ReadonlyArray<Permission>,
	now = new Date(),
): Promise<Dashboard> {
	const can = (permission: Permission) => permissions.includes(permission);
	const since = new Date(now.getTime() - DASHBOARD_RECENT_DAYS * DAY);

	const [testCrudTotals, userTotals, roleTotals, activity] = await Promise.all([
		can("test-crud:read")
			? db
					.select({
						total: count(),
						published: countWhere(eq(testCrud.status, "published")),
						recent: countWhere(gte(testCrud.createdAt, since)),
					})
					.from(testCrud)
					.then(([row]) => row)
			: null,
		can("users:read")
			? db
					.select({
						total: count(),
						banned: countWhere(eq(user.banned, true)),
						recent: countWhere(gte(user.createdAt, since)),
					})
					.from(user)
					.where(isAccount)
					.then(([row]) => row)
			: null,
		can("roles:read")
			? db
					.select({ total: count() })
					.from(role)
					.then(([row]) => row)
			: null,
		can("audit:read")
			? listAuditEvents(db, { ...auditList.defaults, page: 1, pageSize: DASHBOARD_ACTIVITY_SIZE }).then(
					(page) => page.items,
				)
			: null,
	]);

	return {
		testCrud: testCrudTotals ? { ...testCrudTotals, draft: testCrudTotals.total - testCrudTotals.published } : null,
		users: userTotals ?? null,
		roles: roleTotals ?? null,
		activity,
		generatedAt: now.toISOString(),
	};
}
