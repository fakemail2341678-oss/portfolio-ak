/**
 * Each client's offset from server time (PLAN 12.5, "Clocks"; decision 0243), estimated the
 * way NTP does: the server's reading is taken to be from the middle of the round trip, and
 * the quickest of the recent trips is the most trustworthy.
 */

export type ClockSample = { sentAt: number; receivedAt: number; serverNow: number };

const KEPT = 5;

export const addSample = (samples: ReadonlyArray<ClockSample>, sample: ClockSample): ClockSample[] => [
	...samples.slice(-(KEPT - 1)),
	sample,
];

/** What to add to `Date.now()` to get server time; 0 before any sample. */
export function clockOffset(samples: ReadonlyArray<ClockSample>): number {
	let best: ClockSample | null = null;
	for (const sample of samples) {
		if (!best || sample.receivedAt - sample.sentAt < best.receivedAt - best.sentAt) best = sample;
	}
	return best ? Math.round(best.serverNow - (best.sentAt + best.receivedAt) / 2) : 0;
}
