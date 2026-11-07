import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	ChartLineIcon,
	CheckCheckIcon,
	ListOrderedIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { draftTask, projectTaskCollection } from "../board/collections";
import { endPosition } from "../board/moves";
import { tasklineLinks } from "../links";
import { projectTasksQueryOptions, tasklineMutations } from "../queries";
import { TaskSheetLink } from "../task/task-link";
import { isClosedCategory, type SprintSummary, type TaskSummary } from "../types";
import { Backlog } from "./backlog";
import { type BacklogSection, backlogLayout } from "./moves";
import { measureOf, velocityIn, velocityText } from "./sprint-bits";

const TaskSheet = lazy(() => import("../task/task-sheet"));
const SprintFormDialog = lazy(() =>
	import("./sprint-dialogs").then((module) => ({ default: module.SprintFormDialog })),
);
const CompleteSprintDialog = lazy(() =>
	import("./sprint-dialogs").then((module) => ({ default: module.CompleteSprintDialog })),
);

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/backlog");

/** A change that shows at once; if the server refuses it, DB has put it back and this says so. */
const reportRollback = (transaction: { when: (state: "settled") => Promise<unknown> }) =>
	transaction.when("settled").catch((error: unknown) => {
		toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
	});

type Dialog = { kind: "plan" } | { kind: "edit"; sprint: SprintSummary } | { kind: "complete"; sprint: SprintSummary };

/**
 * /app/taskline/$ws/p/$key/backlog (Task 52): the active and planned sprints, then the
 * backlog, over the board's collection (a move shows at once and is put back if the
 * save fails). Planning, starting and completing sprints happen here.
 */
