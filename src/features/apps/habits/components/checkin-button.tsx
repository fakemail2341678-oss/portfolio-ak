import { CheckIcon } from "lucide-react";
import { type IsoDate, isoDateInstant, weekdayOf } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { appColor } from "../../colors";
import { weekdayName } from "../format";
import { isScheduled } from "../streaks";
import type { HabitSummary } from "../types";

/**
 * One day of a habit in the strip: a press adds a check-in, back to none after the
 * target. Filled when done, the count shown while part-way, outlined (dashed) on a
 * day the habit isn't meant for.
 */
export function CheckinButton({
	habit,
	day,
	today,
	count,
	onTap,
}: {
	habit: Pick<HabitSummary, "name" | "color" | "days" | "target">;
	day: IsoDate;
	today: IsoDate;
	count: number;
	onTap: () => void;
}) {
	const done = count >= habit.target;
	const scheduled = isScheduled(habit.days, day);
	const color = appColor(habit.color);
	return (
		<button
			type="button"
			onClick={onTap}
			aria-pressed={done}
			className={cn(
				"relative flex h-12 w-9 flex-col items-center justify-center gap-0.5 rounded-md border text-caption outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
				!done && "hover:bg-surface-2",
				!scheduled && !done && "border-dashed text-muted-foreground",
				day === today && !done && "border-foreground/40",
			)}
			// Done: a tint of the habit's colour behind body text (text on the full colour could fail contrast).
			style={
				done
					? { backgroundColor: `color-mix(in oklab, ${color} 24%, transparent)`, borderColor: color }
					: count > 0
						? { boxShadow: `inset 0 -4px 0 0 ${color}` }
						: undefined
			}
			data-testid="habits-checkin"
			data-day={day}
		>
			{/* The name is the visible text and the rest said in words (WCAG 2.5.3: the label holds what is seen). */}
			<span className="text-muted-foreground leading-none">{weekdayName(weekdayOf(day))}</span>
			<span className="font-medium leading-none tabular-nums">
				{done ? (
					<CheckIcon className="size-3.5" style={{ color }} aria-hidden />
				) : count > 0 ? (
					`${formatNumber(count)}/${formatNumber(habit.target)}`
				) : (
					formatNumber(Number(day.slice(8)))
				)}
			</span>
			<span className="sr-only">
				{m.habits_checkin_label({
					name: habit.name,
					date: formatDate(isoDateInstant(day), { dateStyle: "full" }),
					count: formatNumber(count),
					target: formatNumber(habit.target),
				})}
			</span>
		</button>
	);
}
