import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDayMonth, formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { Recurrence } from "../types";

/** A weekday's short name (0 Sunday … 6 Saturday): 7 January 2024 was a Sunday. */
export const weekdayName = (day: number) => formatWeekdayShort(new Date(2024, 0, 7 + day));

/** A repeat as words: "Every 2 weeks on Sun, Wed, until 31 Dec 2026". */
export function recurrenceText(rule: Recurrence): string {
	const count = formatNumber(rule.interval);
	const many = rule.interval > 1;
	const day = formatNumber(Number(rule.anchor.slice(8, 10)));
	let text: string;
	switch (rule.freq) {
		case "daily":
			text = many ? m.taskline_repeat_every_days({ count }) : m.taskline_repeat_every_day();
			break;
		case "weekly": {
			const days = (rule.weekdays ?? []).map(weekdayName).join(", ");
			text = many ? m.taskline_repeat_every_weeks({ count, days }) : m.taskline_repeat_every_week({ days });
			break;
		}
		case "monthly":
			text = many ? m.taskline_repeat_every_months({ count, day }) : m.taskline_repeat_every_month({ day });
			break;
		case "yearly": {
			const date = formatDayMonth(rule.anchor);
			text = many ? m.taskline_repeat_every_years({ count, date }) : m.taskline_repeat_every_year({ date });
			break;
		}
	}
	if (rule.until) {
		return m.taskline_repeat_until({
			rule: text,
			date: formatDate(isoDateInstant(rule.until), { dateStyle: "medium" }),
		});
	}
	if (rule.count) return m.taskline_repeat_times({ rule: text, count: formatNumber(rule.count) });
	return text;
}
