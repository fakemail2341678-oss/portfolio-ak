import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineTemplatesPage } from "@/features/taskline/admin/templates/templates-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/templates: the team's project templates beside the built-ins (Task 57, taskline:configure). */
export const Route = createFileRoute("/_admin/admin/taskline/templates")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminTemplatesQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminTemplatesQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_templates_title) },
	head: titleHead(m.taskline_admin_templates_title),
	component: TasklineTemplatesPage,
});
