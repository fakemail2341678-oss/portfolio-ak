import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectList } from "@/features/taskline/admin/projects/project-list";
import { adminProjectList, TL_ADMIN_PROJECTS_TABLE_ID } from "@/features/taskline/admin/search";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/projects: every team project. */
export const Route = createFileRoute("/_admin/admin/taskline/projects/")({
	...listSearch(adminProjectList.search, adminProjectList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminProjectListQueryOptions, memberOptionsQueryOptions } = await import(
			"@/features/taskline/admin/queries"
		);
		await ensureQuery(route.context.queryClient, memberOptionsQueryOptions());
		return listLoader(route, { tableId: TL_ADMIN_PROJECTS_TABLE_ID, query: adminProjectListQueryOptions });
	},
	head: titleHead(m.taskline_admin_projects_title),
	component: AdminProjectList,
});
