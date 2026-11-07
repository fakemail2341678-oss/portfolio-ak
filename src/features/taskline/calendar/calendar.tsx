import { Accessibility, type DragEndEvent, type DragStartEvent } from "@dnd-kit/dom";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { GripVerticalIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";
import { addDays, isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { PriorityIcon, TaskTypeIcon } from "../task/task-bits";
import { isClosedCategory, type TasklineStatus, type TaskSummary } from "../types";

/**
 * Taskline's calendar (Task 51): a month or a week of days, a task on the day of its
 * due date (or its start), and the tasks without one in a list beside it. Three ways
 * to reschedule, from a task's handle:
 * - drag it to a day (or to "No date", which clears it) with a pointer;
 * - keyboard drag (dnd-kit's keyboard sensor): Space picks it up, the arrows move it, Space drops;
 * - Alt + arrows moves it at once: a day left or right, a week up or down; an undated
 *   task is scheduled on the day the calendar shows.
 * Every move is announced. The calendar only reports moves (`onMove`); the page applies them.
 */

export type CalendarProps = {
	/** The rows of days to draw: a month's weeks, or one week. */
	weeks: ReadonlyArray<ReadonlyArray<string>>;
	/** The month being shown ("YYYY-MM"); days outside it are dimmed. Null for a week. */
	month: string | null;
	today: string;
	/** The day undated tasks are scheduled on by keyboard. */
	anchor: string;
	workingDays: ReadonlyArray<number>;
	/** The tasks to place, each on `dayOf(task)`. */
	tasks: ReadonlyArray<TaskSummary>;
	dayOf: (task: TaskSummary) => string | null;
	statuses: ReadonlyArray<TasklineStatus>;
	canEdit: boolean;
	onMove: (task: TaskSummary, day: string | null) => void;
	/** The task's title as a link that opens it (the sheet over the calendar). */
	renderOpen: (task: TaskSummary, children: ReactNode) => ReactNode;
};

/** The undated list's drop target. */
const NO_DATE = "none";

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

const fullDate = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "full" });

