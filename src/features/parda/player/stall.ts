import type { PlayerEvent } from "./adapters/types";

/**
 * Infers buffering (PLAN 12.5): no player reports it, so a player that says it's playing
 * while its position hasn't moved for 1.5 s counts as stalled, ignoring the 3 s after a
 * seek or a command. Ranking and watch parties share this. Pure: the caller passes the
 * time in and calls `tick` on an interval.
 */
export const STALL_AFTER_MS = 1_500;
export const SEEK_GRACE_MS = 3_000;

export type StallSummary = { stalled: boolean; count: number; ms: number };

export function createStallDetector() {
	let playing = false;
	let position: number | null = null;
	let movedAt = 0;
	let graceUntil = 0;
	let stalledAt: number | null = null;
	let count = 0;
	let finishedMs = 0;

	const clear = (now: number) => {
		if (stalledAt !== null) finishedMs += now - stalledAt;
		stalledAt = null;
	};

	return {
		observe(event: PlayerEvent, now: number) {
			switch (event.kind) {
				case "play":
					if (!playing) movedAt = now;
					playing = true;
					break;
				case "position":
					if (event.position !== position) {
						position = event.position;
						movedAt = now;
						playing = true;
						clear(now);
					}
					break;
				case "seeked":
					position = event.position;
					this.noteCommand(now);
					break;
				case "pause":
				case "ended":
				case "failed":
					playing = false;
					clear(now);
					break;
				case "ready":
					break;
			}
		},
		/** A seek or a command was sent: the player gets time to settle. */
		noteCommand(now: number) {
			graceUntil = now + SEEK_GRACE_MS;
			clear(now);
		},
		tick(now: number) {
			if (!playing || stalledAt !== null || now < graceUntil) return;
			if (now - Math.max(movedAt, graceUntil) >= STALL_AFTER_MS) {
				stalledAt = now;
				count += 1;
			}
		},
		summary(now: number): StallSummary {
			return {
				stalled: stalledAt !== null,
				count,
				ms: finishedMs + (stalledAt === null ? 0 : now - stalledAt),
			};
		},
	};
}
