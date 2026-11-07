import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { SavedViewsMenu } from "@/components/data-table/saved-views";
import { errorMessage } from "@/components/errors/error-page";
import { SelectFilter } from "@/components/filters/filters";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { Button } from "@/components/ui/button";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatMonthYear, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { projectTaskCollection } from "../board/collections";
import { filtersOf, hasFilters, matchesFilters } from "../filters";
import { TaskFilterBar } from "../projects/task-filters";
import { projectTasksQueryOptions, workspaceQueryOptions } from "../queries";
import { useSavedViews } from "../saved-views";
import { CALENDAR_DATES, CALENDAR_MODES, type CalendarDate, type CalendarMode } from "../search";
import { TaskSheetLink } from "../task/task-link";
import type { TaskSummary } from "../types";
import { Calendar } from "./calendar";
import { calendarWeeks, monthOf, stepCalendar } from "./grid";

const TaskSheet = lazy(() => import("../task/task-sheet"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/calendar");

const MODE_LABELS: Record<CalendarMode, () => string> = {
	month: m.taskline_calendar_month,
	week: m.taskline_calendar_week,
};
const DATE_LABELS: Record<CalendarDate, () => string> = {
	due: m.taskline_calendar_by_due,
	start: m.taskline_calendar_by_start,
};

/**
 * /app/taskline/$ws/p/$key/calendar (Task 51): the project's tasks on a month or a
 * week by due date (or start date), over the board's TanStack DB collection of the
 * layout's query, so a reschedule shows at once and is put back if the save fails.
 * Weeks start on the workspace's week start; its days off are shaded. The day shown,
 * the mode, the date and the filters are in the URL; without `?date=` it's today.
 */
export function CalendarPage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const search = route.useSearch();
	const userId = session.user.id;
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const dbClient = useDbClient();
	const collection = dbClient.collection(projectTaskCollection(userId, ws, key));
	const { data: tasks } = useLiveSuspenseQuery((q) => q.from({ task: collection }), [collection]);
	const closeTask = useCloseOverlay({ task: undefined });
	const views = useSavedViews(userId, ws, key, "calendar");

	const anchor = search.date ?? project.today;
	const { weekStart, workingDays } = workspace.calendar;
	const weeks = calendarWeeks(anchor, search.mode, weekStart);
	const first = weeks[0]?.[0] ?? anchor;
	const last = weeks.at(-1)?.at(-1) ?? anchor;
	const dayOf = (task: TaskSummary) => (search.by === "start" ? task.startOn : task.dueOn);
	const filters = filtersOf(search);
	const context = {
		me: workspace.me?.id ?? null,
		today: project.today,
		activeSprintId: project.sprints.find((sprint) => sprint.state === "active")?.id ?? null,
		fields: project.fields,
	};
	const shown = tasks.filter((task) => {
		if (!matchesFilters(task, filters, context)) return false;
		const day = dayOf(task);
		// Closed tasks show on their day; without one they'd only crowd the undated list.
		return day === null ? task.completedAt === null : day >= first && day <= last;
	});
	const title =
		search.mode === "month"
			? formatMonthYear(isoDateInstant(`${monthOf(anchor)}-01`))
			: m.taskline_calendar_week_of({
					from: formatDate(isoDateInstant(first), { dateStyle: "medium" }),
					to: formatDate(isoDateInstant(last), { dateStyle: "medium" }),
				});
	const at = (date: string | undefined) =>
		({
			from: "/app/taskline/$ws/p/$key/calendar",
			to: ".",
			search: (prev: typeof search) => ({ ...prev, date, task: undefined }),
		}) as const;

	return (
		<div className="flex min-w-0 flex-col gap-4" data-testid="calendar-page">
			<TaskFilterBar
				search={search}
				context={project}
				member={workspace.me !== null}
				preserve={["date"]}
				extra={
					<>
						<SelectFilter
							name="mode"
							label={m.taskline_calendar_mode()}
							value={search.mode}
							options={CALENDAR_MODES.map((value) => ({ value, label: MODE_LABELS[value]() }))}
						/>
						<SelectFilter
							name="by"
							label={m.taskline_calendar_by()}
							value={search.by}
							options={CALENDAR_DATES.map((value) => ({ value, label: DATE_LABELS[value]() }))}
						/>
					</>
				}
				tools={<SavedViewsMenu tableId="taskline-calendar" store={views} />}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="me-auto text-heading" data-testid="calendar-title">
					{title}
				</h2>
				{hasFilters(filters) ? (
					<p className="text-caption text-muted-foreground">
						{m.taskline_calendar_filtered({ count: formatNumber(shown.length) })}
					</p>
				) : null}
				<nav aria-label={m.taskline_calendar_nav()} className="flex items-center gap-1">
					<Button asChild variant="outline" size="icon">
						<Link {...at(stepCalendar(anchor, search.mode, -1))} data-testid="calendar-previous">
							<ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
							<span className="sr-only">
								{search.mode === "month" ? m.taskline_calendar_previous_month() : m.taskline_calendar_previous_week()}
							</span>
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link {...at(undefined)} data-testid="calendar-today">
							{m.taskline_calendar_today()}
						</Link>
					</Button>
					<Button asChild variant="outline" size="icon">
						<Link {...at(stepCalendar(anchor, search.mode, 1))} data-testid="calendar-next">
							<ChevronRightIcon aria-hidden className="rtl:rotate-180" />
							<span className="sr-only">
								{search.mode === "month" ? m.taskline_calendar_next_month() : m.taskline_calendar_next_week()}
							</span>
						</Link>
					</Button>
				</nav>
			</div>
			{project.project.can.edit ? (
				<p className="text-caption text-muted-foreground max-sm:hidden">{m.taskline_calendar_hint()}</p>
			) : null}
			<Calendar
				weeks={weeks}
				month={search.mode === "month" ? monthOf(anchor) : null}
				today={project.today}
				anchor={anchor}
				workingDays={workingDays}
				tasks={shown}
				dayOf={dayOf}
				statuses={project.statuses}
				canEdit={project.project.can.edit}
				onMove={(task, day) => {
					const transaction = collection.update(task.id, (draft) => {
						if (search.by === "start") draft.startOn = day;
						else draft.dueOn = day;
					});
					// Shown at once; if the server refuses, DB has put it back and this says so.
					transaction.when("settled").catch((error: unknown) => {
						toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
					});
				}}
				renderOpen={(task, children) => (
					<TaskSheetLink
						view="calendar"
						ws={ws}
						taskRef={task.ref}
						className="min-w-0 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						data-testid="calendar-task-open"
					>
						{children}
					</TaskSheetLink>
				)}
			/>
			<Suspense fallback={null}>
				{search.task ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={search.task} onClose={closeTask} />
				) : null}
			</Suspense>
		</div>
	);
}
