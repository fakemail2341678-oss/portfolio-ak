import { createFileRoute, redirect, stripSearchParams } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { SearchPage } from "@/features/taskline/find/search-page";
import { tasklineLinks } from "@/features/taskline/links";
import { taskSearchSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/search (Task 51): the workspace's tasks matching `?q=`, ranked.
 * An exact reference ("WEB-12") of a task the caller may see goes straight to it.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/search")({
	validateSearch: taskSearchSearch,
	search: { middlewares: [stripSearchParams({ q: "", page: 1 })] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) => {
		if (!deps.q) return;
		const { searchQueryOptions } = await import("@/features/taskline/queries");
		const found = await ensureQuery(
			context.queryClient,
			searchQueryOptions(context.session.user.id, params.ws, deps.q, deps.page),
		);
		if (found.jump) throw redirect(tasklineLinks.task(params.ws, found.jump));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_nav_search) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_nav_search()) }] }),
	component: SearchPage,
});
