import { CalendarRangeIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { SprintMeasure } from "../search";
import type { SprintSummary, SprintTotals, Velocity } from "../types";
import { toHours, totalsIn } from "./burndown";

/** Small pieces the backlog, the report, Home and the admin share (Task 52). */

export const dayText = (day: string) => formatDayMonth(day);

/** What the charts and totals count: points, or estimated hours when the project estimates in time (Task 53). */
export const measureOf = (estimation: "points" | "time"): SprintMeasure =>
	estimation === "points" ? "points" : "hours";

/** The measures a sprint offers: its estimate (points or hours) and tasks. */
export const measuresOf = (estimation: "points" | "time"): SprintMeasure[] => [measureOf(estimation), "tasks"];

/** A stored amount (points, minutes, tasks) in one measure. */
export const amountIn = (value: { points: number; tasks: number; minutes: number }, measure: SprintMeasure) =>
	measure === "points" ? value.points : measure === "hours" ? toHours(value.minutes) : value.tasks;

/** "Points: 13", "Hours: 12.5" or "Tasks: 4". */
export const amountText = (value: number, measure: SprintMeasure) =>
	measure === "points"
		? m.taskline_sprint_points({ value: formatNumber(value) })
		: measure === "hours"
			? m.taskline_sprint_hours({ value: formatNumber(value, { maximumFractionDigits: 1 }) })
			: m.taskline_sprint_tasks({ value: formatNumber(value) });

/** The measure's name, for the report's switcher. */
export const measureLabel = (measure: SprintMeasure) =>
	measure === "points"
		? m.taskline_sprint_by_points()
		: measure === "hours"
			? m.taskline_sprint_by_hours()
			: m.taskline_sprint_by_tasks();

/** The recent velocity in a measure (null before the first completed sprint). */
export const velocityIn = (velocity: Velocity, measure: SprintMeasure): number | null =>
	measure === "points"
		? velocity.points
		: measure === "hours"
			? velocity.minutes === null
				? null
				: toHours(velocity.minutes)
			: velocity.tasks;

/** The recent velocity as a sentence, or that there's none yet. */
export function velocityText(velocity: Velocity, estimation: "points" | "time"): string {
	const value = velocityIn(velocity, measureOf(estimation));
	if (value === null) return m.taskline_velocity_none();
	return estimation === "points"
		? m.taskline_velocity_points({ value: formatNumber(value), sprints: formatNumber(velocity.sprints) })
		: m.taskline_velocity_hours({
				value: formatNumber(value, { maximumFractionDigits: 1 }),
				sprints: formatNumber(velocity.sprints),
			});
}

/** Days from today to the last day, both counted (0 once it's past). */
export const daysLeft = (sprint: Pick<SprintSummary, "endOn">, today: string) =>
	Math.max(0, Math.round((Date.parse(sprint.endOn) - Date.parse(today)) / 86_400_000) + 1);

export function SprintDates({
	sprint,
	className,
}: {
	sprint: Pick<SprintSummary, "startOn" | "endOn">;
	className?: string;
}) {
	return (
		<span className={cn("inline-flex items-center gap-1 text-caption text-muted-foreground", className)}>
			<CalendarRangeIcon className="size-3.5" aria-hidden />
			{m.taskline_sprint_dates({ start: dayText(sprint.startOn), end: dayText(sprint.endOn) })}
		</span>
	);
}

/** Done of scope, as a bar with its numbers. */
export function SprintProgress({ totals, measure }: { totals: SprintTotals; measure: SprintMeasure }) {
	const { scope, done } = totalsIn(totals, measure);
	const label =
		measure === "points"
			? m.taskline_sprint_progress_points({ done: formatNumber(done), scope: formatNumber(scope) })
			: measure === "hours"
				? m.taskline_sprint_progress_hours({
						done: formatNumber(done, { maximumFractionDigits: 1 }),
						scope: formatNumber(scope, { maximumFractionDigits: 1 }),
					})
				: m.taskline_sprint_progress_tasks({ done: formatNumber(done), scope: formatNumber(scope) });
	return (
		<div className="flex flex-col gap-1">
			<Progress value={scope === 0 ? 0 : Math.round((done / scope) * 100)} aria-label={label} />
			<span className="text-caption text-muted-foreground tabular-nums">{label}</span>
		</div>
	);
}
