import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/**
 * Durations as people type and read them (Task 53). Pure, so the forms, the timesheet
 * and the tests agree.
 *
 * `parseDuration` reads "1h 30m", "1h30", "2h", "45m", "1:30", "1.5" and "1,5" (a bare
 * number is hours), in Latin or Devanagari digits, with "घण्टा"/"घ" and "मिनेट"/"मि" for
 * the units. Empty is 0; anything else, or more than `max`, is null.
 */

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

const latin = (text: string) => text.replace(/[०-९]/g, (digit) => String(DEVANAGARI_DIGITS.indexOf(digit)));

const HOURS_MINUTES = /^(\d+(?:\.\d+)?)h(?:(\d+)m?)?$/;
const MINUTES_ONLY = /^(\d+)m$/;
const CLOCK = /^(\d+):([0-5]\d)$/;
const HOURS_ONLY = /^(\d+(?:\.\d+)?)$/;

export function parseDuration(input: string, max = 24 * 60): number | null {
	const text = latin(input.trim().toLowerCase())
		.replace(/घण्टा|घं|घ/g, "h")
		.replace(/मिनेट|मि/g, "m")
		.replace(/(\d),(\d)/g, "$1.$2")
		.replace(/\s+/g, "")
		.replace(/(?:hours?|hrs?)/g, "h")
		.replace(/(?:minutes?|mins?)/g, "m");
	if (text === "") return 0;
	let minutes: number | null = null;
	const both = HOURS_MINUTES.exec(text);
	const clock = CLOCK.exec(text);
	const onlyMinutes = MINUTES_ONLY.exec(text);
	const onlyHours = HOURS_ONLY.exec(text);
	if (both?.[1]) minutes = Number(both[1]) * 60 + Number(both[2] ?? 0);
	else if (clock?.[1] && clock[2]) minutes = Number(clock[1]) * 60 + Number(clock[2]);
	else if (onlyMinutes?.[1]) minutes = Number(onlyMinutes[1]);
	else if (onlyHours?.[1]) minutes = Number(onlyHours[1]) * 60;
	if (minutes === null || !Number.isFinite(minutes)) return null;
	const rounded = Math.round(minutes);
	return rounded > max ? null : rounded;
}

/** "1h 30m", "2h", "45m" (in the page's language and digits); 0 is "0h". */
export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours > 0 && rest > 0) {
		return m.taskline_duration_hm({ hours: formatNumber(hours), minutes: formatNumber(rest) });
	}
	if (rest > 0) return m.taskline_duration_m({ minutes: formatNumber(rest) });
	return m.taskline_duration_h({ hours: formatNumber(hours) });
}

/** What an input shows to edit: "1:30", "" for nothing (Latin digits, which the parser reads back). */
export const durationInput = (minutes: number): string =>
	minutes <= 0 ? "" : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** Hours with one decimal, for charts and totals that compare sizes ("12.5"). */
export const hoursOf = (minutes: number): number => Math.round((minutes / 60) * 10) / 10;

/** How long a running timer has counted, as "1:05:09" (hours, minutes, seconds), from the start to `now`. */
export function elapsedClock(startedAt: string, now: number): string {
	const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
	const h = Math.floor(seconds / 3600);
	const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
	const ss = String(seconds % 60).padStart(2, "0");
	return `${h}:${mm}:${ss}`;
}
