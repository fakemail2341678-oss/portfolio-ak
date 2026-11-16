import { PacerProvider } from "@tanstack/react-pacer";
import type { ReactNode } from "react";

/**
 * The app's defaults for TanStack Pacer's hooks (decision 0299), set once at the root. A
 * hook's own options win: a debounce or a throttle always names its `wait` (the type asks
 * for it), so these are the values to reach for.
 * - debounce (typing, then one search or one URL entry): 250 ms;
 * - throttle (scroll, resize, drag, a burst of events that refetches): 100 ms, with a first
 *   call at once and a last one when the burst ends;
 * - queues (uploads): three at a time.
 */
export function PacingProvider({ children }: { children: ReactNode }) {
	return (
		<PacerProvider
			defaultOptions={{
				debouncer: { wait: 250 },
				throttler: { wait: 100, leading: true, trailing: true },
				asyncQueuer: { concurrency: 3 },
			}}
		>
			{children}
		</PacerProvider>
	);
}
