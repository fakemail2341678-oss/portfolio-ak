import { BanIcon, ChevronLeftIcon, ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDayMonth, formatMonthShort, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { TaskTypeIcon } from "../task/task-bits";
import type { Dependency, Milestone, TaskSummary } from "../types";
import {
	type Arrow,
	arrowsOf,
	type Bar,
	barOf,
	conflicts,
	DAY_WIDTH,
	dependencyKey,
	dragDays,
	GROUP_HEIGHT,
	ROW_HEIGHT,
	rangeWidth,
	restDays,
	shiftDates,
	spanOf,
	type TimelineGroup,
	type TimelineRange,
	ticksOf,
	xOf,
} from "./layout";

/**
 * Taskline's timeline (Task 54): a row per task with a bar from its start to its due
 * date, over the days of the range (the grid, the days off, today's line and the
 * dependency arrows are one SVG behind the rows), the milestones as diamonds on their
 * day, and a visually hidden table with the same facts. Rescheduling, from a bar:
 * - drag it to move it, or drag its end to change its last day;
 * - Alt + ← → moves it a day, Alt + Shift + ← → changes its last day (a task without
 *   dates is scheduled on the day shown).
 * Every change is announced. The timeline only reports changes (`onChange`); the page saves them.
 */

export type TimelineRowGroup = TimelineGroup & {
	/** The group's heading; null when there's no grouping. */
	label: string | null;
	/** The milestone a milestone group is about (its diamond goes on the heading row). */
	milestone?: Milestone | null;
};

export type TimelineProps = {
	range: TimelineRange;
	today: string;
	/** The day a task without dates is scheduled on by keyboard. */
	anchor: string;
	weekStart: number;
	workingDays: ReadonlyArray<number>;
	groups: ReadonlyArray<TimelineRowGroup>;
	milestones: ReadonlyArray<Milestone>;
	/** The project's dependencies; arrows are drawn between the bars shown. */
	dependencies: ReadonlyArray<Dependency>;
	/** Every task of the project (a blocker's name when it's filtered out). */
	allTasks: ReadonlyArray<TaskSummary>;
	canEdit: boolean;
	onChange: (task: TaskSummary, dates: { startOn: string | null; dueOn: string | null }) => void;
	/** A bar clicked (or Enter on it): open the task. */
	onOpen: (task: TaskSummary) => void;
	/** The task's title in its row as a link that opens it. */
	renderOpen: (task: TaskSummary, children: ReactNode) => ReactNode;
};

/** The row headings' column. */
const LABEL_WIDTH = 176;
const HEADER_HEIGHT = 48;
const MILESTONE_ROW = 32;

const shortDate = (day: string) => formatDayMonth(day);
const fullDate = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "full" });

type Drag = { id: string; mode: "move" | "resize"; startX: number; days: number; moved: boolean };

