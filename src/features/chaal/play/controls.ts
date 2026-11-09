import { speedOf, type TimeControl } from "../chess/clock";

/**
 * What online play may ask Lichess for (PLAN 13.4, "Board API"; decision 0266). The Board
 * API plays rapid, classical and correspondence; direct challenges, the Lichess AI and
 * open challenges may also be blitz. Bullet never. A clock's start is one of Lichess's
 * values (0, ¼, ½, ¾, 1 and 1½ minutes, then whole minutes up to three hours) with an
 * increment of 0–60 s; correspondence is days per move.
 */

export const CORRESPONDENCE_DAYS = [1, 2, 3, 5, 7, 10, 14] as const;
export type CorrespondenceDays = (typeof CORRESPONDENCE_DAYS)[number];

/** A game's pace: a clock (seconds, as Lichess's form takes them) or days per move. */
export type OnlinePace = { kind: "clock"; clock: TimeControl } | { kind: "days"; days: CorrespondenceDays };

const SHORT_STARTS = new Set([0, 15, 30, 45, 60, 90]);
export const MAX_CLOCK_SECONDS = 10_800;
export const MAX_INCREMENT_SECONDS = 60;

/** Whether Lichess takes this clock at all: a start it knows, an increment of 0–60 s, and not 0+0. */
export function clockAccepted({ initial, increment }: TimeControl): boolean {
	const start = Number.isInteger(initial) && (SHORT_STARTS.has(initial) || (initial % 60 === 0 && initial > 0));
	const step = Number.isInteger(increment) && increment >= 0 && increment <= MAX_INCREMENT_SECONDS;
	return start && initial <= MAX_CLOCK_SECONDS && step && initial + increment > 0;
}

/** Whether the Board API can play a direct challenge, an AI game or an open challenge on this clock: blitz or slower. */
export function boardLegal(clock: TimeControl): boolean {
	if (!clockAccepted(clock)) return false;
	const speed = speedOf(clock);
	return speed === "blitz" || speed === "rapid" || speed === "classical";
}

/** The clocks the setup offers (all Board-legal): blitz, rapid and classical, as the plan's tiles. */
export const ONLINE_CLOCKS: ReadonlyArray<TimeControl> = [
	{ initial: 180, increment: 2 },
	{ initial: 300, increment: 0 },
	{ initial: 300, increment: 3 },
	{ initial: 600, increment: 0 },
	{ initial: 600, increment: 5 },
	{ initial: 900, increment: 10 },
	{ initial: 1800, increment: 0 },
	{ initial: 1800, increment: 20 },
];

/** The days per move the setup offers (PLAN Task 78's tiles: 1, 3, 7 and 14). */
export const ONLINE_DAYS: ReadonlyArray<CorrespondenceDays> = [1, 3, 7, 14];

/** The Lichess AI's levels. */
export const AI_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * The admin's limits on online play (`ch_settings.play`, its form arrives with Task 79): the
 * Lichess AI's highest level and whether rated games may be asked for. Read stored values
 * through `readPlayLimits`, which falls back field by field.
 */
export type PlayLimits = { aiMaxLevel: number; rated: boolean };

export const DEFAULT_PLAY_LIMITS: PlayLimits = { aiMaxLevel: 8, rated: true };

export function readPlayLimits(value: Partial<PlayLimits> | null | undefined): PlayLimits {
	const level = value?.aiMaxLevel;
	return {
		aiMaxLevel:
			typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 8
				? level
				: DEFAULT_PLAY_LIMITS.aiMaxLevel,
		rated: typeof value?.rated === "boolean" ? value.rated : DEFAULT_PLAY_LIMITS.rated,
	};
}

/** "10+5" or "3 days" style keys for a pace, for choices and the URL. */
export const paceKey = (pace: OnlinePace): string =>
	pace.kind === "clock" ? `${pace.clock.initial}+${pace.clock.increment}` : `d${pace.days}`;

export function paceOfKey(key: string): OnlinePace | null {
	const days = /^d(\d+)$/.exec(key);
	if (days) {
		const value = Number(days[1]);
		return (CORRESPONDENCE_DAYS as ReadonlyArray<number>).includes(value)
			? { kind: "days", days: value as CorrespondenceDays }
			: null;
	}
	const clock = /^(\d+)\+(\d+)$/.exec(key);
	if (!clock) return null;
	const control = { initial: Number(clock[1]), increment: Number(clock[2]) };
	return boardLegal(control) ? { kind: "clock", clock: control } : null;
}