export function Calendar(props: CalendarProps) {
	const { weeks, tasks, dayOf, onMove, anchor } = props;
	const [announcement, setAnnouncement] = useState("");
	const [focusId, setFocusId] = useState<string | null>(null);
	const labelId = useId();
	const taskById = (id: unknown) => tasks.find((task) => task.id === id);
	const byDay = new Map<string, TaskSummary[]>();
	const undated: TaskSummary[] = [];
	for (const task of tasks) {
		const day = dayOf(task);
		if (day === null) undated.push(task);
		else byDay.set(day, [...(byDay.get(day) ?? []), task]);
	}

	const move = (task: TaskSummary, day: string | null, keyboard: boolean) => {
		if (day === dayOf(task)) return;
		onMove(task, day);
		if (keyboard) setFocusId(task.id);
		setAnnouncement(
			day === null
				? m.taskline_calendar_cleared({ task: task.title })
				: m.taskline_calendar_moved({ task: task.title, date: fullDate(day) }),
		);
	};

	const step = (task: TaskSummary, key: string) => {
		const days = STEPS[key];
		if (days === undefined) return;
		const day = dayOf(task);
		move(task, day === null ? anchor : addDays(day, days), true);
	};

	// A keyboard move redraws the task in another day: its handle there takes the focus back.
	useEffect(() => {
		if (!focusId) return;
		document.querySelector<HTMLElement>(`[data-calendar-handle="${focusId}"]`)?.focus();
		setFocusId(null);
	}, [focusId]);

	return (
		<DragDropProvider
			plugins={(defaults) => [
				...defaults,
				Accessibility.configure({
					screenReaderInstructions: { draggable: m.taskline_calendar_drag_instructions() },
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
				if (canceled || !source || !target || typeof target.id !== "string") return;
				const task = taskById(source.id);
				if (task) move(task, target.id === NO_DATE ? null : target.id, false);
			}}
		>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
				<div className="min-w-0">
					<h2 id={labelId} className="sr-only">
						{m.taskline_calendar_label()}
					</h2>
					{/* A focusable scroll region: seven columns scroll sideways on narrow screens. */}
					<section
						// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable).
						tabIndex={0}
						aria-labelledby={labelId}
						className="relative overflow-x-auto rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						data-testid="taskline-calendar"
					>
						<table className="w-full min-w-[44rem] table-fixed border-collapse">
							<thead>
								<tr>
									{(weeks[0] ?? []).map((day) => (
										<th
											key={day}
											scope="col"
											className="border-b bg-surface-1 px-2 py-1.5 text-start font-medium text-caption text-muted-foreground"
										>
											{formatWeekdayShort(isoDateInstant(day))}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{weeks.map((week) => (
									<tr key={week[0]}>
										{week.map((day) => (
											<CalendarDay key={day} day={day} tasks={byDay.get(day) ?? []} props={props} onStep={step} />
										))}
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</div>
				<UndatedList tasks={undated} props={props} onStep={step} />
			</div>
			<p className="sr-only" aria-live="polite" data-testid="taskline-announcement">
				{announcement}
			</p>
		</DragDropProvider>
	);
}

function CalendarDay({
	day,
	tasks,
	props,
	onStep,
}: {
	day: string;
	tasks: ReadonlyArray<TaskSummary>;
	props: CalendarProps;
	onStep: (task: TaskSummary, key: string) => void;
}) {
	const { ref, isDropTarget } = useDroppable({ id: day, type: "day", accept: "task", disabled: !props.canEdit });
	const today = day === props.today;
	const outside = props.month !== null && !day.startsWith(props.month);
	const resting = !props.workingDays.includes(isoDateInstant(day).getUTCDay());
	return (
		<td
			ref={ref}
			className={cn(
				"h-28 border-e border-b p-1 align-top last:border-e-0",
				props.month === null && "h-80",
				resting && "bg-surface-1",
				isDropTarget && "bg-primary/10",
			)}
			data-testid="calendar-day"
			data-day={day}
		>
			<div className="flex h-full flex-col gap-1">
				<span
					className={cn(
						"flex size-6 items-center justify-center self-start rounded-full text-caption tabular-nums",
						outside ? "text-muted-foreground" : "font-medium text-foreground",
						today && "bg-primary font-semibold text-primary-foreground",
					)}
				>
					<span aria-hidden>{formatNumber(Number(day.slice(8)))}</span>
					<span className="sr-only">
						{today ? m.taskline_calendar_today_date({ date: fullDate(day) }) : fullDate(day)}
					</span>
				</span>
				{tasks.length > 0 ? (
					<ul className="flex min-w-0 flex-col gap-1">
						{tasks.map((task) => (
							<CalendarTask key={task.id} task={task} props={props} onStep={onStep} />
						))}
					</ul>
				) : null}
			</div>
		</td>
	);
}

function UndatedList({
	tasks,
	props,
	onStep,
}: {
	tasks: ReadonlyArray<TaskSummary>;
	props: CalendarProps;
	onStep: (task: TaskSummary, key: string) => void;
}) {
	const headingId = useId();
	const { ref, isDropTarget } = useDroppable({ id: NO_DATE, type: "day", accept: "task", disabled: !props.canEdit });
	return (
		<section
			ref={ref}
			aria-labelledby={headingId}
			className={cn("flex flex-col gap-2 rounded-lg border p-3", isDropTarget && "bg-primary/10")}
			data-testid="calendar-undated"
		>
			<h2 id={headingId} className="flex items-baseline justify-between gap-2 font-medium text-body">
				{m.taskline_calendar_undated()}
				<span className="text-caption text-muted-foreground tabular-nums">{formatNumber(tasks.length)}</span>
			</h2>
			{tasks.length === 0 ? (
				<p className="text-caption text-muted-foreground">{m.taskline_calendar_undated_empty()}</p>
			) : (
				<ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
					{tasks.map((task) => (
						<CalendarTask key={task.id} task={task} props={props} onStep={onStep} />
					))}
				</ul>
			)}
		</section>
	);
}

const HANDLE =
	"flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing";

function CalendarTask({
	task,
	props,
	onStep,
}: {
	task: TaskSummary;
	props: CalendarProps;
	onStep: (task: TaskSummary, key: string) => void;
}) {
	const { ref, handleRef, isDragging } = useDraggable({ id: task.id, type: "task", disabled: !props.canEdit });
	const status = props.statuses.find((each) => each.id === task.statusId);
	const closed = status ? isClosedCategory(status.category) : false;
	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || STEPS[event.key] === undefined) return;
		event.preventDefault();
		onStep(task, event.key);
	};
	// A reader's task isn't draggable: without a handle, dnd-kit would make the whole item a button.
	return (
		<li
			ref={props.canEdit ? ref : undefined}
			className={cn(
				"flex min-w-0 items-center gap-1 rounded-md border bg-background px-1 py-0.5 text-caption shadow-xs",
				isDragging && "z-10 opacity-80 shadow-lg",
				closed && "text-muted-foreground",
			)}
			data-testid="calendar-task"
		>
			{props.canEdit ? (
				<button
					ref={handleRef}
					type="button"
					aria-label={m.taskline_calendar_move({ task: task.title })}
					aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
					onKeyDown={onKeyDown}
					className={HANDLE}
					data-calendar-handle={task.id}
					data-testid="calendar-task-handle"
				>
					<GripVerticalIcon className="size-3.5" aria-hidden />
				</button>
			) : null}
			<TaskTypeIcon type={task.type} />
			<PriorityIcon priority={task.priority} />
			{props.renderOpen(
				task,
				<span className={cn("min-w-0 truncate", closed && "line-through")}>
					<span className="sr-only">{`${task.ref} `}</span>
					{task.title}
				</span>,
			)}
		</li>
	);
}
