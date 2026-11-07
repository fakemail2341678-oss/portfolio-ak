import { addDays } from "@/lib/i18n/date-only";
import { startOfWeek } from "../calendar/grid";
import type { ReportRange, ReportWeek, ReportWorkloadRow, StatusCategory } from "../types";

/**
 * The reports' arithmetic (Task 57, decision 0225), pure so a test can read it. Days are
 * `YYYY-MM-DD` in the workspace's calendar; the server hands them in.
 */

const DAY_MS = 86_400_000;
const days = (ms: number) => Math.round((ms / DAY_MS) * 100) / 100;

export const RANGE_WEEKS: Record<ReportRange, number> = { "4w": 4, "12w": 12, "26w": 26 };

/** A task's moves between statuses, as the activity log holds them. */
export type StatusMove = { at: Date; from: string; to: string };

/**
 * A completed task's lead time (created to completed) and cycle time (first started to
 * completed), in days. It started with its first move into a `started` status, or when
 * it was created if its first move was out of one. Reopening doesn't restart either
 * clock: completed means the last time it was completed. Never started (it went straight
 * to done, or its moves name statuses since deleted): no cycle time.
 */
export function taskDurations(
	task: { createdAt: Date; completedAt: Date },
	moves: ReadonlyArray<StatusMove>,
	categoryOf: (statusId: string) => StatusCategory | undefined,
): { leadDays: number; cycleDays: number | null } {
	const end = task.completedAt.getTime();
	const leadDays = days(end - task.createdAt.getTime());
	const ordered = [...moves].sort((a, b) => a.at.getTime() - b.at.getTime());
	const [first] = ordered;
	if (!first) return { leadDays, cycleDays: null };
	const start =
		categoryOf(first.from) === "started"
			? task.createdAt
			: ordered.find((move) => categoryOf(move.to) === "started")?.at;
	return { leadDays, cycleDays: start && start.getTime() <= end ? days(end - start.getTime()) : null };
}

/** The value at a percentile (nearest rank), or null with no values. */
export function percentile(values: ReadonlyArray<number>, share: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? null;
}

export type WeeklyTask = {
	createdOn: string;
	/** The day it reached a completed status, if it's there now. */
	completedOn: string | null;
	/** The day it closed, completed or canceled. */
	closedOn: string | null;
	dueOn: string | null;
};

/** The first day of a range of `weeks` ending in the week of `today`. */
export const firstWeekOf = (today: string, weeks: number, weekStart: number) =>
	addDays(startOfWeek(today, weekStart), -7 * (weeks - 1));

/**
 * The weeks from `first`: tasks created and completed in each, and those overdue at its
 * close (today, for the week in progress). A task is overdue on a day after its due date
 * until it's closed; the due date is today's, as tasks don't keep earlier ones.
 */
export function weeklySeries(
	tasks: ReadonlyArray<WeeklyTask>,
	{ first, weeks, today }: { first: string; weeks: number; today: string },
): ReportWeek[] {
	return Array.from({ length: weeks }, (_, index) => {
		const week = addDays(first, index * 7);
		const last = addDays(week, 6);
		const close = last < today ? last : today;
		const within = (day: string | null) => day !== null && day >= week && day <= last;
		return {
			week,
			created: tasks.filter((task) => within(task.createdOn)).length,
			completed: tasks.filter((task) => within(task.completedOn)).length,
			overdue: tasks.filter(
				(task) =>
					task.dueOn !== null &&
					task.dueOn < close &&
					task.createdOn <= close &&
					(task.closedOn === null || task.closedOn > close),
			).length,
		};
	});
}

export type WorkloadTask = {
	assigneeId: string | null;
	dueOn: string | null;
	estimateMinutes: number | null;
	points: number | null;
};

/** Open tasks per assignee, the most loaded first and those nobody has last. */
export function workloadRows(
	openTasks: ReadonlyArray<WorkloadTask>,
	nameOf: (memberId: string) => string | null,
	today: string,
): ReportWorkloadRow[] {
	const rows = new Map<string | null, ReportWorkloadRow>();
	for (const task of openTasks) {
		const row = rows.get(task.assigneeId) ?? {
			memberId: task.assigneeId,
			name: task.assigneeId ? nameOf(task.assigneeId) : null,
			open: 0,
			overdue: 0,
			estimateMinutes: 0,
			points: 0,
		};
		row.open += 1;
		if (task.dueOn !== null && task.dueOn < today) row.overdue += 1;
		row.estimateMinutes += task.estimateMinutes ?? 0;
		row.points += task.points ?? 0;
		rows.set(task.assigneeId, row);
	}
	return [...rows.values()].sort(
		(a, b) => Number(a.memberId === null) - Number(b.memberId === null) || b.open - a.open,
	);
}

/** How many days ahead an open milestone counts as close. */
const MILESTONE_RISK_DAYS = 7;

/** Whether a milestone is at risk: past its day, or close with tasks still open. */
export function milestoneAtRisk(milestone: { dueOn: string | null; open: number }, today: string): boolean {
	if (milestone.dueOn === null) return false;
	if (milestone.dueOn < today) return true;
	return milestone.open > 0 && milestone.dueOn <= addDays(today, MILESTONE_RISK_DAYS);
}
