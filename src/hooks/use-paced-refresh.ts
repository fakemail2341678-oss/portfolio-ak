import { useThrottledCallback } from "@tanstack/react-pacer";

/** How long a burst of events is gathered into one reload. */
export const REFRESH_WAIT_MS = 1_000;

/**
 * A reload that events may ask for as often as they come: a poll that found a moved `rev`,
 * a realtime message, the tab's focus (TanStack Pacer's throttle, decision 0299). It runs at
 * once, then at most once per `wait`, and once more when the burst ends, so the last event is
 * never missed and ten events in a second read the page's data twice, not ten times:
 *
 *   const refresh = usePacedRefresh(() => refreshKharcha(queryClient, userId));
 *   useEffect(() => { if (moved) refresh(); }, [moved, refresh]);
 *
 * The user's own write still refreshes directly: it is one call, and it must not wait.
 */
export function usePacedRefresh(refresh: () => unknown, wait: number = REFRESH_WAIT_MS): () => void {
	return useThrottledCallback(
		() => {
			void refresh();
		},
		{ wait, leading: true, trailing: true },
	);
}
