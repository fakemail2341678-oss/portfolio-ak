import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { timesheetSearch } from "@/features/taskline/search";
import { TimesheetPage } from "@/features/taskline/time/timesheet-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/timesheet (Task 53): the caller's week in the workspace (`?week=`
 * names any day of another week). This week is the workspace's: its day and week start.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/timesheet")({
	validateSearch: timesheetSearch,
	loaderDeps: ({ search }) => ({ week: search.week }),
	loader: async ({ context, params, deps }) => {
		const { timesheetQueryOptions, workspaceQueryOptions } = await import("@/features/taskline/queries");
		const userId = context.session.user.id;
		const workspace = await ensureQuery(context.queryClient, workspaceQueryOptions(userId, params.ws));
		await ensureQuery(context.queryClient, timesheetQueryOptions(userId, params.ws, deps.week ?? workspace.today));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_nav_timesheet) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_nav_timesheet()) }] }),
	component: TimesheetPage,
});
