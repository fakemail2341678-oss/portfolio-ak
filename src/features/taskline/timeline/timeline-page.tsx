import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { SelectFilter } from "@/components/filters/filters";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { Button } from "@/components/ui/button";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { projectTaskCollection } from "../board/collections";
import { filtersOf, hasFilters, matchesFilters } from "../filters";
import { TaskFilterBar } from "../projects/task-filters";
import { projectTasksQueryOptions, workspaceQueryOptions } from "../queries";
import { TIMELINE_GROUPS, TIMELINE_ZOOMS, type TimelineGroupBy, type TimelineZoom } from "../search";
import { TaskSheetLink } from "../task/task-link";
import type { TaskSummary } from "../types";
import { labelGroups } from "./labels";
import { stepTimeline, timelineGroups, timelineRange } from "./layout";
import { Timeline } from "./timeline";

const TaskSheet = lazy(() => import("../task/task-sheet"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/timeline");

const ZOOM_LABELS: Record<TimelineZoom, () => string> = {
	day: m.taskline_timeline_zoom_day,
	week: m.taskline_timeline_zoom_week,
	month: m.taskline_timeline_zoom_month,
};
const GROUP_LABELS: Record<TimelineGroupBy, () => string> = {
	none: m.taskline_timeline_group_none,
	epic: m.taskline_timeline_group_epic,
	milestone: m.taskline_timeline_group_milestone,
	assignee: m.taskline_timeline_group_assignee,
};

/**
 * /app/taskline/$ws/p/$key/timeline (Task 54): the project's tasks over days, over the
 * board's TanStack DB collection of the layout's query, so a reschedule shows at once
 * and is put back if the save fails. Closed tasks without dates are left out. The
 * zoom, the grouping, the day it's around and the filters are in the URL.
 */
export function TimelinePage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const search = route.useSearch();
	const navigate = useNavigate();
	const userId = session.user.id;
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const dbClient = useDbClient();
	const collection = dbClient.collection(projectTaskCollection(userId, ws, key));
	const { data: tasks } = useLiveSuspenseQuery((q) => q.from({ task: collection }), [collection]);
	const closeTask = useCloseOverlay({ task: undefined });

	const anchor = search.date ?? project.today;
	const { weekStart, workingDays } = workspace.calendar;
	const range = timelineRange(anchor, search.zoom, weekStart);
	const filters = filtersOf(search);
	const context = {
		me: workspace.me?.id ?? null,
		today: project.today,
		activeSprintId: project.sprints.find((sprint) => sprint.state === "active")?.id ?? null,
		fields: project.fields,
	};
	const shown = tasks.filter(
		(task) =>
			matchesFilters(task, filters, context) &&
			(task.completedAt === null || task.startOn !== null || task.dueOn !== null),
	);
	const groups = labelGroups(
		timelineGroups(shown, search.group, { milestones: project.milestones, members: project.members, all: tasks }),
		project,
	);
	const at = (date: string | undefined) =>
		({
			from: "/app/taskline/$ws/p/$key/timeline",
			to: ".",
			search: (prev: typeof search) => ({ ...prev, date, task: undefined }),
		}) as const;
	const open = (task: TaskSummary) =>
		navigate({
			from: "/app/taskline/$ws/p/$key/timeline",
			to: ".",
			search: (prev) => ({ ...prev, task: task.ref }),
			mask: { to: "/app/taskline/$ws/t/$ref", params: { ws, ref: task.ref }, unmaskOnReload: true },
		});

	return (
		<div className="flex min-w-0 flex-col gap-4" data-testid="timeline-page">
			<TaskFilterBar
				search={search}
				context={project}
				member={workspace.me !== null}
				preserve={["date"]}
				extra={
					<>
						<SelectFilter
							name="zoom"
							label={m.taskline_timeline_zoom()}
							value={search.zoom}
							options={TIMELINE_ZOOMS.map((value) => ({ value, label: ZOOM_LABELS[value]() }))}
						/>
						<SelectFilter
							name="group"
							label={m.taskline_timeline_group()}
							value={search.group}
							options={TIMELINE_GROUPS.map((value) => ({ value, label: GROUP_LABELS[value]() }))}
						/>
					</>
				}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="me-auto text-heading" data-testid="timeline-title">
					{m.taskline_timeline_range({
						from: formatDate(isoDateInstant(range.from), { dateStyle: "medium" }),
						to: formatDate(isoDateInstant(range.to), { dateStyle: "medium" }),
					})}
				</h2>
				{hasFilters(filters) ? (
					<p className="text-caption text-muted-foreground">
						{m.taskline_calendar_filtered({ count: formatNumber(shown.length) })}
					</p>
				) : null}
				<nav aria-label={m.taskline_timeline_nav()} className="flex items-center gap-1">
					<Button asChild variant="outline" size="icon">
						<Link {...at(stepTimeline(anchor, search.zoom, -1))} data-testid="timeline-previous">
							<ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
							<span className="sr-only">{m.taskline_timeline_previous()}</span>
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link {...at(undefined)} data-testid="timeline-today-link">
							{m.taskline_calendar_today()}
						</Link>
					</Button>
					<Button asChild variant="outline" size="icon">
						<Link {...at(stepTimeline(anchor, search.zoom, 1))} data-testid="timeline-next">
							<ChevronRightIcon aria-hidden className="rtl:rotate-180" />
							<span className="sr-only">{m.taskline_timeline_next()}</span>
						</Link>
					</Button>
				</nav>
			</div>
			{project.project.can.edit ? (
				<p className="text-caption text-muted-foreground max-sm:hidden">{m.taskline_timeline_hint()}</p>
			) : null}
			<Timeline
				range={range}
				today={project.today}
				anchor={anchor}
				weekStart={weekStart}
				workingDays={workingDays}
				groups={groups}
				milestones={project.milestones}
				dependencies={project.dependencies}
				allTasks={tasks}
				canEdit={project.project.can.edit}
				onChange={(task, dates) => {
					const transaction = collection.update(task.id, (draft) => {
						draft.startOn = dates.startOn;
						draft.dueOn = dates.dueOn;
					});
					// Shown at once; if the server refuses, DB has put it back and this says so.
					transaction.when("settled").catch((error: unknown) => {
						toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
					});
				}}
				onOpen={(task) => void open(task)}
				renderOpen={(task, children) => (
					<TaskSheetLink
						view="timeline"
						ws={ws}
						taskRef={task.ref}
						className="min-w-0 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						data-testid="timeline-task-open"
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
