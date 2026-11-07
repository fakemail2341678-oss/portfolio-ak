import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { projectTimeSearch } from "@/features/taskline/search";
import { ProjectTimePage } from "@/features/taskline/time/project-time";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/time (Task 53): the project's estimate against actual, by
 * task or by member (`?by=`). `?task=` opens a task in a sheet, masked as its own page.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/time")({
	validateSearch: projectTimeSearch,
	loader: async ({ context, params }) => {
		const { projectTimeQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, projectTimeQueryOptions(context.session.user.id, params.ws, params.key));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_view_time) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_time()) }] }),
	component: ProjectTimePage,
});
