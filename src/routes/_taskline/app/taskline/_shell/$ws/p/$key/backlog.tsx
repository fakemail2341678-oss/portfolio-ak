import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { backlogSearch } from "@/features/taskline/search";
import { BacklogPage } from "@/features/taskline/sprints/backlog-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/backlog (Task 52): the open sprints and the backlog (the
 * layout loaded the tasks and sprints). `?task=` opens a task in a sheet, masked as its own page.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/backlog")({
	validateSearch: backlogSearch,
	staticData: { breadcrumb: staticCrumb(m.taskline_view_backlog) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_backlog()) }] }),
	component: BacklogPage,
});
