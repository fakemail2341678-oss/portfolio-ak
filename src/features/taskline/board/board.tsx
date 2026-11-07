import { Accessibility, type DragEndEvent, type DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { GripVerticalIcon, ListChecksIcon, ListTreeIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { TASK_TITLE_MAX } from "../schema";
import { Assignee, BlockedBadge, DueDate, LabelChip, PriorityIcon, StatusName, TaskTypeIcon } from "../task/task-bits";
import {
	isClosedCategory,
	type TasklineLabel,
	type TasklineMember,
	type TasklineStatus,
	type TaskSummary,
} from "../types";
import { type BoardLayout, boardLayout, cardDrop, cardPlace, cardStep, type Direction, type TaskMove } from "./moves";

/**
 * Taskline's board (Kanban's, decision 0188, on a project's statuses): a column per
 * status, the tasks in them, in rows per assignee or priority with swimlanes. Three
 * ways to move a task, from its handle:
 * - drag it with a pointer;
 * - keyboard drag (dnd-kit's keyboard sensor): Space picks it up, the arrows move it,
 *   Space drops, Escape cancels;
 * - Alt + arrows moves it at once: up and down its column, or into the next one.
 * Every move is announced in the page's language. A task moves within its lane; the
 * board only reports moves (`onMove`) and new tasks (`onAdd`), the page applies them.
 */

/** A row of the board: everyone's tasks (one lane, no heading), or one assignee's or priority's. */
export type BoardLane = { id: string; label: string | null; tasks: ReadonlyArray<TaskSummary> };

export type BoardProps = {
	statuses: ReadonlyArray<TasklineStatus>;
	lanes: ReadonlyArray<BoardLane>;
	/** Every task of the project, shown or not: the columns' counts, WIP limits and subtask progress read them. */
	allTasks: ReadonlyArray<TaskSummary>;
	members: ReadonlyArray<TasklineMember>;
	labels: ReadonlyArray<TasklineLabel>;
	/** Today in the workspace (YYYY-MM-DD), from the server, so both renders agree on what's overdue. */
	today: string;
	/** Closed tasks hidden in each status (closed before the done-column window). */
	hiddenClosed: ReadonlyMap<string, number>;
	doneColumnDays: number;
	/** Moves and quick add; false for a reader (no handles, no "Add task"). */
	canEdit: boolean;
	onMove: (task: TaskSummary, move: TaskMove) => void;
	onAdd: (status: TasklineStatus, lane: BoardLane, title: string) => void;
	/** The task's title as a link that opens it (the sheet over the board, masked as its own page). */
	renderOpen: (task: TaskSummary, children: ReactNode) => ReactNode;
};

const STEP_KEYS: Record<string, Direction> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
};

/** A lane's column as a drop target and a sortable group: `<lane>|<status>`. */
const groupOf = (laneId: string, statusId: string) => `${laneId}|${statusId}`;
const statusOfGroup = (group: string) => group.split("|")[1] ?? "";

export function Board(props: BoardProps) {
	const { statuses, lanes, allTasks, onMove } = props;
	const [announcement, setAnnouncement] = useState("");
	const boardLabelId = useId();
	const layouts = new Map(lanes.map((lane) => [lane.id, boardLayout(statuses, lane.tasks)]));
	const taskById = (id: unknown) => allTasks.find((task) => task.id === id);
	const laneOf = (task: TaskSummary) => lanes.find((lane) => lane.tasks.some((each) => each.id === task.id));

	const move = (task: TaskSummary, layout: BoardLayout, next: TaskMove) => {
		const place = cardPlace(layout, task.id, next);
		onMove(task, next);
		setAnnouncement(
			m.taskline_task_moved({
				task: task.title,
				status: place.column?.name ?? "",
				position: formatNumber(place.index + 1),
				total: formatNumber(place.total),
			}),
		);
	};

	const step = (task: TaskSummary, direction: Direction) => {
		const lane = laneOf(task);
		const layout = lane ? layouts.get(lane.id) : undefined;
		const next = layout ? cardStep(layout, task.id, direction) : null;
		if (layout && next) move(task, layout, next);
	};

	return (
		<DragDropProvider
			plugins={(defaults) => [
				...defaults,
				Accessibility.configure({
					screenReaderInstructions: { draggable: m.taskline_drag_instructions() },
					announcements: {
						dragstart: ({ operation: { source } }: DragStartEvent) =>
							source ? m.taskline_picked({ item: taskById(source.id)?.title ?? "" }) : undefined,
						dragover: () => undefined,
						dragend: ({ operation: { source }, canceled }: DragEndEvent) =>
							source && canceled ? m.sortable_canceled({ item: taskById(source.id)?.title ?? "" }) : undefined,
					},
				}),
			]}
			onDragEnd={({ operation: { source, target }, canceled }) => {
				if (canceled || !source || !isSortable(source)) return;
				const task = taskById(source.id);
				const lane = task ? laneOf(task) : undefined;
				const layout = lane ? layouts.get(lane.id) : undefined;
				if (!task || !lane || !layout) return;
				// Dropped on a column itself (an empty one, or its foot): the end of that column.
				if (target && target.type === "column" && typeof target.id === "string" && target.id !== source.group) {
					const statusId = statusOfGroup(target.id);
					const next = cardDrop(layout, task.id, statusId, Number.POSITIVE_INFINITY);
					if (next) move(task, layout, next);
					return;
				}
				const group = typeof source.group === "string" ? source.group : null;
				if (!group) return;
				const next = cardDrop(layout, task.id, statusOfGroup(group), source.index);
				if (next) move(task, layout, next);
			}}
		>
			<h2 id={boardLabelId} className="sr-only">
				{m.taskline_board_label()}
			</h2>
			{/* A focusable scroll region: the board scrolls sideways on narrow screens. */}
			<section
				aria-labelledby={boardLabelId}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable).
				tabIndex={0}
				className="relative -mx-4 overflow-x-auto px-4 pb-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:mx-0 sm:px-0"
				data-testid="taskline-board"
			>
				<div className="flex w-max min-w-full flex-col gap-6">
					{lanes.map((lane) => (
						<BoardLaneRow
							key={lane.id}
							lane={lane}
							layout={layouts.get(lane.id) ?? boardLayout(statuses, [])}
							props={props}
							onStep={step}
						/>
					))}
				</div>
			</section>
			<p className="sr-only" aria-live="polite" data-testid="taskline-announcement">
				{announcement}
			</p>
		</DragDropProvider>
	);
}

