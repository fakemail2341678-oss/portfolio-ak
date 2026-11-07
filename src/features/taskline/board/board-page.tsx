import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { SavedViewsMenu } from "@/components/data-table/saved-views";
import { errorMessage } from "@/components/errors/error-page";
import { SelectFilter } from "@/components/filters/filters";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { addDays } from "@/lib/i18n/date-only";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { filtersOf, hasFilters, matchesFilters } from "../filters";
import { PRIORITY_LABELS } from "../labels";
import { TaskFilterBar } from "../projects/task-filters";
import { projectTasksQueryOptions, workspaceQueryOptions } from "../queries";
import { useSavedViews } from "../saved-views";
import { SWIMLANES, type Swimlanes } from "../search";
import { TaskSheetLink } from "../task/task-link";
import { isClosedCategory, type ProjectTasks, TASK_PRIORITIES, type TaskSummary } from "../types";
import { Board, type BoardLane } from "./board";
import { draftTask, projectTaskCollection } from "./collections";
import { endPosition } from "./moves";

const TaskSheet = lazy(() => import("../task/task-sheet"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/board");

/** A change that shows at once; if the server refuses it, DB has put it back and this says so. */
const reportRollback = (transaction: { when: (state: "settled") => Promise<unknown> }) =>
	transaction.when("settled").catch((error: unknown) => {
		toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
	});

const SWIMLANE_LABELS: Record<Swimlanes, () => string> = {
	none: m.taskline_swimlanes_none,
	assignee: m.taskline_swimlanes_assignee,
	priority: m.taskline_swimlanes_priority,
};

/** The board's rows: one for everyone, or one per assignee (unassigned last) or priority (urgent first) with tasks. */
function lanesOf(swimlanes: Swimlanes, tasks: ReadonlyArray<TaskSummary>, project: ProjectTasks): BoardLane[] {
	if (swimlanes === "assignee") {
		const lanes: BoardLane[] = project.members
			.map((member) => ({
				id: member.id,
				label: member.name,
				tasks: tasks.filter((task) => task.assigneeId === member.id),
			}))
			.filter((lane) => lane.tasks.length > 0);
		const nobody = tasks.filter((task) => task.assigneeId === null);
		return nobody.length > 0 ? [...lanes, { id: "none", label: m.taskline_unassigned(), tasks: nobody }] : lanes;
	}
	if (swimlanes === "priority") {
		return [...TASK_PRIORITIES]
			.reverse()
			.map((priority) => ({
				id: `p${priority}`,
				label: PRIORITY_LABELS[priority](),
				tasks: tasks.filter((task) => task.priority === priority),
			}))
			.filter((lane) => lane.tasks.length > 0);
	}
	return [{ id: "all", label: null, tasks }];
}

/**
 * /app/taskline/$ws/p/$key/board (Kanban's board, decisions 0188 and 0189): the
 * project's tasks as a live query over a TanStack DB collection, server-rendered from
 * the layout's query. Moves and new tasks show at once and are put back if the save
 * fails. Closed tasks leave after the done-column window; the filters apply here.
 */
export function BoardPage() {
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
	const views = useSavedViews(userId, ws, key, "board");

	const filters = filtersOf(search);
	const context = {
		me: workspace.me?.id ?? null,
		today: project.today,
		activeSprintId: project.sprints.find((sprint) => sprint.state === "active")?.id ?? null,
		fields: project.fields,
	};
	const closedSince = addDays(project.today, -project.doneColumnDays);
	const closedIds = new Set(project.statuses.filter((status) => isClosedCategory(status.category)).map((s) => s.id));
	const hiddenClosed = new Map<string, number>();
	const visible = tasks.filter((task) => {
		if (closedIds.has(task.statusId) && task.completedAt && task.completedAt.slice(0, 10) < closedSince) {
			hiddenClosed.set(task.statusId, (hiddenClosed.get(task.statusId) ?? 0) + 1);
			return false;
		}
		return matchesFilters(task, filters, context);
	});
	const lanes = lanesOf(search.swimlanes, visible, project);
	const shownCount = visible.length;

	return (
		<div className="flex min-w-0 flex-col gap-4" data-testid="board-page">
			<TaskFilterBar
				search={search}
				context={project}
				member={workspace.me !== null}
				preserve={["swimlanes"]}
				tools={<SavedViewsMenu tableId="taskline-board" store={views} />}
				extra={
					<SelectFilter
						name="swimlanes"
						label={m.taskline_swimlanes()}
						value={search.swimlanes}
						options={SWIMLANES.map((value) => ({ value, label: SWIMLANE_LABELS[value]() }))}
					/>
				}
			/>
			{hasFilters(filters) ? (
				<p className="text-caption text-muted-foreground" data-testid="board-filtered">
					{m.taskline_filtered_count({ shown: formatNumber(shownCount), total: formatNumber(tasks.length) })}
				</p>
			) : null}
			{project.project.can.edit ? (
				<p className="text-caption text-muted-foreground max-sm:hidden">{m.taskline_board_hint()}</p>
			) : null}
			<Board
				statuses={project.statuses}
				lanes={lanes}
				allTasks={tasks}
				members={project.members}
				labels={project.labels}
				today={project.today}
				hiddenClosed={hiddenClosed}
				doneColumnDays={project.doneColumnDays}
				canEdit={project.project.can.edit}
				onMove={(task, move) =>
					reportRollback(
						collection.update(task.id, (draft) => {
							draft.statusId = move.statusId;
							draft.position = move.position;
						}),
					)
				}
				onAdd={(status, lane, title) => {
					const siblings = tasks.filter((task) => task.statusId === status.id);
					reportRollback(
						collection.insert(
							draftTask({
								key,
								title,
								statusId: status.id,
								position: endPosition(siblings),
								// A task added in a lane belongs there.
								...(search.swimlanes === "assignee" ? { assigneeId: lane.id === "none" ? null : lane.id } : {}),
								...(search.swimlanes === "priority"
									? { priority: TASK_PRIORITIES.find((priority) => `p${priority}` === lane.id) ?? 0 }
									: {}),
							}),
						),
					);
				}}
				renderOpen={(task, children) =>
					task.number > 0 ? (
						<TaskSheetLink
							view="board"
							ws={ws}
							taskRef={task.ref}
							className="rounded-sm text-start outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
							data-testid="taskline-card-open"
						>
							{children}
						</TaskSheetLink>
					) : (
						children
					)
				}
			/>
			<Suspense fallback={null}>
				{search.task ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={search.task} onClose={closeTask} />
				) : null}
			</Suspense>
		</div>
	);
}
