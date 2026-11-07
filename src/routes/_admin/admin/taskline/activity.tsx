import { createFileRoute } from "@tanstack/react-router";
import { TasklineActivityPage } from "@/features/taskline/admin/activity/activity-page";
import { adminActivityList, TL_ADMIN_ACTIVITY_TABLE_ID } from "@/features/taskline/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/activity: the team's history. */
export const Route = createFileRoute("/_admin/admin/taskline/activity")({
	...listSearch(adminActivityList.search, adminActivityList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { activityOptionsQueryOptions, adminActivityQueryOptions } = await import(
			"@/features/taskline/admin/queries"
		);
		await ensureQuery(route.context.queryClient, activityOptionsQueryOptions());
		return listLoader(route, { tableId: TL_ADMIN_ACTIVITY_TABLE_ID, query: adminActivityQueryOptions });
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_activity_title) },
	head: titleHead(m.taskline_admin_activity_title),
	component: TasklineActivityPage,
});
