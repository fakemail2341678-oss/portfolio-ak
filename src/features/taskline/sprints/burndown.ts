import { addDays, weekdayOf } from "@/lib/i18n/date-only";
import type { SprintMeasure } from "../search";
import type { SprintDay, SprintReport, SprintTotals } from "../types";

/**
 * A sprint's burndown and burnup from its daily snapshots (decision 0216), pure so the
 * report and the tests compute the same lines.
 *
 * - The first point is the start: the snapshot of the day before the first day (what
 *   starting the sprint wrote), else the commitment.
 * - Each later day is that day's close: its snapshot, or the last known one when the
 *   daily job missed a day; today (while active) is the live totals; days still to come
 *   have no value.
 * - The ideal line falls from the start's remaining work to zero on the last day, on
 *   working days only (it stays flat over days off). With no working day in the sprint
 *   it falls every day.
 */

export type BurnPoint = {
	/** The day (YYYY-MM-DD), or null for the start. */
	day: string | null;
	scope: number | null;
	done: number | null;
	remaining: number | null;
	ideal: number;
};

/** Minutes as hours with one decimal (charts and totals). */
export const toHours = (minutes: number) => Math.round(minutes / 6) / 10;

/** A sprint's work in one measure: scope and done (Task 53: estimated minutes as hours). */
export function totalsIn(totals: SprintTotals, measure: SprintMeasure): { scope: number; done: number } {
	if (measure === "points") return { scope: totals.scopePoints, done: totals.donePoints };
	if (measure === "hours") return { scope: toHours(totals.scopeMinutes), done: toHours(totals.doneMinutes) };
	return { scope: totals.scopeTasks, done: totals.doneTasks };
}

const pick = totalsIn;

/** Every day from `first` to `last`, inclusive. */
const daysBetween = (first: string, last: string): string[] => {
	const days: string[] = [];
	for (let day = first; day <= last && days.length < 400; day = addDays(day, 1)) days.push(day);
	return days;
};

export function burnSeries(
	report: Pick<SprintReport, "sprint" | "days" | "live" | "today" | "workingDays">,
	by: SprintMeasure,
): BurnPoint[] {
	const { sprint, days, live, today, workingDays } = report;
	const byDay = new Map<string, SprintDay>(days.map((day) => [day.day, day]));
	const committed = sprint.committed
		? {
				scope:
					by === "points"
						? sprint.committed.points
						: by === "hours"
							? toHours(sprint.committed.minutes)
							: sprint.committed.tasks,
				done: 0,
			}
		: { scope: 0, done: 0 };
	const startSnapshot = byDay.get(addDays(sprint.startOn, -1));
	const start = startSnapshot ? pick(startSnapshot, by) : committed;
	// The last day with a value: today while active, the day it completed, else (planned) none.
	const completedOn = sprint.completedAt ? (days.at(-1)?.day ?? sprint.endOn) : null;
	const lastActual =
		sprint.state === "active" ? today : sprint.state === "completed" ? (completedOn ?? sprint.endOn) : null;
	const lastDay = lastActual && lastActual > sprint.endOn ? lastActual : sprint.endOn;
	const range = daysBetween(sprint.startOn, lastDay);

	const isWorking = (day: string) => workingDays.includes(weekdayOf(day));
	const planned = range.filter((day) => day <= sprint.endOn);
	const working = planned.filter(isWorking).length;
	const base = Math.round((start.scope - start.done) * 10) / 10;
	let left = working > 0 ? working : planned.length;
	const ideal = (day: string) => {
		if (day > sprint.endOn) return 0;
		if (working === 0 || isWorking(day)) left -= 1;
		const total = working > 0 ? working : planned.length;
		return total === 0 ? 0 : Math.round(((base * Math.max(left, 0)) / total) * 10) / 10;
	};

	const points: BurnPoint[] = [
		{ day: null, scope: start.scope, done: start.done, remaining: base, ideal: Math.max(base, 0) },
	];
	let known = start;
	for (const day of range) {
		const idealValue = ideal(day);
		if (lastActual === null || day > lastActual) {
			points.push({ day, scope: null, done: null, remaining: null, ideal: idealValue });
			continue;
		}
		const snapshot = byDay.get(day);
		const value =
			day === today && sprint.state === "active" && live ? pick(live, by) : snapshot ? pick(snapshot, by) : known;
		known = value;
		points.push({
			day,
			scope: value.scope,
			done: value.done,
			remaining: Math.round((value.scope - value.done) * 10) / 10,
			ideal: idealValue,
		});
	}
	return points;
}
