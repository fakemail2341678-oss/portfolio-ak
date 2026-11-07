import type { IsoDate } from "@/lib/i18n/date-only";
import type { AppColor } from "../colors";

/** Habits' limits per user (decision 0193): a guest's habits count the same. */
export const HABITS_QUOTAS = { habits: 20 } as const;

/** The most check-ins a day can need to count as done. */
export const HABIT_TARGET_MAX = 20;

/** Every day of the week (bit 0 Sunday … bit 6 Saturday). */
export const EVERY_DAY = 0b111_1111;

/** How far back a check-in may be changed (the heatmap shows a year). */
export const CHECKIN_DAYS_BACK = 366;

/** Days in the list's check-in strip, today included. */
export const STRIP_DAYS = 7;

/** Days the completion rate covers, today included. */
export const RATE_DAYS = 30;

export type HabitStats = {
	/** Scheduled days done in a row, up to today (today not done yet doesn't break it). */
	streak: number;
	best: number;
	/** Of the last RATE_DAYS scheduled days, the share done (0–1); null when none was scheduled yet. */
	rate: number | null;
};

export type HabitSummary = HabitStats & {
	id: string;
	name: string;
	color: AppColor;
	days: number;
	target: number;
	archived: boolean;
	/** The day it was made (the app's time zone): streaks and rates start there. */
	startedOn: IsoDate;
};

/** One habit's count on one day; `id` is `${habitId}:${day}`. No row is zero. */
export type HabitCheckin = { id: string; habitId: string; day: IsoDate; count: number };

export const checkinId = (habitId: string, day: IsoDate) => `${habitId}:${day}`;

export type HabitsOverview = {
	habits: HabitSummary[];
	/** The last STRIP_DAYS days' check-ins of every habit. */
	checkins: HabitCheckin[];
	/** The server's calendar day (the app's time zone): the strip ends on it. */
	today: IsoDate;
};

/** One habit's page: the habit and its check-ins over the heatmap's year. */
export type HabitDetail = {
	habit: HabitSummary;
	checkins: Array<{ day: IsoDate; count: number }>;
	today: IsoDate;
};
