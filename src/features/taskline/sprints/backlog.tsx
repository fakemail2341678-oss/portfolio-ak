import { Accessibility, type DragEndEvent, type DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { CircleCheckIcon, GripVerticalIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { TASK_TITLE_MAX } from "../schema";
import type { SprintMeasure } from "../search";
import { Assignee, StatusName, TaskTypeIcon } from "../task/task-bits";
import { durationInput, formatDuration, parseDuration } from "../time/duration";
import {
	ESTIMATE_MAX_MINUTES,
	isClosedCategory,
	POINTS_MAX,
	type TasklineMember,
	type TasklineStatus,
	type TaskSummary,
} from "../types";
import { toHours } from "./burndown";
import {
	BACKLOG_SECTION,
	type BacklogSection,
	type RankMove,
	rowDrop,
	rowPlace,
	rowStep,
	sectionEstimate,
	sectionPoints,
} from "./moves";
import { amountText, SprintDates } from "./sprint-bits";

/**
 * The backlog (Task 52): a section per open sprint (the active one first), then the
 * backlog, each in rank order. Three ways to move a task, from its handle, as on the
 * board (0188): drag it; dnd-kit's keyboard drag (Space, the arrows, Space); or Alt + ↑
 * ↓, which moves it one place at once and, past a section's edge, into the next
 * section. Every move is announced. Editors set points (or, estimating in time, the estimate) in the row.
 */

export type BacklogProps = {
	sections: ReadonlyArray<BacklogSection>;
	statuses: ReadonlyArray<TasklineStatus>;
	members: ReadonlyArray<TasklineMember>;
	/** What the totals count: points or estimated hours (the project's estimation), or tasks. */
	measure: SprintMeasure;
	/** The recent velocity in the measure, to compare a sprint's plan with (null: none yet). */
	velocity: number | null;
	canEdit: boolean;
	onMove: (task: TaskSummary, move: RankMove) => void;
	onPoints: (task: TaskSummary, points: number | null) => void;
	/** Task 53: an estimate in minutes, typed in the row when the project estimates in time. */
	onEstimate?: (task: TaskSummary, minutes: number | null) => void;
	onAdd: (title: string) => void;
	/** The task's title as a link that opens it (the sheet over the backlog). */
	renderOpen: (task: TaskSummary, children: ReactNode) => ReactNode;
	/** A sprint's buttons (start, complete, edit, delete, report). */
	renderActions: (section: BacklogSection) => ReactNode;
};

export function Backlog(props: BacklogProps) {
	const { sections, onMove } = props;
	const [announcement, setAnnouncement] = useState("");
	const all = sections.flatMap((section) => section.tasks);
	const taskById = (id: unknown) => all.find((task) => task.id === id);
	const sectionName = (section: BacklogSection | undefined) => section?.sprint?.name ?? m.taskline_backlog_section();

	const move = (task: TaskSummary, next: RankMove) => {
		const place = rowPlace(sections, task.id, next);
		onMove(task, next);
		setAnnouncement(
			m.taskline_task_moved({
				task: task.title,
				status: sectionName(place.section),
				position: formatNumber(place.index + 1),
				total: formatNumber(place.total),
			}),
		);
	};

	const step = (task: TaskSummary, direction: "up" | "down") => {
		const next = rowStep(sections, task.id, direction);
		if (next) move(task, next);
	};

	return (
		<DragDropProvider
			plugins={(defaults) => [
				...defaults,
				Accessibility.configure({
					screenReaderInstructions: { draggable: m.taskline_backlog_drag_instructions() },
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
				if (!task) return;
				// Dropped on a section itself (an empty one, or its foot): the end of that section.
				if (target && target.type === "section" && typeof target.id === "string" && target.id !== source.group) {
					const next = rowDrop(sections, task.id, target.id, Number.POSITIVE_INFINITY);
					if (next) move(task, next);
					return;
				}
				if (typeof source.group !== "string") return;
				const next = rowDrop(sections, task.id, source.group, source.index);
				if (next) move(task, next);
			}}
		>
			<div className="flex flex-col gap-6" data-testid="taskline-backlog">
				{sections.map((section) => (
					<Section key={section.id} section={section} props={props} onStep={step} />
				))}
			</div>
			<p className="sr-only" aria-live="polite" data-testid="taskline-announcement">
				{announcement}
			</p>
		</DragDropProvider>
	);
}

function Section({
	section,
	props,
	onStep,
}: {
	section: BacklogSection;
	props: BacklogProps;
	onStep: (task: TaskSummary, direction: "up" | "down") => void;
}) {
	const { ref } = useDroppable({ id: section.id, type: "section", accept: "task", collisionPriority: 1 });
	const headingId = useId();
	const { sprint } = section;
	const sum = sectionPoints(section.tasks);
	const estimated = sectionEstimate(section.tasks);
	const total =
		props.measure === "points"
			? sum.points
			: props.measure === "hours"
				? toHours(estimated.minutes)
				: section.tasks.length;
	const unestimated =
		props.measure === "points" ? sum.unestimated : props.measure === "hours" ? estimated.unestimated : 0;
	const over = sprint !== null && props.velocity !== null && total > props.velocity;
	return (
		<section
			aria-labelledby={headingId}
			className={cn("flex flex-col gap-3 rounded-lg border p-3", sprint?.state === "active" && "border-primary/40")}
			data-testid={sprint ? "backlog-sprint" : "backlog-section"}
			data-state={sprint?.state}
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 id={headingId} className="flex flex-wrap items-center gap-2 font-medium text-body">
						{sprint ? sprint.name : m.taskline_backlog_section()}
						{sprint?.state === "active" ? (
							<span className="rounded-full bg-primary/10 px-2 text-caption text-primary">
								{m.taskline_sprint_state_active()}
							</span>
						) : null}
					</h2>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						{sprint ? <SprintDates sprint={sprint} /> : null}
						<span className="text-caption text-muted-foreground tabular-nums" data-testid="backlog-total">
							{amountText(total, props.measure)}
							{unestimated > 0 ? ` · ${m.taskline_backlog_unestimated({ count: formatNumber(unestimated) })}` : ""}
						</span>
						{over && props.velocity !== null ? (
							<span className="inline-flex items-center gap-1 text-caption text-warning" data-testid="backlog-over">
								<TriangleAlertIcon className="size-3.5" aria-hidden />
								{m.taskline_backlog_over_velocity({ value: formatNumber(props.velocity) })}
							</span>
						) : null}
					</div>
					{sprint?.goal ? <p className="text-caption text-muted-foreground">{sprint.goal}</p> : null}
				</div>
				<div className="flex flex-wrap items-center gap-2">{props.renderActions(section)}</div>
			</header>
			<ol ref={ref} className="flex min-h-10 flex-col divide-y rounded-md border bg-background">
				{section.tasks.map((task, index) => (
					<Row key={task.id} task={task} index={index} section={section} props={props} onStep={onStep} />
				))}
				{section.tasks.length === 0 ? (
					<li className="px-3 py-3 text-caption text-muted-foreground">
						{sprint ? m.taskline_backlog_sprint_empty() : m.taskline_backlog_empty()}
					</li>
				) : null}
			</ol>
			{section.id === BACKLOG_SECTION && props.canEdit ? <AddToBacklog onAdd={props.onAdd} /> : null}
		</section>
	);
}

const HANDLE =
	"flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing";

function Row({
	task,
	index,
	section,
	props,
	onStep,
}: {
	task: TaskSummary;
	index: number;
	section: BacklogSection;
	props: BacklogProps;
	onStep: (task: TaskSummary, direction: "up" | "down") => void;
}) {
	const { ref, handleRef, isDragging } = useSortable({
		id: task.id,
		index,
		group: section.id,
		type: "task",
		accept: "task",
		disabled: !props.canEdit,
	});
	const status = props.statuses.find((each) => each.id === task.statusId);
	const closed = status ? isClosedCategory(status.category) : false;
	const editable = props.canEdit && task.number > 0;

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
		event.preventDefault();
		onStep(task, event.key === "ArrowUp" ? "up" : "down");
	};

	// A reader's row isn't a sortable: without a handle, dnd-kit would make the whole row a button.
	return (
		<li
			ref={editable ? ref : undefined}
			className={cn("flex items-center gap-2 px-2 py-1.5", isDragging && "relative z-10 bg-background shadow-lg")}
			data-testid="backlog-row"
		>
			{editable ? (
				<button
					ref={handleRef}
					type="button"
					aria-label={m.taskline_move_task({ task: task.title })}
					aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
					onKeyDown={onKeyDown}
					className={HANDLE}
					data-testid="backlog-handle"
				>
					<GripVerticalIcon className="size-4" aria-hidden />
				</button>
			) : null}
			<TaskTypeIcon type={task.type} />
			<span className="w-16 shrink-0 font-mono text-caption text-muted-foreground">
				{task.number > 0 ? task.ref : ""}
			</span>
			<span className={cn("flex min-w-0 flex-1 items-center gap-1.5", closed && "text-muted-foreground")}>
				{closed ? <CircleCheckIcon className="size-3.5 shrink-0 text-success" aria-hidden /> : null}
				{props.renderOpen(
					task,
					<span className={cn("text-body wrap-anywhere", closed && "line-through")} data-testid="backlog-title">
						{task.title}
					</span>,
				)}
			</span>
			{status ? (
				<span className="shrink-0 max-sm:hidden">
					<StatusName status={status} />
				</span>
			) : null}
			<Assignee member={props.members.find((member) => member.id === task.assigneeId)} />
			{props.measure === "hours" ? (
				editable && props.onEstimate ? (
					<EstimateInput task={task} onEstimate={props.onEstimate} />
				) : (
					<span className="w-16 shrink-0 text-end text-caption text-muted-foreground tabular-nums">
						{task.estimateMinutes === null ? "–" : formatDuration(task.estimateMinutes)}
					</span>
				)
			) : editable ? (
				<PointsInput task={task} onPoints={props.onPoints} />
			) : (
				<span className="w-14 shrink-0 text-end text-caption text-muted-foreground tabular-nums">
					{task.points === null ? "–" : formatNumber(task.points)}
				</span>
			)}
		</li>
	);
}

/** A task's points, saved when the field is left or Enter is pressed; empty clears them. */
function PointsInput({ task, onPoints }: { task: TaskSummary; onPoints: BacklogProps["onPoints"] }) {
	const commit = (raw: string) => {
		const value = raw.trim() === "" ? null : Number(raw);
		if (value !== null && (!Number.isInteger(value) || value < 0 || value > POINTS_MAX)) return;
		if (value !== task.points) onPoints(task, value);
	};
	return (
		<Input
			// A new value from the server (or a rollback) resets the field.
			key={String(task.points)}
			type="number"
			inputMode="numeric"
			min={0}
			max={POINTS_MAX}
			step={1}
			defaultValue={task.points ?? ""}
			aria-label={m.taskline_points_for({ task: task.title })}
			placeholder="–"
			className="h-8 w-16 shrink-0 text-end tabular-nums"
			onBlur={(event) => commit(event.currentTarget.value)}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit(event.currentTarget.value);
				}
			}}
			data-testid="backlog-points"
		/>
	);
}