function BoardLaneRow({
	lane,
	layout,
	props,
	onStep,
}: {
	lane: BoardLane;
	layout: BoardLayout;
	props: BoardProps;
	onStep: (task: TaskSummary, direction: Direction) => void;
}) {
	const headingId = useId();
	const columns = (
		<ol className="flex items-start gap-3">
			{layout.columns.map((status) => (
				<BoardColumn key={status.id} status={status} lane={lane} layout={layout} props={props} onStep={onStep} />
			))}
		</ol>
	);
	if (lane.label === null) return columns;
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2" data-testid="taskline-lane">
			<h3 id={headingId} className="sticky start-0 flex w-fit items-center gap-2 font-medium text-body">
				{lane.label}
				<span className="text-caption text-muted-foreground tabular-nums">{formatNumber(lane.tasks.length)}</span>
			</h3>
			{columns}
		</section>
	);
}

function BoardColumn({
	status,
	lane,
	layout,
	props,
	onStep,
}: {
	status: TasklineStatus;
	lane: BoardLane;
	layout: BoardLayout;
	props: BoardProps;
	onStep: (task: TaskSummary, direction: Direction) => void;
}) {
	const group = groupOf(lane.id, status.id);
	// The column takes tasks too, so one can be dropped into an empty column.
	const { ref } = useDroppable({
		id: group,
		type: "column",
		accept: `task:${lane.id}`,
		// CollisionPriority.Low (@dnd-kit/abstract): a task over a task wins over the column.
		collisionPriority: 1,
	});
	const cards = layout.cards.get(status.id) ?? [];
	const headingId = useId();
	const inStatus = props.allTasks.filter((task) => task.statusId === status.id).length;
	const overLimit = status.wipLimit !== null && inStatus > status.wipLimit;
	const hidden = lane.label === null ? (props.hiddenClosed.get(status.id) ?? 0) : 0;
	// Under a lane's heading (h3), a column's is one level down.
	const Heading = lane.label === null ? "h3" : "h4";

	return (
		<li
			ref={ref}
			className={cn("w-72 shrink-0 rounded-lg border bg-surface-1", overLimit && "border-warning")}
			data-testid="taskline-column"
		>
			{/* Lanes repeat the statuses: there a column's region is named after its lane too. */}
			<section
				{...(lane.label === null
					? { "aria-labelledby": headingId }
					: { "aria-label": `${lane.label}: ${status.name}` })}
				className="flex flex-col gap-2 p-2"
			>
				<header className="flex items-center gap-2 px-1">
					<Heading id={headingId} className="min-w-0 flex-1 font-medium text-body">
						<StatusName status={status} />
					</Heading>
					<span
						className={cn(
							"rounded-full px-2 text-caption tabular-nums",
							overLimit ? "bg-warning-subtle font-medium text-warning" : "bg-surface-2 text-muted-foreground",
						)}
						data-testid="taskline-column-count"
					>
						<span className="sr-only">{m.taskline_column_count()} </span>
						{status.wipLimit === null
							? formatNumber(cards.length)
							: `${formatNumber(cards.length)} / ${formatNumber(status.wipLimit)}`}
					</span>
				</header>
				{overLimit && status.wipLimit !== null ? (
					<p className="flex items-center gap-1.5 px-1 text-caption text-warning" data-testid="taskline-wip">
						<TriangleAlertIcon className="size-3.5" aria-hidden />
						{m.taskline_wip_over({ limit: formatNumber(status.wipLimit) })}
					</p>
				) : null}
				<ol className="flex min-h-10 flex-col gap-2">
					{cards.map((task, index) => (
						<BoardCard
							key={task.id}
							task={task}
							index={index}
							group={group}
							lane={lane}
							props={props}
							onStep={onStep}
						/>
					))}
				</ol>
				{hidden > 0 ? (
					<p className="px-1 text-caption text-muted-foreground" data-testid="taskline-hidden-closed">
						{m.taskline_closed_hidden({ count: formatNumber(hidden), days: formatNumber(props.doneColumnDays) })}
					</p>
				) : null}
				{props.canEdit ? <AddTask status={status} onAdd={(title) => props.onAdd(status, lane, title)} /> : null}
			</section>
		</li>
	);
}

