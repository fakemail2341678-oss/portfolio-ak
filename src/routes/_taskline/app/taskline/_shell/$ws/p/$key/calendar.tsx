import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { CalendarPage } from "@/features/taskline/calendar/calendar-page";
import { calendarSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listSearch } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/**
 * /app/taskline/$ws/p/$key/calendar (Task 51): the project's tasks on a month or a
 * week (the layout loaded them). The day, the mode, the date it goes by and the
 * filters are in the URL; `?task=` opens a task in a sheet, masked as its own page.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/calendar")({
	...listSearch(calendarSearch, calendarSearch.parse({})),
	staticData: { breadcrumb: staticCrumb(m.taskline_view_calendar) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_calendar()) }] }),
	component: CalendarPage,
});
