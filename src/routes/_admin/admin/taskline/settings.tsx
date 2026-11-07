import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TasklineSettingsPage } from "@/features/taskline/admin/settings/settings-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/settings: the team workspace's settings (taskline:configure). */
export const Route = createFileRoute("/_admin/admin/taskline/settings")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminWorkspaceQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, adminWorkspaceQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_settings_title) },
	head: titleHead(m.taskline_admin_settings_title),
	component: TasklineSettingsPage,
});
