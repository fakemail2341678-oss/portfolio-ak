import { useSyncExternalStore } from "react";

/**
 * One clock for the whole page, ticking each minute: a minute is the smallest
 * step anyone reads ("5 minutes ago", "6:12 am"), and one timer serves every
 * reader.
 */
const MINUTE = 60_000;
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	if (!timer) {
		timer = setInterval(() => {
			now = Date.now();
			for (const each of listeners) each();
		}, MINUTE);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer) {
			clearInterval(timer);
			timer = undefined;
		}
	};
};

const clientNow = () => {
	// Rounded to the minute, so every snapshot within one minute is the same value.
	if (!now || Date.now() - now >= MINUTE) now = Date.now();
	return now;
};

/**
 * The current time in milliseconds, hydration-safe: the server and the first
 * browser render use `renderedAt` (the time the data was read, e.g. a loader's
 * `generatedAt`), so both print the same thing. After hydration it follows the
 * browser's clock and updates each minute.
 */
export function useMinuteClock(renderedAt: number): number {
	return useSyncExternalStore(subscribe, clientNow, () => renderedAt);
}
