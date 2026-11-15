/**
 * Watch's controls (PLAN Task 82, decision 0272), set by the admin in `ch_settings.watch` on
 * /admin/chaal/settings and sent to every page with the status. Stored values are read
 * through `readWatchLimits`, which keeps only channels Chaal knows. Kept apart from the
 * watch pages' schema, so the status and the admin's form load nothing else.
 */

/** The TV channels Chaal shows (standard chess only: Lichess's variant channels aren't), in the grid's order. */
export const TV_CHANNELS = ["best", "bullet", "blitz", "rapid", "classical", "ultraBullet", "bot", "computer"] as const;
export type TvChannel = (typeof TV_CHANNELS)[number];

export const isTvChannel = (value: string): value is TvChannel =>
	(TV_CHANNELS as ReadonlyArray<string>).includes(value);

export type WatchLimits = {
	/** The channels the TV shows, at least one. */
	channels: TvChannel[];
	/** Whether the Watch page lists the streamers live now (links out to Twitch and YouTube). */
	streamers: boolean;
};

export const DEFAULT_WATCH_LIMITS: WatchLimits = { channels: [...TV_CHANNELS], streamers: true };

export function readWatchLimits(value: Partial<WatchLimits> | null | undefined): WatchLimits {
	const stored = Array.isArray(value?.channels) ? value.channels.filter((each) => isTvChannel(String(each))) : [];
	return {
		// In the grid's order, whatever order they were stored in; none left means all.
		channels: stored.length > 0 ? TV_CHANNELS.filter((each) => stored.includes(each)) : [...TV_CHANNELS],
		streamers: typeof value?.streamers === "boolean" ? value.streamers : DEFAULT_WATCH_LIMITS.streamers,
	};
}
