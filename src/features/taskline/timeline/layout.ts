import { addDays, addMonths, monthDays, weekdayOf } from "@/lib/i18n/date-only";
import { monthOf, startOfWeek } from "../calendar/grid";
import type { TimelineGroupBy, TimelineZoom } from "../search";
import type { Dependency, Milestone, TasklineMember, TasklineStatus, TaskSummary } from "../types";

/**
 * The timeline's geometry (Task 54), pure so it's unit tested and the server and the
 * browser draw the same picture: which days a zoom shows, where a task's bar goes,
 * the rows and their groups, the dependency arrows and the ones that conflict, and
 * what a keyboard step or a drag does to a task's dates. Days are "YYYY-MM-DD".
 */

/** Pixels per day at each zoom. */
export const DAY_WIDTH: Record<TimelineZoom, number> = { day: 32, week: 10, month: 3 };
/** A task's row. */
export const ROW_HEIGHT = 36;
/** A group's heading row. */
export const GROUP_HEIGHT = 32;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export type TimelineRange = { from: string; to: string; days: number; zoom: TimelineZoom };

/**
 * The days a zoom shows around `anchor`: six weeks from the week before (day), half a
 * year from four weeks before (week), or a year from two months before (month).
 */
export function timelineRange(anchor: string, zoom: TimelineZoom, weekStart: number): TimelineRange {
	const from =
		zoom === "day"
			? addDays(startOfWeek(anchor, weekStart), -7)
			: zoom === "week"
				? addDays(startOfWeek(anchor, weekStart), -28)
				: monthDays(addMonths(monthOf(anchor), -2)).first;
	const to =
		zoom === "day"
			? addDays(from, 41)
			: zoom === "week"
				? addDays(from, 26 * 7 - 1)
				: monthDays(addMonths(monthOf(anchor), 9)).last;
	return { from, to, days: daysBetween(from, to) + 1, zoom };
}

/** The anchor `steps` pages on: four weeks (day), thirteen weeks (week) or six months (month). */
export function stepTimeline(anchor: string, zoom: TimelineZoom, steps: number): string {
	if (zoom === "day") return addDays(anchor, steps * 28);
	if (zoom === "week") return addDays(anchor, steps * 91);
	return `${addMonths(monthOf(anchor), steps * 6)}-01`;
}

export const rangeWidth = (range: TimelineRange) => range.days * DAY_WIDTH[range.zoom];

/** The x of a day's start (it may be outside the range). */
export const xOf = (range: TimelineRange, day: string) => daysBetween(range.from, day) * DAY_WIDTH[range.zoom];

/** A task's first and last day: its start and due dates, either standing for both; null when it has neither. */
export function spanOf(task: Pick<TaskSummary, "startOn" | "dueOn">): { start: string; end: string } | null {
	const start = task.startOn ?? task.dueOn;
	const end = task.dueOn ?? task.startOn;
	if (start === null || end === null) return null;
	return start <= end ? { start, end } : { start: end, end: start };
}

export type Bar = {
	start: string;
	end: string;
	x: number;
	width: number;
	/** Where it is: in the range (perhaps cut at an edge), or wholly before or after it. */
	place: "in" | "before" | "after";
	cutStart: boolean;
	cutEnd: boolean;
};

/** Where a task's bar goes in the range; null without dates. */
export function barOf(task: Pick<TaskSummary, "startOn" | "dueOn">, range: TimelineRange): Bar | null {
	const span = spanOf(task);
	if (!span) return null;
	const width = DAY_WIDTH[range.zoom];
	const first = daysBetween(range.from, span.start);
	const last = daysBetween(range.from, span.end);
	const place = last < 0 ? "before" : first >= range.days ? "after" : "in";
	const from = Math.min(Math.max(first, 0), range.days);
	const to = Math.min(Math.max(last + 1, 0), range.days);
	return {
		...span,
		x: from * width,
		width: (to - from) * width,
		place,
		cutStart: first < 0,
		cutEnd: last + 1 > range.days,
	};
}