const HANDLE =
	"flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing";

function BoardCard({
	task,
	index,
	group,
	lane,
	props,
	onStep,
}: {
	task: TaskSummary;
	index: number;
	group: string;
	lane: BoardLane;
	props: BoardProps;
	onStep: (task: TaskSummary, direction: Direction) => void;
}) {
	const { ref, handleRef, isDragging } = useSortable({
		id: task.id,
		index,
		group,
		type: `task:${lane.id}`,
		accept: `task:${lane.id}`,
		disabled: !props.canEdit,
	});
	const subtasks = props.allTasks.filter((each) => each.parentId === task.id);
	const subtasksDone = subtasks.filter((each) => each.completedAt !== null).length;
	const labels = task.labelIds.flatMap((id) => props.labels.find((label) => label.id === id) ?? []);
	const status = props.statuses.find((each) => each.id === task.statusId);
	const closed = status ? isClosedCategory(status.category) : false;

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const direction = STEP_KEYS[event.key];
		if (!event.altKey || !direction) return;
		event.preventDefault();
		onStep(task, direction);
	};

	// A reader's card isn't a sortable: without a handle, dnd-kit would make the whole card a button.
	return (
		<li
			ref={props.canEdit ? ref : undefined}
			className={cn(
				"flex flex-col gap-1.5 rounded-md border bg-background p-2 shadow-xs",
				isDragging && "z-10 opacity-80 shadow-lg",
			)}
			data-testid="taskline-card"
		>
			<div className="flex items-start gap-1">
				{props.canEdit ? (
					<button
						ref={handleRef}
						type="button"
						aria-label={m.taskline_move_task({ task: task.title })}
						aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
						onKeyDown={onKeyDown}
						className={HANDLE}
						data-testid="taskline-card-handle"
					>
						<GripVerticalIcon className="size-4" aria-hidden />
					</button>
				) : null}
				<div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
					<span className="flex items-center gap-1.5 text-caption text-muted-foreground">
						<TaskTypeIcon type={task.type} />
						<span className="font-mono">{task.number > 0 ? task.ref : ""}</span>
						<PriorityIcon priority={task.priority} />
						{task.points !== null ? (
							<span className="rounded-full bg-surface-2 px-1.5 tabular-nums" data-testid="taskline-card-points">
								<span className="sr-only">{m.taskline_field_points()}: </span>
								{formatNumber(task.points)}
							</span>
						) : null}
						{task.blocked && !closed ? <BlockedBadge /> : null}
					</span>
					{props.renderOpen(
						task,
						<span className="text-body text-foreground wrap-anywhere" data-testid="taskline-card-title">
							{task.title}
						</span>,
					)}
				</div>
				<Assignee member={props.members.find((member) => member.id === task.assigneeId)} />
			</div>
			{labels.length > 0 || task.dueOn || subtasks.length > 0 || task.checklist.total > 0 ? (
				<div className={cn("flex flex-wrap items-center gap-1.5", props.canEdit && "ps-8")}>
					{labels.map((label) => (
						<LabelChip key={label.id} label={label} />
					))}
					{task.dueOn ? <DueDate dueOn={task.dueOn} today={props.today} closed={closed} /> : null}
					{subtasks.length > 0 ? (
						<span className="inline-flex items-center gap-1 text-caption text-muted-foreground tabular-nums">
							<ListTreeIcon className="size-3.5" aria-hidden />
							{m.taskline_subtasks_progress({
								done: formatNumber(subtasksDone),
								total: formatNumber(subtasks.length),
							})}
						</span>
					) : null}
					{task.checklist.total > 0 ? (
						<span className="inline-flex items-center gap-1 text-caption text-muted-foreground tabular-nums">
							<ListChecksIcon className="size-3.5" aria-hidden />
							{m.taskline_checklist_progress({
								done: formatNumber(task.checklist.done),
								total: formatNumber(task.checklist.total),
							})}
						</span>
					) : null}
				</div>
			) : null}
		</li>
	);
}

