import type { PardaBand } from "./playback";
import type { StallSummary } from "./stall";
import type { WatchSource } from "./watch-types";

/**
 * The watch page's decisions (PLAN 12.5, "Server choice" and "Starting and failing";
 * decision 0236), pure so each rule is unit-tested: which source plays first, which one
 * a failure moves to, where a player starts, and when playback is stuttering.
 */

/** Timecodes differ between sources (PLAN 12.4), so another source starts this much earlier. */
export const SWITCH_REWIND_S = 30;

/** The sources to try, in order: the viewer's pick first (when it can play this), then the order for their connection. */
export function playOrder(
	sources: ReadonlyArray<WatchSource>,
	order: { ok: ReadonlyArray<string>; slow: ReadonlyArray<string> },
	band: PardaBand,
): WatchSource[] {
	const ids = band === "slow" ? order.slow : order.ok;
	return ids.flatMap((id) => sources.filter((source) => source.id === id));
}

/** The first source to load: the pick, if it's still there, else the order's first. */
export function firstSource(order: ReadonlyArray<WatchSource>, picked: string | null): WatchSource | null {
	return order.find((source) => source.id === picked) ?? order[0] ?? null;
}

/** A source that reports nothing can't fail on its own: it never falls back, and an admin can turn falling back off. */
export const fallsBack = (source: Pick<WatchSource, "adapter" | "autoFallback">) =>
	source.adapter !== "none" && source.autoFallback;

/**
 * Where a failure goes (PLAN 12.5): the next untried source in another CDN group (rows
 * that fail together share one; null is a group of its own), then any untried one.
 */
export function nextSource(
	order: ReadonlyArray<WatchSource>,
	tried: ReadonlySet<string>,
	failed: Pick<WatchSource, "cdnGroup">,
): WatchSource | null {
	const untried = order.filter((source) => !tried.has(source.id));
	const elsewhere = untried.find((source) => source.cdnGroup === null || source.cdnGroup !== failed.cdnGroup);
	return elsewhere ?? untried[0] ?? null;
}

export type Resume = { position: number; sourceId: string | null };

/**
 * Where a `param` player starts: our record, 30 s earlier on a source other than the
 * one that recorded it (unknown counts as other). Never below 0.
 */
export function startFor(source: Pick<WatchSource, "id">, resume: Resume | null): number {
	if (!resume || resume.position <= 0) return 0;
	const rewind = resume.sourceId === source.id ? 0 : SWITCH_REWIND_S;
	return Math.max(0, Math.floor(resume.position - rewind));
}

/**
 * The first report from a player that keeps its own memory (`self`, `none`) is this far
 * behind ours: say where the viewer was ("You were at 34:10").
 */
export const BEHIND_S = 60;
export const isBehind = (ours: number | null, reported: number) => ours !== null && ours - reported > BEHIND_S;

/** Stuttering (PLAN 12.5): 2 stalls, or 6 s stalled, in the first 2 minutes. Parda only offers to switch. */
export const STUTTER = { withinS: 120, count: 2, ms: 6_000 } as const;
export const isStuttering = (stalls: StallSummary, playedS: number) =>
	playedS <= STUTTER.withinS && (stalls.count >= STUTTER.count || stalls.ms >= STUTTER.ms);

/** Up next appears this long before the end (or at the end), and counts down this long. */
export const UP_NEXT_BEFORE_S = 30;
export const UP_NEXT_COUNTDOWN_S = 10;
export const isNearEnd = (position: number, duration: number | null) =>
	duration !== null && duration > UP_NEXT_BEFORE_S * 2 && duration - position <= UP_NEXT_BEFORE_S;

/** "34:10", "1:02:05". */
export function formatClock(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = String(total % 60).padStart(2, "0");
	return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}
