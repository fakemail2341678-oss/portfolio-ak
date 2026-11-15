/**
 * The timesheet's arithmetic (Task 53), pure for the server and the tests.
 *
 * A cell is the sum of the member's entries on one task and day. Typing a new total
 * into it changes those entries as little as possible (`planCell`): more time is a new
 * entry for the difference; less takes it from the newest entries first, removing those
 * it empties. Timer and hand-logged entries count alike; a running timer isn't in a
 * cell until it stops.
 */

export type CellEntry = { id: string; minutes: number };
export type CellPlan = {
	/** Minutes of a new entry, or null. */
	insert: number | null;
	update: Array<{ id: string; minutes: number }>;
	remove: string[];
};

/** How to bring a cell's entries (oldest first) to `target` minutes. */
export function planCell(entries: ReadonlyArray<CellEntry>, target: number): CellPlan {
	const plan: CellPlan = { insert: null, update: [], remove: [] };
	const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
	if (target === total) return plan;
	if (target > total) return { ...plan, insert: target - total };
	let cut = total - target;
	for (const entry of [...entries].reverse()) {
		if (cut <= 0) break;
		if (entry.minutes <= cut) {
			plan.remove.push(entry.id);
			cut -= entry.minutes;
		} else {
			plan.update.push({ id: entry.id, minutes: entry.minutes - cut });
			cut = 0;
		}
	}
	return plan;
}

/** The sum of each column (day) of the rows' minutes, and of everything. */
export function sheetTotals(rows: ReadonlyArray<{ minutes: ReadonlyArray<number> }>, days: number) {
	const perDay = Array.from({ length: days }, (_, day) => rows.reduce((sum, row) => sum + (row.minutes[day] ?? 0), 0));
	return { perDay, total: perDay.reduce((sum, value) => sum + value, 0) };
}

/** A member's capacity over some days: their weekly capacity spread over the working days. */
export function capacityFor(weeklyMinutes: number, days: ReadonlyArray<number>, workingDays: ReadonlyArray<number>) {
	const perWeek = workingDays.length;
	if (perWeek === 0) return 0;
	const working = days.filter((weekday) => workingDays.includes(weekday)).length;
	return Math.round((weeklyMinutes * working) / perWeek);
}
