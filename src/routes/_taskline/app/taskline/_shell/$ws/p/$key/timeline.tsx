import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { timelineSearch } from "@/features/taskline/search";
import { TimelinePage } from "@/features/taskline/timeline/timeline-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listSearch } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/timeline (Task 54): the project's tasks as bars over days,
 * with its milestones and dependencies (the layout loaded them). The zoom, the grouping,
 * the day it's around and the filters are in the URL; `?task=` opens a task in a sheet.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/timeline")({
	...listSearch(timelineSearch, timelineSearch.parse({})),
	staticData: { breadcrumb: staticCrumb(m.taskline_view_timeline) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_timeline()) }] }),
	component: TimelinePage,
});
