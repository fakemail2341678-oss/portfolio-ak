import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { ListPage } from "@/features/taskline/list/list-page";
import { TASKS_TABLE_ID, taskList, taskListSearch } from "@/features/taskline/search";
import { tableListInput } from "@/hooks/use-list-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listSearch } from "@/lib/crud/route";
import { loadList } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/list: the project's tasks on the list contract (filters,
 * sort, page and grouping in the URL, paged by the server). `?task=` opens a task in
 * a sheet, masked as its own page.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/list")({
	...listSearch(taskListSearch, taskList.defaults),
	// The open task isn't part of the list's input: opening one doesn't read the page again.
	loaderDeps: ({ search: { task: _task, ...list } }) => list,
	loader: async ({ context, params, deps, cause }) => {
		const { taskPageQueryOptions } = await import("@/features/taskline/queries");
		const input = tableListInput(deps, context.preferences.state, TASKS_TABLE_ID);
		await loadList(
			context.queryClient,
			taskPageQueryOptions(context.session.user.id)({ ...input, ws: params.ws, key: params.key }),
			cause,
		);
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_view_list) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_list()) }] }),
	component: ListPage,
});
