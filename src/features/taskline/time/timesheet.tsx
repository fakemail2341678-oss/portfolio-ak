import { Link } from "@tanstack/react-router";
import { type FocusEvent, type KeyboardEvent, useId, useState } from "react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { isoDateInstant, weekdayOf } from "@/lib/i18n/date-only";
import { formatDate, formatDayMonth, formatWeekdayShort } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { ProjectDot } from "../shell/taskline-sidebar";
import { DAY_MINUTES, type TimesheetRow } from "../types";
import { durationInput, formatDuration, parseDuration } from "./duration";
import { sheetTotals } from "./sheet";

/**
 * The timesheet's week grid (Task 53): a row per task, a column per day from the
 * workspace's week start, totals per row, per day and for the week.
 *
 * Keyboard first (PLAN 11.6): each open cell is a text field. ↑ ↓ move to the same day
 * of the row above or below; ← → move to the day before or after once the caret is at
 * the field's edge (a field's text is selected when it gets focus, so they move at
 * once); Enter saves and moves down; Escape puts the value back. A cell saves when it
 * loses focus. Days after today and on or before the lock date are read only.
 */

export type TimesheetGridProps = {
	ws: string;
	days: ReadonlyArray<string>;
	today: string;
	lockOn: string | null;
	workingDays: ReadonlyArray<number>;
	rows: ReadonlyArray<TimesheetRow>;
	/** A cell typed: the row, the day's index and the new total in minutes. */
	onCell: (row: TimesheetRow, day: number, minutes: number) => void;
};

const cellId = (grid: string, row: number, day: number) => `${grid}-${row}-${day}`;

