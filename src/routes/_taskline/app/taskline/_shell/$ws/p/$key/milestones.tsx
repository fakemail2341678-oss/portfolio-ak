import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { milestonesSearch } from "@/features/taskline/search";
import { MilestonesPage } from "@/features/taskline/timeline/milestones-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/milestones (Task 54): the project's milestones with the
 * progress of their tasks (the layout loaded both). `?task=` opens a task in a sheet.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/milestones")({
	validateSearch: milestonesSearch,
	staticData: { breadcrumb: staticCrumb(m.taskline_view_milestones) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_milestones()) }] }),
	component: MilestonesPage,
});