export function Timeline(props: TimelineProps) {
	const { range, groups, canEdit, onChange, anchor } = props;
	const [announcement, setAnnouncement] = useState("");
	const [focusId, setFocusId] = useState<string | null>(null);
	const [drag, setDrag] = useState<Drag | null>(null);
	const dragged = useRef(false);
	const labelId = useId();
	const width = rangeWidth(range);
	const dayWidth = DAY_WIDTH[range.zoom];
	const shown = groups.flatMap((group) => group.tasks);
	const byId = new Map(props.allTasks.map((task) => [task.id, task]));
	const clashes = conflicts(props.dependencies, props.allTasks);
	const clashKeys = new Set(clashes.map(dependencyKey));
	const grouped = groups.some((group) => group.label !== null);
	const dated = props.milestones.filter((milestone) => milestone.dueOn !== null);

	/** What a task looks like now: its dates, or the dates a drag in progress gives it. */
	const datesOf = (task: TaskSummary) =>
		drag?.id === task.id && drag.days !== 0 ? shiftDates(task, drag.days, drag.mode, anchor) : task;

	// Where each row's middle is, for the arrows.
	const rows = new Map<string, { y: number; bar: Bar }>();
	let y = 0;
	for (const group of groups) {
		if (group.label !== null) y += GROUP_HEIGHT;
		for (const task of group.tasks) {
			const bar = barOf(datesOf(task), range);
			if (bar) rows.set(task.id, { y: y + ROW_HEIGHT / 2, bar });
			y += ROW_HEIGHT;
		}
	}
	const bodyHeight = y;
	const arrows = arrowsOf(props.dependencies, rows, clashKeys);
	const { months, ticks } = ticksOf(range, props.weekStart);
	const rest = restDays(range, props.workingDays);
	const todayX = props.today >= range.from && props.today <= range.to ? xOf(range, props.today) : null;

	const change = (task: TaskSummary, dates: { startOn: string | null; dueOn: string | null }, keyboard: boolean) => {
		if (dates.startOn === task.startOn && dates.dueOn === task.dueOn) return;
		onChange(task, dates);
		if (keyboard) setFocusId(task.id);
		const span = spanOf(dates);
		if (span) {
			setAnnouncement(
				m.taskline_timeline_moved({
					task: `${task.ref} ${task.title}`,
					from: fullDate(span.start),
					to: fullDate(span.end),
				}),
			);
		}
	};

	const onKeyDown = (task: TaskSummary, event: KeyboardEvent<HTMLButtonElement>) => {
		if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
		event.preventDefault();
		const days = event.key === "ArrowLeft" ? -1 : 1;
		change(task, shiftDates(task, days, event.shiftKey ? "resize" : "move", anchor), true);
	};

	const onPointerDown = (task: TaskSummary, mode: Drag["mode"], event: PointerEvent<HTMLElement>) => {
		if (!canEdit || event.button !== 0) return;
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		setDrag({ id: task.id, mode, startX: event.clientX, days: 0, moved: false });
	};
	const onPointerMove = (event: PointerEvent<HTMLElement>) => {
		if (!drag) return;
		const pixels = event.clientX - drag.startX;
		setDrag({ ...drag, days: dragDays(range, pixels), moved: drag.moved || Math.abs(pixels) > 3 });
	};
	const onPointerUp = (task: TaskSummary) => {
		if (!drag) return;
		if (drag.moved) {
			dragged.current = true;
			if (drag.days !== 0) change(task, shiftDates(task, drag.days, drag.mode, anchor), false);
		}
		setDrag(null);
	};

	// A keyboard change can move the row (rows read earliest first): its bar takes the focus back.
	useEffect(() => {
		if (!focusId) return;
		const bar = document.querySelector<HTMLElement>(`[data-timeline-bar="${focusId}"]`);
		if (bar && document.activeElement !== bar) bar.focus();
		setFocusId(null);
	}, [focusId]);

	const blockersOf = (task: TaskSummary) =>
		props.dependencies
			.filter((dependency) => dependency.blockedId === task.id)
			.flatMap((dependency) => {
				const blocker = byId.get(dependency.blockerId);
				return blocker ? [blocker] : [];
			});
	const clashesOf = (task: TaskSummary) =>
		clashes.flatMap((clash) => {
			const blocker = clash.blockedId === task.id ? byId.get(clash.blockerId) : undefined;
			return blocker ? [blocker] : [];
		});

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<h2 id={labelId} className="sr-only">
				{m.taskline_timeline_label()}
			</h2>
			<ScrollRegion label={m.taskline_timeline_label()} className="rounded-lg border" data-testid="taskline-timeline">
				<div className="relative" style={{ width: LABEL_WIDTH + width }}>
					<div className="flex border-b bg-surface-1" style={{ height: HEADER_HEIGHT }}>
						<div
							className="sticky left-0 z-20 flex shrink-0 items-end border-e bg-surface-1 px-3 pb-1.5 font-medium text-caption text-muted-foreground"
							style={{ width: LABEL_WIDTH }}
						>
							{m.taskline_timeline_task()}
						</div>
						<div className="relative" style={{ width }} aria-hidden>
							{months.map((month) => (
								<span
									key={month.month}
									className="absolute top-0 truncate border-s px-1.5 pt-1 text-caption font-medium"
									style={{ left: month.x, width: month.width }}
								>
									{formatMonthShort(month.month)}
									{range.zoom === "month"
										? null
										: ` ${formatNumber(Number(month.month.slice(0, 4)), { useGrouping: false })}`}
								</span>
							))}
							{ticks.map((tick) => (
								<span
									key={tick.day}
									className={cn(
										"absolute bottom-0 border-s pb-1 ps-1 text-caption tabular-nums text-muted-foreground",
										tick.day === props.today && "font-semibold text-foreground",
									)}
									style={{ left: tick.x, width: range.zoom === "day" ? dayWidth : dayWidth * 7 }}
								>
									{formatNumber(Number(tick.day.slice(8)))}
								</span>
							))}
						</div>
					</div>
					{dated.length > 0 ? (
						<div className="flex border-b" style={{ height: MILESTONE_ROW }} data-testid="timeline-milestones">
							<div
								className="sticky left-0 z-10 flex shrink-0 items-center border-e bg-background px-3 text-caption text-muted-foreground"
								style={{ width: LABEL_WIDTH }}
							>
								{m.taskline_view_milestones()}
							</div>
							<div className="relative" style={{ width }} aria-hidden>
								{dated.map((milestone) => (
									<MilestoneDiamond key={milestone.id} milestone={milestone} range={range} withName />
								))}
							</div>
						</div>
					) : null}
					<div className="relative">
						<svg
							aria-hidden="true"
							focusable="false"
							className="pointer-events-none absolute top-0"
							style={{ left: LABEL_WIDTH }}
							width={width}
							height={Math.max(bodyHeight, 1)}
						>
							<defs>
								<marker
									id={`${labelId}-arrow`}
									viewBox="0 0 8 8"
									refX="7"
									refY="4"
									markerWidth="7"
									markerHeight="7"
									orient="auto-start-reverse"
								>
									<path d="M 0 0 L 8 4 L 0 8 z" className="fill-muted-foreground" />
								</marker>
								<marker
									id={`${labelId}-clash`}
									viewBox="0 0 8 8"
									refX="7"
									refY="4"
									markerWidth="7"
									markerHeight="7"
									orient="auto-start-reverse"
								>
									<path d="M 0 0 L 8 4 L 0 8 z" className="fill-danger" />
								</marker>
							</defs>
							{rest.map((day) => (
								<rect key={day.day} x={day.x} y={0} width={dayWidth} height={bodyHeight} className="fill-surface-1" />
							))}
							{ticks.map((tick) => (
								<line
									key={tick.day}
									x1={tick.x}
									x2={tick.x}
									y1={0}
									y2={bodyHeight}
									className="stroke-border"
									strokeWidth={1}
								/>
							))}
							{months.map((month) => (
								<line
									key={month.month}
									x1={month.x}
									x2={month.x}
									y1={0}
									y2={bodyHeight}
									className="stroke-border"
									strokeWidth={1}
								/>
							))}
							{todayX === null ? null : (
								<line
									x1={todayX + dayWidth / 2}
									x2={todayX + dayWidth / 2}
									y1={0}
									y2={bodyHeight}
									className="stroke-primary"
									strokeWidth={2}
									data-testid="timeline-today"
								/>
							)}
							{arrows.map((arrow: Arrow) => (
								<path
									key={dependencyKey(arrow)}
									d={arrow.path}
									fill="none"
									strokeWidth={1.5}
									className={arrow.conflict ? "stroke-danger" : "stroke-muted-foreground"}
									markerEnd={`url(#${labelId}-${arrow.conflict ? "clash" : "arrow"})`}
									data-testid="timeline-arrow"
									data-conflict={arrow.conflict || undefined}
								/>
							))}
						</svg>
						{groups.map((group) => (
							<div key={group.key}>
								{group.label === null ? null : (
									<div
										className="flex border-b bg-surface-1"
										style={{ height: GROUP_HEIGHT }}
										data-testid="timeline-group"
									>
										<div
											className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-e bg-surface-1 px-3 font-medium text-caption"
											style={{ width: LABEL_WIDTH }}
										>
											<span className="truncate">{group.label}</span>
											<span className="text-muted-foreground tabular-nums">{formatNumber(group.tasks.length)}</span>
										</div>
										<div className="relative" style={{ width }} aria-hidden>
											{group.milestone?.dueOn ? <MilestoneDiamond milestone={group.milestone} range={range} /> : null}
										</div>
									</div>
								)}
								{group.tasks.map((task) => (
									<TimelineRow
										key={task.id}
										task={task}
										dates={datesOf(task)}
										props={props}
										width={width}
										blocked={task.blocked}
										clashes={clashesOf(task)}
										dragging={drag?.id === task.id}
										onKeyDown={onKeyDown}
										onPointerDown={onPointerDown}
										onPointerMove={onPointerMove}
										onPointerUp={onPointerUp}
										onClick={() => {
											if (dragged.current) {
												dragged.current = false;
												return;
											}
											props.onOpen(task);
										}}
									/>
								))}
							</div>
						))}
						{shown.length === 0 ? (
							<p className="sticky left-0 px-3 py-6 text-body text-muted-foreground" style={{ width: LABEL_WIDTH * 2 }}>
								{m.taskline_timeline_empty()}
							</p>
						) : null}
					</div>
				</div>
			</ScrollRegion>
			{grouped || dated.length > 0 || shown.length > 0 ? (
				<TimelineTable
					tasks={shown}
					milestones={dated}
					blockersOf={blockersOf}
					clashesOf={clashesOf}
					labelledBy={labelId}
				/>
			) : null}
			<p className="sr-only" aria-live="polite" data-testid="taskline-announcement">
				{announcement}
			</p>
		</div>
	);
}

