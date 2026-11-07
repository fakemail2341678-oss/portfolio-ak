import type { SeasonSummary, TitleVideo } from "../title/types";
import type { PardaSourceAdapter } from "./adapters/types";

/**
 * What the watch page receives (PLAN 12.5, "Starting and failing"; decision 0236): every
 * playable source, filled for this title except `{start}`, and two orders of their ids.
 * The page picks the order for the viewer's connection on mount, and only then loads a player.
 */

export type WatchSource = {
	id: string;
	name: { en: string; ne: string };
	/** Filled for this title, with `{start}` left for the page (`withStart`). */
	url: string;
	origins: string[];
	adapter: PardaSourceAdapter;
	sandbox: "none" | "popups" | "strict";
	adaptive: boolean;
	needsClick: boolean;
	autoFallback: boolean;
	/** Sources that fail together; null is a group of its own. */
	cdnGroup: string | null;
	/** How long the position may stay still after loading before it counts as failed. */
	deadlineMs: number;
	/** The quality measured for it ("1080p"), once Task 65a's probe says. */
	quality: string | null;
};

export type WatchEpisode = { season: number; episode: number; name: string; still: string | null };

export type WatchPageData =
	| { configured: false }
	| {
			configured: true;
			imageBase: string;
			title: {
				media: "movie" | "tv";
				id: number;
				slug: string;
				title: string;
				year: number | null;
				backdrop: string | null;
				poster: string | null;
				overview: string;
			};
			/** The episode playing; null for a movie. */
			episode: WatchEpisode | null;
			previous: { season: number; episode: number } | null;
			/** The episode after this one, when it has aired: Up next's target. */
			next: { season: number; episode: number } | null;
			seasons: SeasonSummary[];
			/** `off`: the kill switch; `none`: no source can play this. */
			playback: "on" | "off" | "none";
			sources: WatchSource[];
			/** Source ids: `ok` by rank, `slow` with adaptive sources first. */
			order: { ok: string[]; slow: string[] };
			/** Our record of this episode or movie, for a viewer with a session. */
			resume: { position: number; sourceId: string | null } | null;
			/** Up next counts down when true (the profile's choice). */
			autoplay: boolean;
			/** Watch parties are configured (PARDA_REALTIME_KEY): *Watch together* shows. */
			party: boolean;
			trailer: TitleVideo | null;
	  };
