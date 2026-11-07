import { createFileRoute } from "@tanstack/react-router";
import { AdminMemberList } from "@/features/taskline/admin/members/member-list";
import { adminMemberList, TL_ADMIN_MEMBERS_TABLE_ID } from "@/features/taskline/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/members: the team (decision 0212). */
export const Route = createFileRoute("/_admin/admin/taskline/members")({
	...listSearch(adminMemberList.search, adminMemberList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { activityOptionsQueryOptions, adminMemberListQueryOptions } = await import(
			"@/features/taskline/admin/queries"
		);
		await ensureQuery(route.context.queryClient, activityOptionsQueryOptions());
		return listLoader(route, { tableId: TL_ADMIN_MEMBERS_TABLE_ID, query: adminMemberListQueryOptions });
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_members_title) },
	head: titleHead(m.taskline_admin_members_title),
	component: AdminMemberList,
});
