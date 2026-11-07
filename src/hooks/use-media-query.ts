import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, e.g. `useMediaQuery("(min-width: 768px)")`.
 *
 * The server and hydration render `serverValue`, and the browser's answer follows
 * right after. Use it for things that appear on interaction (a sheet's side, a
 * chart's tick count), never to choose what a page renders at first paint: that
 * update would re-render the page after hydration (see design-system.md, "No
 * `isMobile` state after hydration"). Layout belongs in CSS.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		() => window.matchMedia(query).matches,
		() => serverValue,
	);
}
