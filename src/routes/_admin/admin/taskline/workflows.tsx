import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineWorkflowsPage } from "@/features/taskline/admin/workflows/workflows-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/workflows: new projects' statuses, task types, workspace labels (taskline:configure). */
export const Route = createFileRoute("/_admin/admin/taskline/workflows")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminWorkflowsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminWorkflowsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_workflows_title) },
	head: titleHead(m.taskline_admin_workflows_title),
	component: TasklineWorkflowsPage,
});