function MilestoneDiamond({
	milestone,
	range,
	withName = false,
}: {
	milestone: Milestone;
	range: TimelineRange;
	withName?: boolean;
}) {
	if (!milestone.dueOn || milestone.dueOn < range.from || milestone.dueOn > range.to) return null;
	const x = xOf(range, milestone.dueOn) + DAY_WIDTH[range.zoom] / 2;
	return (
		<span
			className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap"
			style={{ left: x - 6 }}
			title={`${milestone.name} · ${shortDate(milestone.dueOn)}`}
			data-testid="timeline-milestone"
		>
			<span
				className={cn(
					"size-3 shrink-0 rotate-45 rounded-[2px] border-2",
					milestone.completedAt ? "border-success bg-success" : "border-primary bg-background",
				)}
			/>
			{withName ? <span className="text-caption text-muted-foreground">{milestone.name}</span> : null}
		</span>
	);
}

function TimelineRow({
	task,
	dates,
	props,
	width,
	blocked,
	clashes,
	dragging,
	onKeyDown,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onClick,
}: {
	task: TaskSummary;
	dates: { startOn: string | null; dueOn: string | null };
	props: TimelineProps;
	width: number;
	blocked: boolean;
	clashes: ReadonlyArray<TaskSummary>;
	dragging: boolean;
	onKeyDown: (task: TaskSummary, event: KeyboardEvent<HTMLButtonElement>) => void;
	onPointerDown: (task: TaskSummary, mode: "move" | "resize", event: PointerEvent<HTMLElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLElement>) => void;
	onPointerUp: (task: TaskSummary) => void;
	onClick: () => void;
}) {
	const { range, canEdit } = props;
	const dayWidth = DAY_WIDTH[range.zoom];
	const bar = barOf(dates, range);
	const span = spanOf(dates);
	const closed = task.completedAt !== null;
	// Without dates, the bar is a placeholder on the day an Alt + arrow would schedule it.
	const placeholder = bar === null;
	const x = bar
		? bar.place === "after"
			? width - dayWidth
			: bar.place === "before"
				? 0
				: bar.x
		: xOf(props.range, props.anchor);
	const barWidth = bar && bar.place === "in" ? Math.max(bar.width, dayWidth) : dayWidth;
	const label = span
		? m.taskline_timeline_bar({
				task: `${task.ref} ${task.title}`,
				from: shortDate(span.start),
				to: shortDate(span.end),
			})
		: m.taskline_timeline_bar_undated({ task: `${task.ref} ${task.title}` });
	const barClass = cn(
		"absolute top-1.5 flex h-6 items-center overflow-hidden rounded-md px-1.5 text-caption",
		placeholder
			? "border border-dashed border-muted-foreground/60 bg-background"
			: closed
				? "bg-muted text-muted-foreground"
				: "bg-primary text-primary-foreground",
		bar?.cutStart && "rounded-s-none",
		bar?.cutEnd && "rounded-e-none",
		dragging && "z-10 opacity-80 shadow-lg",
	);
	const inside =
		bar && bar.place !== "in" ? (
			bar.place === "before" ? (
				<ChevronLeftIcon className="size-3.5 shrink-0" aria-hidden />
			) : (
				<ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
			)
		) : (
			<span className={cn("truncate", closed && "line-through")}>
				{barWidth >= 48 && !placeholder ? task.title : null}
			</span>
		);
	const outOfRange = bar && bar.place !== "in";
	const placeX = outOfRange ? x : undefined;
	return (
		<div
			className="flex border-b last:border-b-0"
			style={{ height: ROW_HEIGHT }}
			data-testid="timeline-row"
			data-task={task.ref}
		>
			<div
				className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-e bg-background px-2 text-caption"
				style={{ width: LABEL_WIDTH }}
			>
				<TaskTypeIcon type={task.type} />
				{props.renderOpen(
					task,
					<span className={cn("min-w-0 truncate", closed && "text-muted-foreground line-through")}>
						<span className="sr-only">{`${task.ref} `}</span>
						{task.title}
					</span>,
				)}
				{blocked ? (
					<span
						className="ms-auto inline-flex text-warning"
						title={m.taskline_blocked()}
						data-testid="timeline-blocked"
					>
						<BanIcon className="size-3.5" aria-hidden />
						<span className="sr-only">{m.taskline_blocked()}</span>
					</span>
				) : null}
				{clashes.length > 0 ? (
					<span
						className={cn("inline-flex text-danger", !blocked && "ms-auto")}
						title={m.taskline_timeline_clash({ tasks: clashes.map((each) => each.ref).join(", ") })}
						data-testid="timeline-clash"
					>
						<TriangleAlertIcon className="size-3.5" aria-hidden />
						<span className="sr-only">
							{m.taskline_timeline_clash({ tasks: clashes.map((each) => each.ref).join(", ") })}
						</span>
					</span>
				) : null}
			</div>
			<div className="relative" style={{ width }}>
				{canEdit ? (
					<button
						type="button"
						className={cn(
							barClass,
							"cursor-grab touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing",
						)}
						style={{ left: placeX ?? x, width: barWidth }}
						aria-label={label}
						aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
						onKeyDown={(event) => onKeyDown(task, event)}
						onPointerDown={(event) => onPointerDown(task, "move", event)}
						onPointerMove={onPointerMove}
						onPointerUp={() => onPointerUp(task)}
						onPointerCancel={() => onPointerUp(task)}
						onClick={onClick}
						data-timeline-bar={task.id}
						data-testid="timeline-bar"
						data-start={span?.start}
						data-end={span?.end}
					>
						{inside}
						{bar && bar.place === "in" && !bar.cutEnd ? (
							<span
								className="absolute inset-y-0 end-0 w-2 cursor-ew-resize"
								onPointerDown={(event) => onPointerDown(task, "resize", event)}
								onPointerMove={onPointerMove}
								onPointerUp={() => onPointerUp(task)}
								aria-hidden
							/>
						) : null}
					</button>
				) : placeholder ? null : (
					<span
						className={barClass}
						style={{ left: x, width: barWidth }}
						aria-hidden
						data-testid="timeline-bar"
						data-start={span?.start}
						data-end={span?.end}
					>
						{inside}
					</span>
				)}
			</div>
		</div>
	);
}

