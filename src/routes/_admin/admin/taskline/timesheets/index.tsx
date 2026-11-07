import { createFileRoute } from "@tanstack/react-router";
import { adminTimeList, TL_ADMIN_TIME_TABLE_ID } from "@/features/taskline/admin/search";
import { AdminTimeList } from "@/features/taskline/admin/time/time-list";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/timesheets: every time entry of the team (Task 53). */
export const Route = createFileRoute("/_admin/admin/taskline/timesheets/")({
	...listSearch(adminTimeList.search, adminTimeList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminTimeListQueryOptions, timeOptionsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(route.context.queryClient, timeOptionsQueryOptions());
		return listLoader(route, { tableId: TL_ADMIN_TIME_TABLE_ID, query: adminTimeListQueryOptions });
	},
	head: titleHead(m.taskline_admin_timesheets_title),
	component: AdminTimeList,
});
