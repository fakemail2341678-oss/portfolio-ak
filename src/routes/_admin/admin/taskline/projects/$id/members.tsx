import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectMembers } from "@/features/taskline/admin/projects/project-tabs";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/projects/$id/members: who is on the project, and their roles. */
export const Route = createFileRoute("/_admin/admin/taskline/projects/$id/members")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { memberOptionsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, memberOptionsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_tab_members) },
	component: AdminProjectMembers,
});