/** The timeline as a table, for screen readers (the drawing is hidden from them). */
function TimelineTable({
	tasks,
	milestones,
	blockersOf,
	clashesOf,
	labelledBy,
}: {
	tasks: ReadonlyArray<TaskSummary>;
	milestones: ReadonlyArray<Milestone>;
	blockersOf: (task: TaskSummary) => TaskSummary[];
	clashesOf: (task: TaskSummary) => TaskSummary[];
	labelledBy: string;
}) {
	const day = (value: string | null) => (value ? fullDate(value) : m.taskline_timeline_no_date());
	return (
		// sr-only clips the tables, so a long title can't widen the page (design-system.md).
		<div className="sr-only">
			<table aria-labelledby={labelledBy}>
				<thead>
					<tr>
						<th scope="col">{m.taskline_timeline_task()}</th>
						<th scope="col">{m.taskline_field_start()}</th>
						<th scope="col">{m.taskline_field_due()}</th>
						<th scope="col">{m.taskline_dependencies_blocked_by()}</th>
						<th scope="col">{m.taskline_timeline_warning()}</th>
					</tr>
				</thead>
				<tbody>
					{tasks.map((task) => {
						const clashes = clashesOf(task);
						return (
							<tr key={task.id}>
								<th scope="row">{`${task.ref} ${task.title}`}</th>
								<td>{day(task.startOn)}</td>
								<td>{day(task.dueOn)}</td>
								<td>
									{blockersOf(task)
										.map((blocker) => blocker.ref)
										.join(", ")}
								</td>
								<td>
									{clashes.length > 0
										? m.taskline_timeline_clash({ tasks: clashes.map((each) => each.ref).join(", ") })
										: ""}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{milestones.length > 0 ? (
				<table>
					<caption>{m.taskline_view_milestones()}</caption>
					<thead>
						<tr>
							<th scope="col">{m.taskline_milestone_name()}</th>
							<th scope="col">{m.taskline_field_due()}</th>
						</tr>
					</thead>
					<tbody>
						{milestones.map((milestone) => (
							<tr key={milestone.id}>
								<th scope="row">
									{milestone.completedAt ? m.taskline_milestone_done_name({ name: milestone.name }) : milestone.name}
								</th>
								<td>{day(milestone.dueOn)}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
		</div>
	);
}
