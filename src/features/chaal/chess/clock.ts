import type { Color } from "./rules";

/**
 * Clock maths (PLAN 13.5, "Clocks"): showing time, naming time controls, and running a
 * pair of clocks on a monotonic time (`performance.now()` in the browser), so a reconnect
 * or a changed system clock never makes them jump. Live games set the times from Lichess's
 * `wtime`/`btime` at receipt (Task 77); local games press the clock themselves (Task 76).
 */

export type ClockParts = { hours: number; minutes: number; seconds: number; tenths: number };

export function clockParts(ms: number): ClockParts {
	const clamped = Math.max(0, ms);
	const tenthsTotal = Math.floor(clamped / 100);
	const secondsTotal = Math.floor(tenthsTotal / 10);
	return {
		hours: Math.floor(secondsTotal / 3600),
		minutes: Math.floor((secondsTotal % 3600) / 60),
		seconds: secondsTotal % 60,
		tenths: tenthsTotal % 10,
	};
}

const two = (value: number) => String(value).padStart(2, "0");

/** "1:02:03" from an hour; "8:15"; under ten seconds, tenths: "0:09.4". */
export function formatClock(ms: number): string {
	const { hours, minutes, seconds, tenths } = clockParts(ms);
	if (hours > 0) return `${hours}:${two(minutes)}:${two(seconds)}`;
	if (ms < 10_000) return `${minutes}:${two(seconds)}.${tenths}`;
	return `${minutes}:${two(seconds)}`;
}

/** A clock's start and increment, in seconds, as Lichess gives them (`clock.initial`, `clock.increment`). */
export type TimeControl = { initial: number; increment: number };

export type Speed = "ultraBullet" | "bullet" | "blitz" | "rapid" | "classical";

/**
 * Lichess's speed for a time control: the estimated game length (start + 40 × increment)
 * under 30 s is UltraBullet, under 3 min bullet, under 8 min blitz, under 25 min rapid.
 * The Board API allows only rapid and slower for seeks (PLAN 13.4).
 */
export function speedOf({ initial, increment }: TimeControl): Speed {
	const estimate = initial + 40 * increment;
	if (estimate < 30) return "ultraBullet";
	if (estimate < 180) return "bullet";
	if (estimate < 480) return "blitz";
	if (estimate < 1500) return "rapid";
	return "classical";
}

const FRACTIONS: Readonly<Record<number, string>> = { 15: "¼", 30: "½", 45: "¾", 90: "1½" };

/** "10+0", "3+2", "½+0" (Lichess's short clocks are fractions of a minute). */
export function formatTimeControl({ initial, increment }: TimeControl): string {
	const minutes = FRACTIONS[initial] ?? String(initial / 60);
	return `${minutes}+${increment}`;
}

/**
 * Two clocks at a moment: each side's time left at `since` (a monotonic time in ms), and
 * which one is running from then.
 */
export type ClockState = { white: number; black: number; running: Color | null; since: number };

/** A side's time left at `now`; never below zero. */
export function remaining(state: ClockState, color: Color, now: number): number {
	const left = state[color] - (state.running === color ? now - state.since : 0);
	return Math.max(0, left);
}

/**
 * The running side has moved at `now`: its time stops (plus the increment) and the other
 * side's starts. A clock that isn't running starts with the side to move (`first`).
 */
export function pressClock(state: ClockState, now: number, increment: number, first: Color = "white"): ClockState {
	if (!state.running) return { ...state, running: first, since: now };
	const mover = state.running;
	const next: Color = mover === "white" ? "black" : "white";
	return { ...state, [mover]: remaining(state, mover, now) + increment, running: next, since: now };
}

/** The side whose time has run out at `now`, if any. */
export function flagged(state: ClockState, now: number): Color | null {
	return state.running && remaining(state, state.running, now) === 0 ? state.running : null;
}