/** The header: a span per month in the range, and a tick per day (day zoom) or per week (week zoom). */
export function ticksOf(range: TimelineRange, weekStart: number) {
	const width = DAY_WIDTH[range.zoom];
	const months: Array<{ month: string; x: number; width: number }> = [];
	for (let month = monthOf(range.from); month <= monthOf(range.to); month = addMonths(month, 1)) {
		const { first, last } = monthDays(month);
		const from = Math.max(daysBetween(range.from, first), 0);
		const to = Math.min(daysBetween(range.from, last) + 1, range.days);
		months.push({ month, x: from * width, width: (to - from) * width });
	}
	const ticks: Array<{ day: string; x: number }> = [];
	if (range.zoom !== "month") {
		for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
			if (range.zoom === "day" || weekdayOf(day) === weekStart) ticks.push({ day, x: xOf(range, day) });
		}
	}
	return { months, ticks };
}

/** The days off in the range (the workspace's non-working days), shaded at the day and week zooms. */
export function restDays(range: TimelineRange, workingDays: ReadonlyArray<number>): Array<{ day: string; x: number }> {
	if (range.zoom === "month") return [];
	const days: Array<{ day: string; x: number }> = [];
	for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
		if (!workingDays.includes(weekdayOf(day))) days.push({ day, x: xOf(range, day) });
	}
	return days;
}

export type TimelineGroup = {
	key: string;
	kind: TimelineGroupBy;
	/** The epic, milestone or member it's about; null for "none of them" (and for no grouping). */
	id: string | null;
	tasks: TaskSummary[];
};

/** Earliest first, undated last, then by number: the order rows read in. */
const byDates = (a: TaskSummary, b: TaskSummary) => {
	const left = spanOf(a)?.start ?? "~";
	const right = spanOf(b)?.start ?? "~";
	return left < right ? -1 : left > right ? 1 : a.number - b.number;
};