export function TimesheetGrid({ ws, days, today, lockOn, workingDays, rows, onCell }: TimesheetGridProps) {
	const grid = useId();
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [invalid, setInvalid] = useState<Record<string, boolean>>({});
	const totals = sheetTotals(rows, days.length);
	const isOpen = (row: TimesheetRow, day: number) => {
		const date = days[day];
		return row.editable && date !== undefined && date <= today && (lockOn === null || date > lockOn);
	};
	const keyOf = (row: TimesheetRow, day: number) => `${row.key}:${day}`;
	const cellText = (row: TimesheetRow, day: number) => drafts[keyOf(row, day)] ?? durationInput(row.minutes[day] ?? 0);

	const commit = (rowIndex: number, day: number) => {
		const row = rows[rowIndex];
		if (!row) return;
		const key = keyOf(row, day);
		const draft = drafts[key];
		if (draft === undefined) return;
		const minutes = parseDuration(draft, DAY_MINUTES);
		if (minutes === null) {
			setInvalid((current) => ({ ...current, [key]: true }));
			return;
		}
		setInvalid((current) => ({ ...current, [key]: false }));
		setDrafts(({ [key]: _done, ...rest }) => rest);
		if (minutes !== (row.minutes[day] ?? 0)) onCell(row, day, minutes);
	};

	/** The nearest open cell from (row, day) going by (dRow, dDay), or null. */
	const nextCell = (rowIndex: number, day: number, dRow: number, dDay: number) => {
		for (let r = rowIndex + dRow, d = day + dDay; r >= 0 && r < rows.length && d >= 0 && d < days.length; ) {
			const row = rows[r];
			if (row && isOpen(row, d)) return document.getElementById(cellId(grid, r, d)) as HTMLInputElement | null;
			r += dRow;
			d += dDay;
		}
		return null;
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, day: number) => {
		const input = event.currentTarget;
		const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
		const atEnd = input.selectionStart === input.value.length;
		const all = input.selectionStart === 0 && input.selectionEnd === input.value.length;
		const go = (dRow: number, dDay: number) => {
			const target = nextCell(rowIndex, day, dRow, dDay);
			if (!target) return;
			event.preventDefault();
			target.focus();
		};
		switch (event.key) {
			case "ArrowUp":
				go(-1, 0);
				break;
			case "ArrowDown":
				go(1, 0);
				break;
			case "ArrowLeft":
				if (atStart || all) go(0, -1);
				break;
			case "ArrowRight":
				if (atEnd || all) go(0, 1);
				break;
			case "Enter": {
				event.preventDefault();
				// Leaving the cell saves it (its blur); with no cell below, save here and stay.
				const below = nextCell(rowIndex, day, 1, 0);
				if (below) below.focus();
				else commit(rowIndex, day);
				break;
			}
			case "Escape": {
				const row = rows[rowIndex];
				if (!row) break;
				event.preventDefault();
				const key = keyOf(row, day);
				setDrafts(({ [key]: _gone, ...rest }) => rest);
				setInvalid((current) => ({ ...current, [key]: false }));
				break;
			}
		}
	};

	return (
		<ScrollRegion className="rounded-lg border" data-testid="timesheet-grid">
			<table className="w-full min-w-[44rem] border-collapse text-body">
				<caption className="sr-only">{m.taskline_timesheet_caption()}</caption>
				<thead>
					<tr className="border-b bg-surface-1">
						<th scope="col" className="px-3 py-2 text-start font-medium text-caption text-muted-foreground">
							{m.taskline_timesheet_task()}
						</th>
						{days.map((day) => {
							const off = !workingDays.includes(weekdayOf(day));
							return (
								<th
									key={day}
									scope="col"
									className={cn(
										"w-20 px-1 py-2 text-center font-medium text-caption",
										day === today ? "text-primary" : "text-muted-foreground",
										off && "bg-surface-2/60",
									)}
									aria-current={day === today ? "date" : undefined}
								>
									<span className="block">{formatWeekdayShort(isoDateInstant(day))}</span>
									<span className="block font-normal tabular-nums">{formatDayMonth(day)}</span>
								</th>
							);
						})}
						<th scope="col" className="w-20 px-3 py-2 text-end font-medium text-caption text-muted-foreground">
							{m.taskline_timesheet_total()}
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => {
						const rowTotal = row.minutes.reduce((sum, value) => sum + value, 0);
						const name = row.task ? `${row.task.ref} ${row.task.title}` : m.taskline_timesheet_no_task();
						return (
							<tr key={row.key} className="border-b last:border-b-0" data-testid="timesheet-row">
								<th scope="row" className="max-w-0 px-3 py-1.5 text-start font-normal">
									<span className="flex min-w-0 items-center gap-2">
										<ProjectDot project={row.project} className="size-2.5 shrink-0 rounded-full" />
										{row.task ? (
											<Link
												{...tasklineLinks.task(ws, row.task.ref)}
												className={cn(
													"min-w-0 truncate hover:underline",
													row.task.closed && "text-muted-foreground line-through",
												)}
												title={row.task.title}
											>
												<span className="font-mono text-caption text-muted-foreground">{row.task.ref}</span>{" "}
												{row.task.title}
											</Link>
										) : (
											<span className="min-w-0 truncate text-muted-foreground">
												{m.taskline_timesheet_no_task_in({ project: row.project.key })}
											</span>
										)}
									</span>
								</th>
								{days.map((day, dayIndex) => {
									const off = !workingDays.includes(weekdayOf(day));
									const minutes = row.minutes[dayIndex] ?? 0;
									const key = keyOf(row, dayIndex);
									const dayName = formatDate(isoDateInstant(day), { dateStyle: "full" });
									return (
										<td key={day} className={cn("px-1 py-1", off && "bg-surface-2/60")}>
											{isOpen(row, dayIndex) ? (
												<input
													id={cellId(grid, rowIndex, dayIndex)}
													value={cellText(row, dayIndex)}
													inputMode="decimal"
													autoComplete="off"
													aria-label={m.taskline_timesheet_cell({ task: name, day: dayName })}
													aria-invalid={invalid[key] || undefined}
													title={invalid[key] ? m.taskline_time_error_duration() : undefined}
													onFocus={(event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()}
													onChange={(event) => {
														const text = event.currentTarget.value;
														setDrafts((current) => ({ ...current, [key]: text }));
													}}
													onBlur={() => commit(rowIndex, dayIndex)}
													onKeyDown={(event) => onKeyDown(event, rowIndex, dayIndex)}
													className={cn(
														"h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-center tabular-nums outline-none hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
														invalid[key] && "border-danger",
													)}
													data-testid="timesheet-cell"
													data-day={day}
												/>
											) : (
												<span
													className="block px-1.5 text-center text-muted-foreground tabular-nums"
													data-testid="timesheet-cell-readonly"
													data-day={day}
												>
													<span aria-hidden>{minutes > 0 ? durationInput(minutes) : ""}</span>
													<span className="sr-only">
														{minutes > 0
															? m.taskline_timesheet_cell_value({
																	task: name,
																	day: dayName,
																	duration: formatDuration(minutes),
																})
															: ""}
													</span>
												</span>
											)}
										</td>
									);
								})}
								<td className="px-3 py-1.5 text-end font-medium tabular-nums" data-testid="timesheet-row-total">
									{formatDuration(rowTotal)}
								</td>
							</tr>
						);
					})}
				</tbody>
				<tfoot>
					<tr className="border-t bg-surface-1">
						<th scope="row" className="px-3 py-2 text-start font-medium text-caption text-muted-foreground">
							{m.taskline_timesheet_total()}
						</th>
						{totals.perDay.map((minutes, index) => (
							<td
								key={days[index] ?? index}
								className="px-1 py-2 text-center text-caption tabular-nums"
								data-testid="timesheet-day-total"
							>
								{minutes > 0 ? formatDuration(minutes) : "–"}
							</td>
						))}
						<td className="px-3 py-2 text-end font-semibold tabular-nums" data-testid="timesheet-total">
							{formatDuration(totals.total)}
						</td>
					</tr>
				</tfoot>
			</table>
		</ScrollRegion>
	);
}
