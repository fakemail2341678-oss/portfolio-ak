import { addDays } from "@/lib/i18n/date-only";
import type { ScheduleDay, ScheduleEntry } from "./types";

/** The schedule's window: the followed series' 14 days (anime only has its week). */
export const SCHEDULE_DAYS = 14;

/**
 * The schedule by day (decision 0241): from `today` (the viewer's) for 14 days, the
 * followed series' episodes first, by title, then anime in TMDB's popularity order. An
 * episode in both halves shows once, as a followed one. Days with nothing on are left out.
 */
export function scheduleDays(
	today: string,
	following: ReadonlyArray<ScheduleEntry>,
	anime: ReadonlyArray<ScheduleEntry>,
	locale = "en",
): ScheduleDay[] {
	const last = addDays(today, SCHEDULE_DAYS - 1);
	const key = (entry: ScheduleEntry) => `${entry.id}:${entry.season}:${entry.episode}`;
	const followed = new Set(following.map(key));
	const byTitle = [...following].sort(
		(a, b) => a.title.localeCompare(b.title, locale) || a.season - b.season || a.episode - b.episode,
	);
	const days = new Map<string, ScheduleEntry[]>();
	for (const entry of [...byTitle, ...anime.filter((entry) => !followed.has(key(entry)))]) {
		if (entry.airDate < today || entry.airDate > last) continue;
		days.set(entry.airDate, [...(days.get(entry.airDate) ?? []), entry]);
	}
	return [...days.keys()].sort().map((day) => ({ day, entries: days.get(day) ?? [] }));
}