export function BacklogPage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const search = route.useSearch();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const dbClient = useDbClient();
	const collection = dbClient.collection(projectTaskCollection(userId, ws, key));
	const { data: tasks } = useLiveSuspenseQuery((q) => q.from({ task: collection }), [collection]);
	const closeTask = useCloseOverlay({ task: undefined });
	const [dialog, setDialog] = useState<Dialog | null>(null);
	const start = useMutation(tasklineMutations.startSprint(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteSprint(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));

	const { can, settings } = project.project;
	const measure = measureOf(settings.estimation);
	const velocity = velocityIn(project.velocity, measure);
	const closedIds = new Set(project.statuses.filter((status) => isClosedCategory(status.category)).map((s) => s.id));
	const isClosed = (task: TaskSummary) => closedIds.has(task.statusId);
	const sections = backlogLayout(project.sprints, tasks, isClosed);
	const active = project.sprints.find((sprint) => sprint.state === "active");

	if (!settings.sprints) {
		return (
			<EmptyState
				title={m.taskline_backlog_off_title()}
				description={m.taskline_backlog_off_body()}
				icon={ListOrderedIcon}
				primaryAction={
					can.manage ? (
						<Button asChild variant="outline">
							<Link {...tasklineLinks.settings(ws, key, "general")}>{m.taskline_backlog_turn_on()}</Link>
						</Button>
					) : undefined
				}
				data-testid="backlog-off"
			/>
		);
	}

	const actions = (section: BacklogSection) => {
		const { sprint } = section;
		if (!sprint) return null;
		const report = (
			<Button asChild variant="ghost" size="sm">
				<Link {...tasklineLinks.sprint(ws, key, sprint.id)} data-testid="sprint-report-link">
					<ChartLineIcon aria-hidden />
					{m.taskline_sprint_report()}
				</Link>
			</Button>
		);
		if (!can.edit) return sprint.state === "active" ? report : null;
		if (sprint.state === "active") {
			return (
				<>
					{report}
					<Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "edit", sprint })}>
						<PencilIcon aria-hidden />
						{m.crud_edit()}
					</Button>
					<Button size="sm" onClick={() => setDialog({ kind: "complete", sprint })} data-testid="sprint-complete">
						<CheckCheckIcon aria-hidden />
						{m.taskline_sprint_complete()}
					</Button>
				</>
			);
		}
		return (
			<>
				<Button
					variant="ghost"
					size="sm"
					aria-label={m.taskline_sprint_delete_named({ sprint: sprint.name })}
					onClick={async () => {
						const confirmed = await confirm({
							title: m.taskline_sprint_delete_title({ sprint: sprint.name }),
							description: m.taskline_sprint_delete_body(),
							confirmLabel: m.taskline_sprint_delete(),
							destructive: true,
						});
						if (confirmed) remove.mutate({ ws, key, id: sprint.id }, { onError: fail });
					}}
				>
					<Trash2Icon aria-hidden />
				</Button>
				<Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "edit", sprint })}>
					<PencilIcon aria-hidden />
					{m.crud_edit()}
				</Button>
				{active ? null : (
					<Button
						size="sm"
						variant="outline"
						disabled={start.isPending}
						onClick={() =>
							start.mutate(
								{ ws, key, id: sprint.id },
								{ onSuccess: () => toast.success(m.taskline_sprint_started({ sprint: sprint.name })), onError: fail },
							)
						}
						data-testid="sprint-start"
					>
						<PlayIcon aria-hidden />
						{m.taskline_sprint_start_action()}
					</Button>
				)}
			</>
		);
	};

	const unfinished = (sprint: SprintSummary) =>
		tasks.filter((task) => task.sprintId === sprint.id && !isClosed(task)).length;

	return (
		<div className="flex min-w-0 flex-col gap-4" data-testid="backlog-page">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-caption text-muted-foreground">{velocityText(project.velocity, settings.estimation)}</p>
				{can.edit ? (
					<Button size="sm" onClick={() => setDialog({ kind: "plan" })} data-testid="sprint-new">
						<PlusIcon aria-hidden />
						{m.taskline_sprint_new()}
					</Button>
				) : null}
			</div>
			{can.edit ? (
				<p className="text-caption text-muted-foreground max-sm:hidden">{m.taskline_backlog_hint()}</p>
			) : null}
			<Backlog
				sections={sections}
				statuses={project.statuses}
				members={project.members}
				measure={measure}
				velocity={velocity}
				canEdit={can.edit}
				onMove={(task, move) =>
					reportRollback(
						collection.update(task.id, (draft) => {
							draft.sprintId = move.sprintId;
							draft.rank = move.rank;
						}),
					)
				}
				onPoints={(task, points) =>
					reportRollback(
						collection.update(task.id, (draft) => {
							draft.points = points;
						}),
					)
				}
				onEstimate={(task, estimateMinutes) =>
					reportRollback(
						collection.update(task.id, (draft) => {
							draft.estimateMinutes = estimateMinutes;
						}),
					)
				}
				onAdd={(title) => {
					const first = project.statuses.find((status) => status.category === "backlog") ?? project.statuses[0];
					if (!first) return;
					const siblings = tasks.filter((task) => task.statusId === first.id);
					reportRollback(
						collection.insert(draftTask({ key, title, statusId: first.id, position: endPosition(siblings) })),
					);
				}}
				renderOpen={(task, children) =>
					task.number > 0 ? (
						<TaskSheetLink
							view="backlog"
							ws={ws}
							taskRef={task.ref}
							className="min-w-0 rounded-sm text-start outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
							data-testid="backlog-open"
						>
							{children}
						</TaskSheetLink>
					) : (
						children
					)
				}
				renderActions={actions}
			/>
			<Suspense fallback={null}>
				{search.task ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={search.task} onClose={closeTask} />
				) : null}
				{dialog?.kind === "plan" || dialog?.kind === "edit" ? (
					<SprintFormDialog
						userId={userId}
						ws={ws}
						project={project}
						sprint={dialog.kind === "edit" ? dialog.sprint : null}
						onClose={() => setDialog(null)}
					/>
				) : null}
				{dialog?.kind === "complete" ? (
					<CompleteSprintDialog
						userId={userId}
						ws={ws}
						project={project}
						sprint={dialog.sprint}
						unfinished={unfinished(dialog.sprint)}
						onClose={() => setDialog(null)}
					/>
				) : null}
			</Suspense>
		</div>
	);
}