/** "Add task" at the backlog's foot: a title, Enter adds it last (the field stays open for the next). */
function AddToBacklog({ onAdd }: { onAdd: (title: string) => void }) {
	const [open, setOpen] = useState(false);
	const inputId = useId();
	if (!open) {
		return (
			<Button
				variant="ghost"
				size="sm"
				className="self-start text-muted-foreground"
				onClick={() => setOpen(true)}
				data-testid="backlog-add-open"
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
		<form method="post" onSubmit={onSubmit} className="flex flex-wrap gap-2" data-testid="backlog-add">
			<label htmlFor={inputId} className="sr-only">
				{m.taskline_backlog_new_task()}
			</label>
			<Input
				id={inputId}
				name="title"
				placeholder={m.taskline_new_task_placeholder()}
				maxLength={TASK_TITLE_MAX}
				autoComplete="off"
				className="min-w-48 flex-1"
				// The field was just opened by the button the user pressed.
				autoFocus
				onKeyDown={(event) => {
					if (event.key === "Escape") setOpen(false);
				}}
			/>
			<Button type="submit" size="sm">
				{m.taskline_add()}
			</Button>
			<Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
				{m.common_cancel()}
			</Button>
		</form>
	);
}

/** A task's estimate as a duration ("1h 30m", "2", "1:30"), saved when the field is left or Enter is pressed. */
function EstimateInput({
	task,
	onEstimate,
}: {
	task: TaskSummary;
	onEstimate: NonNullable<BacklogProps["onEstimate"]>;
}) {
	const [invalid, setInvalid] = useState(false);
	const commit = (raw: string) => {
		const text = raw.trim();
		const minutes = text === "" ? null : parseDuration(text, ESTIMATE_MAX_MINUTES);
		if (text !== "" && minutes === null) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		if (minutes !== task.estimateMinutes) onEstimate(task, minutes);
	};
	return (
		<Input
			key={String(task.estimateMinutes)}
			defaultValue={task.estimateMinutes === null ? "" : durationInput(task.estimateMinutes)}
			aria-label={m.taskline_estimate_for({ task: task.title })}
			aria-invalid={invalid || undefined}
			placeholder="–"
			autoComplete="off"
			className="h-8 w-20 shrink-0 text-end tabular-nums"
			onBlur={(event) => commit(event.currentTarget.value)}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit(event.currentTarget.value);
				}
			}}
			data-testid="backlog-estimate"
		/>
	);
}
