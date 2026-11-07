import { useMinuteClock } from "@/hooks/use-minute-clock";
import { type DateInput, formatDateTime, formatRelativeTimeFrom } from "@/lib/i18n/intl";

/**
 * "3 minutes ago" / "३ मिनेट पहिले", with the exact date and time in a tooltip
 * (`title`) and the machine-readable value in `<time dateTime>`.
 *
 * Hydration-safe: the server and the first browser render both use `now`, the
 * time the data was read (a loader's `generatedAt`), so they print the same
 * words. After hydration it follows the browser's clock and updates each minute
 * (useMinuteClock, one timer for the page).
 */
export function RelativeTime({
	value,
	now: renderedAt,
	className,
}: {
	value: DateInput;
	now: DateInput;
	className?: string;
}) {
	const current = useMinuteClock(new Date(renderedAt).getTime());
	const iso = new Date(value).toISOString();
	return (
		<time dateTime={iso} title={formatDateTime(value)} className={className}>
			{formatRelativeTimeFrom(value, current)}
		</time>
	);
}
