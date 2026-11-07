import type { savePardaProgress } from "@/functions/parda/library";
import type { recordPardaPlay } from "@/functions/parda/watch";

/**
 * A playback's writes, shared by the watch page and the party (decision 0236). Imported
 * lazily, so no page carries these stubs until a player runs. `keepalive` lets the
 * request outlive a page that's going away.
 */

type PlayReport = Parameters<typeof recordPardaPlay>[0]["data"];
type ProgressReport = Parameters<typeof savePardaProgress>[0]["data"];

/** The request options that let a call outlive the page. */
export const lasting = (keepalive: boolean) =>
	keepalive
		? { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, keepalive: true }) }
		: {};

export function reportPlay(data: PlayReport, keepalive = false) {
	void import("@/functions/parda/watch")
		.then(({ recordPardaPlay }) => recordPardaPlay({ data, ...lasting(keepalive) }))
		.catch(() => {});
}

export function reportProgress(data: ProgressReport, keepalive = false) {
	void import("@/functions/parda/library")
		.then(({ savePardaProgress }) => savePardaProgress({ data, ...lasting(keepalive) }))
		.catch(() => {});
}
