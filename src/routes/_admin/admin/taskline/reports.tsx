import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineReportsPage } from "@/features/taskline/admin/reports/reports-page";
import { adminReportsSearch } from "@/features/taskline/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/reports: health, workload and time across the team (Task 57, taskline:read). */
export const Route = createFileRoute("/_admin/admin/taskline/reports")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:read"),
	validateSearch: adminReportsSearch,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminReportsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminReportsQueryOptions(deps.range));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_reports_title) },
	head: titleHead(m.taskline_admin_reports_title),
	component: TasklineReportsPage,
});
