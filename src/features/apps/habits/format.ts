import { formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { weekdaysOf } from "./streaks";
import { EVERY_DAY } from "./types";

/** Monday to Friday. */
const WEEKDAYS = 0b011_1110;

/** A weekday's short name (0 Sunday … 6 Saturday): 4 January 2026 was a Sunday. */
export const weekdayName = (weekday: number) => formatWeekdayShort(new Date(2026, 0, 4 + weekday));

/** When a habit is meant for: "Every day", "Weekdays" or "Mon, Wed, Fri". */
export const scheduleLabel = (days: number) => {
	if (days === EVERY_DAY) return m.habits_every_day();
	if (days === WEEKDAYS) return m.habits_weekdays();
	return weekdaysOf(days).map(weekdayName).join(", ");
};

/** "Once a day" or "8 times a day". */
export const targetLabel = (target: number) =>
	target === 1 ? m.habits_target_once() : m.habits_target_times({ count: formatNumber(target) });

/** A completion rate as a percentage, or a dash when nothing was scheduled yet. */
export const rateLabel = (rate: number | null) =>
	rate === null ? "–" : formatNumber(rate, { style: "percent", maximumFractionDigits: 0 });
