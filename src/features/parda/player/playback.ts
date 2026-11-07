/**
 * Playback's shared vocabulary (PLAN 12.5, decision 0236): isomorphic, so the schema, the
 * server functions and the watch page agree on it.
 */

/** What a viewer can report about a playback; `ads` is shown per source in the admin. */
export const PARDA_REPORT_KINDS = ["not-playing", "wrong-title", "quality", "audio-subtitles", "ads", "other"] as const;
export type PardaReportKind = (typeof PARDA_REPORT_KINDS)[number];

export type PardaReportStatus = "open" | "resolved" | "dismissed";

/**
 * The viewer's connection: `slow` under 10 Mbps (Chrome caps `downlink` at 10) or with
 * Save-Data, `ok` otherwise, `unknown` where the browser doesn't say.
 */
export const PARDA_BANDS = ["slow", "ok", "unknown"] as const;
export type PardaBand = (typeof PARDA_BANDS)[number];

export type PardaViewerKind = "account" | "guest" | "anonymous";

/** The connection band from `navigator.connection` (absent outside Chromium). */
export function connectionBand(connection: { downlink?: number; saveData?: boolean } | undefined): PardaBand {
	if (!connection || typeof connection.downlink !== "number") return "unknown";
	return connection.saveData || connection.downlink < 10 ? "slow" : "ok";
}
