import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	FlagIcon,
	ListIcon,
	PencilIcon,
	PlusIcon,
	RotateCcwIcon,
	Trash2Icon,
} from "lucide-react";
import { lazy, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { Button } from "@/components/ui/button";
import { generateKeyBetween } from "@/lib/fractional-index";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { projectTasksQueryOptions, tasklineMutations } from "../queries";
import { StatusName } from "../task/task-bits";
import { TaskSheetLink } from "../task/task-link";
import type { Milestone, ProjectTasks } from "../types";
import { milestoneProgress } from "./layout";

const TaskSheet = lazy(() => import("../task/task-sheet"));
const MilestoneFormDialog = lazy(() => import("./milestone-dialog"));

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/milestones");

const dayText = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "medium" });

/**
 * /app/taskline/$ws/p/$key/milestones (Task 54): the project's milestones in their
 * order, each with its day, its progress (its tasks done, canceled ones aside), what's
 * overdue, and its tasks. Editors add, edit, complete, reorder and delete them; a
 * task joins one from its own fields.
 */
export function MilestonesPage() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const search = route.useSearch();
	const userId = session.user.id;
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const closeTask = useCloseOverlay({ task: undefined });
	// undefined: closed; null: a new one; a milestone: editing it.
	const [editing, setEditing] = useState<Milestone | null | undefined>(undefined);
	const headingId = useId();
	const canEdit = project.project.can.edit;
	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4" data-testid="milestones-page">
			<div className="flex flex-wrap items-center gap-3">
				<h2 id={headingId} className="me-auto flex items-baseline gap-2 text-heading">
					{m.taskline_view_milestones()}
					<span className="text-caption text-muted-foreground tabular-nums">
						{formatNumber(project.milestones.length)}
					</span>
				</h2>
				{canEdit ? (
					<Button onClick={() => setEditing(null)} data-testid="milestone-new">
						<PlusIcon aria-hidden />
						{m.taskline_milestone_new()}
					</Button>
				) : null}
			</div>
			{project.milestones.length === 0 ? (
				<p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">
					{canEdit ? m.taskline_milestones_empty_editor() : m.taskline_milestones_empty()}
				</p>
			) : (
				<ol className="flex flex-col gap-3">
					{project.milestones.map((milestone, index) => (
						<MilestoneCard
							key={milestone.id}
							milestone={milestone}
							index={index}
							project={project}
							userId={userId}
							ws={ws}
							onEdit={() => setEditing(milestone)}
						/>
					))}
				</ol>
			)}
			<Suspense fallback={null}>
				{editing !== undefined ? (
					<MilestoneFormDialog
						userId={userId}
						ws={ws}
						projectKey={key}
						milestone={editing}
						onClose={() => setEditing(undefined)}
					/>
				) : null}
				{search.task ? (
					<TaskSheet userId={userId} ws={ws} projectKey={key} taskRef={search.task} onClose={closeTask} />
				) : null}
			</Suspense>
		</section>
	);
}