/** "Add task" at a column's foot: a title, Enter adds it at the end (the field stays open for the next). */
function AddTask({ status, onAdd }: { status: TasklineStatus; onAdd: (title: string) => void }) {
	const [open, setOpen] = useState(false);
	const inputId = useId();
	if (!open) {
		return (
			<Button
				variant="ghost"
				size="sm"
				className="justify-start text-muted-foreground"
				onClick={() => setOpen(true)}
				data-testid="taskline-add-task-open"
			>
				<PlusIcon aria-hidden />
				{m.taskline_add_task()}
			</Button>
		);
	}
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		const value = String(new FormData(form).get("title") ?? "").trim();
		if (!value) return;
		onAdd(value);
		form.reset();
	};
	return (
		<form method="post" onSubmit={onSubmit} className="flex flex-col gap-2" data-testid="taskline-add-task">
			<label htmlFor={inputId} className="sr-only">
				{m.taskline_new_task_in({ status: status.name })}
			</label>
			<Input
				id={inputId}
				name="title"
				placeholder={m.taskline_new_task_placeholder()}
				maxLength={TASK_TITLE_MAX}
				autoComplete="off"
				// The field was just opened by the button the user pressed.
				autoFocus
				onKeyDown={(event) => {
					if (event.key === "Escape") setOpen(false);
				}}
			/>
			<div className="flex gap-2">
				<Button type="submit" size="sm">
					{m.taskline_add()}
				</Button>
				<Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
					{m.common_cancel()}
				</Button>
			</div>
		</form>
	);
}
