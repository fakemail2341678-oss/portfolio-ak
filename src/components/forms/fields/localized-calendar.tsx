import type { ComponentProps } from "react";
import { Calendar } from "@/components/ui/calendar";
import { formatDate, formatMonthYear, formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * shadcn Calendar (react-day-picker) speaking the app's language: captions,
 * weekday names, day numbers (Devanagari in Nepali) and the accessible labels of
 * navigation buttons and day cells all come from src/lib/i18n/intl.ts, which works
 * without ICU `ne` data (see intl-ne.ts). Weeks start on Sunday, as in Nepal.
 */
export function LocalizedCalendar(props: ComponentProps<typeof Calendar>) {
	const locale = getLocale();
	return (
		<Calendar
			weekStartsOn={0}
			formatters={{
				formatCaption: (month) => formatMonthYear(month, locale),
				formatWeekdayName: (day) => formatWeekdayShort(day, locale),
				formatDay: (day) => formatNumber(day.getDate(), { useGrouping: false }, locale),
			}}
			labels={{
				labelPrevious: () => m.calendar_previous(),
				labelNext: () => m.calendar_next(),
				labelDayButton: (day) =>
					formatDate(
						new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12)),
						{ dateStyle: "full" },
						locale,
					),
			}}
			{...props}
		/>
	);
}