function MilestoneCard({
	milestone,
	index,
	project,
	userId,
	ws,
	onEdit,
}: {
	milestone: Milestone;
	index: number;
	project: ProjectTasks;
	userId: string;
	ws: string;
	onEdit: () => void;
}) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const update = useMutation(tasklineMutations.updateMilestone(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteMilestone(queryClient, userId));
	const headingId = useId();
	const key = project.project.key;
	const canEdit = project.project.can.edit;
	const progress = milestoneProgress(milestone, project.tasks, project.statuses, project.today);
	const tasks = project.tasks.filter((task) => task.milestoneId === milestone.id);
	const complete = milestone.completedAt !== null;
	const failed = (error: unknown) => toast.error(errorMessage(error));
	const neighbours = project.milestones;
	const moveTo = (to: number) => {
		const before = neighbours[to < index ? to - 1 : to]?.position ?? null;
		const after = neighbours[to < index ? to : to + 1]?.position ?? null;
		update.mutate({ ws, key, id: milestone.id, position: generateKeyBetween(before, after) }, { onError: failed });
	};
	const toDelete = async () => {
		const confirmed = await confirm({
			title: m.taskline_milestone_delete_title({ name: milestone.name }),
			description: m.taskline_milestone_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (confirmed) remove.mutate({ ws, key, id: milestone.id }, { onError: failed });
	};
	const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
	return (
		<li
			aria-labelledby={headingId}
			className="flex flex-col gap-3 rounded-lg border bg-background p-4"
			data-testid="milestone"
			data-name={milestone.name}
		>
			<div className="flex flex-wrap items-start gap-3">
				<FlagIcon className={cn("mt-0.5 size-4 shrink-0", complete ? "text-success" : "text-primary")} aria-hidden />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<h3 id={headingId} className="font-medium text-body wrap-anywhere">
						{milestone.name}
					</h3>
					<p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
						<span>
							{milestone.dueOn
								? m.taskline_milestone_due({ date: dayText(milestone.dueOn) })
								: m.taskline_milestone_no_due()}
						</span>
						{complete && milestone.completedAt ? (
							<span className="text-success" data-testid="milestone-complete">
								{m.taskline_milestone_completed_on({
									date: formatDate(milestone.completedAt, { dateStyle: "medium" }),
								})}
							</span>
						) : progress.late ? (
							<span className="text-danger" data-testid="milestone-late">
								{m.taskline_milestone_late()}
							</span>
						) : null}
					</p>
					{milestone.description ? (
						<p className="whitespace-pre-line text-body text-muted-foreground wrap-anywhere">{milestone.description}</p>
					) : null}
				</div>
				{canEdit ? (
					<div className="flex flex-wrap items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							disabled={update.isPending}
							onClick={() => update.mutate({ ws, key, id: milestone.id, completed: !complete }, { onError: failed })}
							data-testid="milestone-complete-toggle"
						>
							{complete ? <RotateCcwIcon aria-hidden /> : <CheckIcon aria-hidden />}
							{complete ? m.taskline_milestone_reopen() : m.taskline_milestone_complete()}
						</Button>
						<Button variant="ghost" size="icon" onClick={onEdit} data-testid="milestone-edit">
							<PencilIcon aria-hidden />
							<span className="sr-only">{m.taskline_milestone_edit_title({ name: milestone.name })}</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							disabled={index === 0 || update.isPending}
							onClick={() => moveTo(index - 1)}
						>
							<ArrowUpIcon aria-hidden />
							<span className="sr-only">{m.taskline_milestone_up({ name: milestone.name })}</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							disabled={index === project.milestones.length - 1 || update.isPending}
							onClick={() => moveTo(index + 1)}
						>
							<ArrowDownIcon aria-hidden />
							<span className="sr-only">{m.taskline_milestone_down({ name: milestone.name })}</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="text-danger"
							onClick={() => void toDelete()}
							data-testid="milestone-delete"
						>
							<Trash2Icon aria-hidden />
							<span className="sr-only">{m.taskline_milestone_delete_title({ name: milestone.name })}</span>
						</Button>
					</div>
				) : null}
			</div>
			<div className="flex flex-col gap-1.5">
				<div className="flex flex-wrap items-baseline justify-between gap-2 text-caption">
					<span className="tabular-nums" data-testid="milestone-progress">
						{m.taskline_milestone_progress({ done: formatNumber(progress.done), total: formatNumber(progress.total) })}
					</span>
					{progress.overdue > 0 ? (
						<span className="text-danger tabular-nums">
							{m.taskline_milestone_overdue({ count: formatNumber(progress.overdue) })}
						</span>
					) : null}
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
					<span
						className={cn("block h-full", complete ? "bg-success" : "bg-primary")}
						style={{ width: `${percent}%` }}
					/>
				</div>
			</div>
			{tasks.length > 0 ? (
				<details className="group">
					<summary className="cursor-pointer text-caption text-muted-foreground hover:text-foreground">
						{m.taskline_milestone_tasks({ count: formatNumber(tasks.length) })}
					</summary>
					<ul className="mt-2 flex flex-col divide-y rounded-md border">
						{tasks.map((task) => {
							const status = project.statuses.find((each) => each.id === task.statusId);
							return (
								<li key={task.id} className="flex items-center gap-2 px-3 py-2 text-body">
									<span className="font-mono text-caption text-muted-foreground">{task.ref}</span>
									<TaskSheetLink
										view="milestones"
										ws={ws}
										taskRef={task.ref}
										className={cn(
											"min-w-0 flex-1 truncate hover:underline",
											task.completedAt && "text-muted-foreground line-through",
										)}
									>
										{task.title}
									</TaskSheetLink>
									{status ? <StatusName status={status} className="text-caption text-muted-foreground" /> : null}
								</li>
							);
						})}
					</ul>
					<Button asChild variant="link" size="sm" className="mt-1 px-0">
						<Link {...tasklineLinks.list(ws, key)} search={{ milestone: milestone.id }}>
							<ListIcon aria-hidden />
							{m.taskline_milestone_in_list()}
						</Link>
					</Button>
				</details>
			) : null}
		</li>
	);
}
