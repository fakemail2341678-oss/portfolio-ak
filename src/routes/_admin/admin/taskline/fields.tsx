import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineFieldsPage } from "@/features/taskline/admin/fields/fields-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/fields: the team workspace's custom fields (Task 55, taskline:configure). */
export const Route = createFileRoute("/_admin/admin/taskline/fields")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminFieldsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminFieldsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_fields_title) },
	head: titleHead(m.taskline_admin_fields_title),
	component: TasklineFieldsPage,
});
