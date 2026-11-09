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

/**
 * Quick pairing (Task 78, decision 0267): a seek in Lichess's lobby, which the Board API
 * allows only at rapid, classical or correspondence pace. Its clock is whole minutes
 * (0–180) plus an increment of 0–180 s; correspondence is days per move.
 */
export const SEEK_MAX_MINUTES = 180;
export const SEEK_MAX_INCREMENT = 180;

/** Whether the Board API can seek on this clock: whole minutes, Lichess's ranges, rapid or slower. */
export function seekLegal({ initial, increment }: TimeControl): boolean {
	if (!Number.isInteger(initial) || !Number.isInteger(increment)) return false;
	if (initial % 60 !== 0 || initial < 0 || initial > SEEK_MAX_MINUTES * 60) return false;
	if (increment < 0 || increment > SEEK_MAX_INCREMENT || initial + increment <= 0) return false;
	const speed = speedOf({ initial, increment });
	return speed === "rapid" || speed === "classical";
}

/** The quick-pair tiles (PLAN Task 78): Rapid 10+0, 10+5, 15+10; Classical 30+0, 30+20; 1, 3, 7 or 14 days. */
export const QUICK_PAIRS: ReadonlyArray<OnlinePace> = [
	{ kind: "clock", clock: { initial: 600, increment: 0 } },
	{ kind: "clock", clock: { initial: 600, increment: 5 } },
	{ kind: "clock", clock: { initial: 900, increment: 10 } },
	{ kind: "clock", clock: { initial: 1800, increment: 0 } },
	{ kind: "clock", clock: { initial: 1800, increment: 20 } },
	{ kind: "days", days: 1 },
	{ kind: "days", days: 3 },
	{ kind: "days", days: 7 },
	{ kind: "days", days: 14 },
];

/** How far from the player's rating an opponent may be: any, or within ± this many points. */
export const RATING_RANGES = ["any", "100", "200", "400"] as const;
export type RatingRange = (typeof RATING_RANGES)[number];

/** Lichess's `ratingRange` ("1400-1800") around a rating, or null for anyone. */
export function ratingRangeOf(range: RatingRange, rating: number | null): string | null {
	if (range === "any" || rating === null) return null;
	const spread = Number(range);
	return `${Math.max(400, Math.round(rating - spread))}-${Math.round(rating + spread)}`;
}

/** The Lichess AI's levels. */
export const AI_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Which seeks quick pairing offers (Task 79, decision 0268): every pace, only clocks, only
 * correspondence, or none (the tiles go and the seek calls refuse).
 */
export const QUICK_PAIR_MODES = ["all", "clock", "days", "off"] as const;
export type QuickPairMode = (typeof QUICK_PAIR_MODES)[number];

/** Whether quick pairing may seek at this pace. */
export const quickPairAllows = (mode: QuickPairMode, kind: OnlinePace["kind"]): boolean =>
	mode === "all" || (mode === "clock" && kind === "clock") || (mode === "days" && kind === "days");

/**
 * The admin's limits on online play (`ch_settings.play`, set on /admin/chaal/settings): the
 * Lichess AI's highest level, whether rated games may be asked for, and which seeks quick
 * pairing offers (Task 79). Read stored values through `readPlayLimits`, which falls back
 * field by field.
 */
export type PlayLimits = { aiMaxLevel: number; rated: boolean; quickPair: QuickPairMode };

export const DEFAULT_PLAY_LIMITS: PlayLimits = { aiMaxLevel: 8, rated: true, quickPair: "all" };

export function readPlayLimits(value: Partial<PlayLimits> | null | undefined): PlayLimits {
	const level = value?.aiMaxLevel;
	const quickPair = value?.quickPair;
	return {
		aiMaxLevel:
			typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 8
				? level
				: DEFAULT_PLAY_LIMITS.aiMaxLevel,
		rated: typeof value?.rated === "boolean" ? value.rated : DEFAULT_PLAY_LIMITS.rated,
		quickPair: (QUICK_PAIR_MODES as ReadonlyArray<unknown>).includes(quickPair)
			? (quickPair as QuickPairMode)
			: DEFAULT_PLAY_LIMITS.quickPair,
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
