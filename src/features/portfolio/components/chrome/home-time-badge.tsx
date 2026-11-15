import { useSyncExternalStore } from "react";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { cn } from "../../lib/cn";
import { minutesBehindHome } from "../../lib/daylight";

const never = () => () => {};
/** The visitor's UTC offset in minutes; only the browser knows it (null on the server). */
const visitorOffset = () => -new Date().getTimezoneOffset();

const gap = (minutes: number) => {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return m.portfolio_time_minutes({ minutes: formatNumber(rest) });
	if (rest === 0) return m.portfolio_time_hours({ hours: formatNumber(hours) });
	return m.portfolio_time_hours_minutes({ hours: formatNumber(hours), minutes: formatNumber(rest) });
};

/** The part of `location` before its first comma ("Kathmandu, Nepal" → "Kathmandu"). */
export const placeOf = (location: string) => location.split(/[,،]/)[0]?.trim() || location;

type HomeTimeProps = {
	/** When the server read the page (Profile.generatedAt): the first render shows this moment. */
	generatedAt: string;
	location: string;
	className?: string | undefined;
};

/**
 * "It's 6:12 am in Kathmandu. 4 h 45 min ahead of you." The first sentence is
 * rendered on the server for the moment the page was read, and follows the
 * minute after hydration; the second needs the visitor's clock, so it appears
 * only in the browser, in a line already reserved for it (no layout shift).
 */
export function HomeTime({ generatedAt, location, className }: HomeTimeProps) {
	const now = useMinuteClock(Date.parse(generatedAt));
	const offset = useSyncExternalStore(never, visitorOffset, () => null);
	const behind = offset === null ? null : minutesBehindHome(offset);
	return (
		<p className={cn("flex flex-col", className)}>
			<span>
				{m.portfolio_time_now({
					time: formatDate(now, { timeStyle: "short" }),
					place: placeOf(location),
				})}
			</span>
			<span className="min-h-[1lh]">
				{behind === null
					? null
					: behind === 0
						? m.portfolio_time_same()
						: behind > 0
							? m.portfolio_time_ahead({ gap: gap(behind) })
							: m.portfolio_time_behind({ gap: gap(-behind) })}
			</span>
		</p>
	);
}