/** The epic a task belongs to: itself, or the nearest epic above it. */
function epicOf(task: TaskSummary, byId: ReadonlyMap<string, TaskSummary>): string | null {
	let current: TaskSummary | undefined = task;
	for (let depth = 0; current && depth < 4; depth++) {
		if (current.type === "epic") return current.id;
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return null;
}

/**
 * The rows: one group (no grouping), or a group per epic (the epic first in its own),
 * milestone (in their order) or assignee (in the members' order), with "none of
 * them" last. Empty groups are left out.
 */
export function timelineGroups(
	tasks: ReadonlyArray<TaskSummary>,
	by: TimelineGroupBy,
	context: {
		milestones: ReadonlyArray<Milestone>;
		members: ReadonlyArray<TasklineMember>;
		all?: ReadonlyArray<TaskSummary>;
	},
): TimelineGroup[] {
	const sorted = [...tasks].sort(byDates);
	if (by === "none") return sorted.length === 0 ? [] : [{ key: "all", kind: "none", id: null, tasks: sorted }];
	const byId = new Map((context.all ?? tasks).map((task) => [task.id, task]));
	const keyOf = (task: TaskSummary): string | null =>
		by === "epic" ? epicOf(task, byId) : by === "milestone" ? task.milestoneId : task.assigneeId;
	const order: Array<string | null> =
		by === "milestone"
			? context.milestones.map((milestone) => milestone.id)
			: by === "assignee"
				? context.members.map((member) => member.id)
				: [...new Set(sorted.flatMap((task) => (task.type === "epic" ? [task.id] : [])))];
	const buckets = new Map<string | null, TaskSummary[]>();
	for (const task of sorted) {
		const key = keyOf(task);
		const known = key !== null && (by === "epic" || order.includes(key)) ? key : null;
		buckets.set(known, [...(buckets.get(known) ?? []), task]);
	}
	const groups: TimelineGroup[] = [];
	for (const id of [...order, ...[...buckets.keys()].filter((key) => key !== null && !order.includes(key)), null]) {
		const rows = buckets.get(id);
		if (!rows || rows.length === 0) continue;
		// An epic leads its own group.
		const lead = by === "epic" && id ? rows.filter((task) => task.id === id) : [];
		groups.push({
			key: id ?? "none",
			kind: by,
			id,
			tasks: [...lead, ...rows.filter((task) => !lead.includes(task))],
		});
	}
	return groups;
}

/**
 * A blocker that ends on or after the day the task it blocks starts: the blocked task
 * would start before its blocker is done. Both need dates.
 */
export function conflicts(
	dependencies: ReadonlyArray<Dependency>,
	tasks: ReadonlyArray<TaskSummary>,
): Array<Dependency & { blockerEnd: string; blockedStart: string }> {
	const byId = new Map(tasks.map((task) => [task.id, task]));
	return dependencies.flatMap((dependency) => {
		const blocker = byId.get(dependency.blockerId);
		const blocked = byId.get(dependency.blockedId);
		const before = blocker ? spanOf(blocker) : null;
		const after = blocked ? spanOf(blocked) : null;
		if (!before || !after || blocker?.completedAt) return [];
		return before.end >= after.start ? [{ ...dependency, blockerEnd: before.end, blockedStart: after.start }] : [];
	});
}

export type Arrow = Dependency & { path: string; conflict: boolean };

/**
 * An arrow from each blocker's end to the start of the task it blocks, for pairs whose
 * bars are both in the range: right, down (or up) and right again, or, when the
 * blocked task starts first, around through the gap above its row.
 */
export function arrowsOf(
	dependencies: ReadonlyArray<Dependency>,
	rows: ReadonlyMap<string, { y: number; bar: Bar }>,
	conflicting: ReadonlySet<string>,
): Arrow[] {
	const gap = 8;
	return dependencies.flatMap((dependency) => {
		const from = rows.get(dependency.blockerId);
		const to = rows.get(dependency.blockedId);
		if (!from || !to || from.bar.place !== "in" || to.bar.place !== "in") return [];
		const sx = from.bar.x + from.bar.width;
		const sy = from.y;
		const tx = to.bar.x;
		const ty = to.y;
		const path =
			tx - sx >= gap * 2
				? `M ${sx} ${sy} H ${sx + gap} V ${ty} H ${tx}`
				: `M ${sx} ${sy} H ${sx + gap} V ${ty + (ty > sy ? -ROW_HEIGHT / 2 : ROW_HEIGHT / 2)} H ${tx - gap} V ${ty} H ${tx}`;
		return [{ ...dependency, path, conflict: conflicting.has(`${dependency.blockerId}>${dependency.blockedId}`) }];
	});
}

export const dependencyKey = (dependency: Dependency) => `${dependency.blockerId}>${dependency.blockedId}`;

/**
 * A task's dates after a keyboard step or a drag of `days`: moving shifts both, resizing
 * moves the last day (never before the first). A task without dates is scheduled on
 * `fallback`, one day long.
 */
export function shiftDates(
	task: Pick<TaskSummary, "startOn" | "dueOn">,
	days: number,
	mode: "move" | "resize",
	fallback: string,
): { startOn: string; dueOn: string } | { startOn: string | null; dueOn: string | null } {
	const span = spanOf(task);
	if (!span) return { startOn: fallback, dueOn: fallback };
	if (mode === "move") {
		return {
			startOn: task.startOn === null ? null : addDays(task.startOn, days),
			dueOn: task.dueOn === null ? null : addDays(task.dueOn, days),
		};
	}
	const end = addDays(span.end, days);
	return { startOn: span.start, dueOn: end < span.start ? span.start : end };
}

/** The days a pointer drag of `pixels` covers at the range's zoom. */
export const dragDays = (range: TimelineRange, pixels: number) => Math.round(pixels / DAY_WIDTH[range.zoom]);

/**
 * A milestone's progress from its tasks (outside the trash): canceled ones don't count,
 * done is the completed category; it's late when its day has passed and it isn't complete.
 */
export function milestoneProgress(
	milestone: Pick<Milestone, "id" | "dueOn" | "completedAt">,
	tasks: ReadonlyArray<TaskSummary>,
	statuses: ReadonlyArray<Pick<TasklineStatus, "id" | "category">>,
	today: string,
) {
	const category = new Map(statuses.map((status) => [status.id, status.category]));
	const mine = tasks.filter((task) => task.milestoneId === milestone.id && category.get(task.statusId) !== "canceled");
	const done = mine.filter((task) => category.get(task.statusId) === "completed").length;
	const overdue = mine.filter((task) => task.completedAt === null && task.dueOn !== null && task.dueOn < today).length;
	return {
		total: mine.length,
		done,
		open: mine.length - done,
		overdue,
		late: milestone.completedAt === null && milestone.dueOn !== null && milestone.dueOn < today,
	};
}
