import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineAutomationsPage } from "@/features/taskline/admin/automations/automations-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/automations: the team workspace's automations and the team's run log (Task 56, taskline:configure). */
export const Route = createFileRoute("/_admin/admin/taskline/automations")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminAutomationsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminAutomationsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_automations_title) },
	head: titleHead(m.taskline_admin_automations_title),
	component: TasklineAutomationsPage,
});
