import { formatMoney } from "@/lib/i18n/currency";
import { type IsoDate, type IsoMonth, weekdayOf } from "@/lib/i18n/date-only";
import { formatDayMonth, formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { monthLabel } from "./words";

/** The shades of the calendar: none, then four steps of one hue (sequential: one hue, light to dark). */
const STEPS = 4;
const shade = (step: number) =>
	step === 0
		? undefined
		: `color-mix(in oklab, var(--chart-1) ${Math.round((step / STEPS) * 85 + 15)}%, var(--kh-page))`;

const stepOf = (amount: number, max: number) =>
	amount <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((amount / max) * STEPS));

/**
 * The month as a calendar (Task 94): a table, weeks from Sunday, each day's shade its
 * spending (one hue, darker for more; a day with none is blank). The day's number is beside
 * its shade, never on it, and its amount is in the cell for screen readers and in its title
 * on hover; the scale is named under it ("Less … More").
 */
export function CalendarHeatmap({
	days,
	currency,
	month,
}: {
	days: ReadonlyArray<{ day: IsoDate; amountMinor: number }>;
	currency: string;
	month: IsoMonth;
}) {
	const max = Math.max(0, ...days.map((day) => day.amountMinor));
	const first = days[0]?.day ?? `${month}-01`;
	const lead = weekdayOf(first);
	const cells: Array<{ day: IsoDate; amountMinor: number } | null> = [
		...Array.from({ length: lead }, () => null),
		...days,
	];
	while (cells.length % 7 !== 0) cells.push(null);
	const weeks = Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
	// 1 January 2023 was a Sunday: the weekdays' names from it, in order.
	const weekday = (index: number) => formatWeekdayShort(new Date(2023, 0, 1 + index));
	return (
		<div className="flex flex-col gap-2">
			<table className="w-full table-fixed border-separate border-spacing-1">
				<caption className="sr-only">
					{m.kharcha_insights_calendar_caption({ month: monthLabel(month), currency })}
				</caption>
				<thead>
					<tr>
						{Array.from({ length: 7 }, (_, index) => (
							<th key={weekday(index)} scope="col" className="font-normal text-caption text-kh-muted">
								{weekday(index)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week) => (
						<tr key={week.find(Boolean)?.day ?? "empty"}>
							{week.map((cell, index) =>
								cell ? (
									<td
										key={cell.day}
										className="p-0 align-top"
										title={`${formatDayMonth(cell.day)}: ${formatMoney(cell.amountMinor, currency)}`}
									>
										<div className="flex flex-col items-stretch gap-0.5">
											<span
												aria-hidden
												className={cn(
													"block h-7 rounded-sm border border-kh-hair sm:h-9",
													stepOf(cell.amountMinor, max) === 0 && "bg-kh-ground",
												)}
												style={{ background: shade(stepOf(cell.amountMinor, max)) }}
											/>
											<span className="kh-figures text-center text-[0.6875rem] text-kh-muted">
												{formatNumber(Number(cell.day.slice(8, 10)))}
											</span>
											<span className="sr-only">
												{cell.amountMinor > 0 ? formatMoney(cell.amountMinor, currency) : m.kharcha_insights_nothing()}
											</span>
										</div>
									</td>
								) : (
									// biome-ignore lint/suspicious/noArrayIndexKey: blank cells before the 1st and after the last have nothing else to be keyed by
									<td key={`blank-${index}`} className="p-0" />
								),
							)}
						</tr>
					))}
				</tbody>
			</table>
			<p className="flex items-center justify-end gap-1.5 text-caption text-kh-muted" aria-hidden>
				{m.kharcha_insights_less_scale()}
				{Array.from({ length: STEPS + 1 }, (_, step) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: the scale's steps are fixed and in order
						key={step}
						className={cn("size-3 rounded-sm border border-kh-hair", step === 0 && "bg-kh-ground")}
						style={{ background: shade(step) }}
					/>
				))}
				{m.kharcha_insights_more_scale()}
			</p>
		</div>
	);
}
