import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { NewAdminProjectPage } from "@/features/taskline/admin/projects/new-project-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/projects/new: a team project, with a lead the admin picks. */
export const Route = createFileRoute("/_admin/admin/taskline/projects/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:manage"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminTemplateChoicesQueryOptions, memberOptionsQueryOptions } = await import(
			"@/features/taskline/admin/queries"
		);
		await Promise.all([
			ensureQuery(context.queryClient, memberOptionsQueryOptions()),
			ensureQuery(context.queryClient, adminTemplateChoicesQueryOptions()),
		]);
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_project_new) },
	head: titleHead(m.taskline_project_new),
	component: NewAdminProjectPage,
});
