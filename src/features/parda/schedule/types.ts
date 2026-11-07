/**
 * The schedule's and the alerts' answers (PLAN Task 68, decision 0241): lean, because
 * the dehydrated state is in the page. Pictures are TMDB paths plus one `imageBase`.
 */

/** One episode on a day of the schedule. */
export type ScheduleEntry = {
	id: number;
	slug: string;
	title: string;
	poster: string | null;
	season: number;
	episode: number;
	/** The episode's name; empty when TMDB has none yet. */
	name: string;
	/** "YYYY-MM-DD", the airing country's date as TMDB gives it. */
	airDate: string;
	/** A series the profile follows, or anime airing this week. */
	kind: "following" | "anime";
};

export type ScheduleDay = { day: string; entries: ScheduleEntry[] };

/** A followed series' episodes in the next 14 days (the viewer's half of the schedule). */
export type FollowingSchedule = { imageBase: string; entries: ScheduleEntry[] };

/** One alert in the bell: new episodes of a series, from `episode` to `lastEpisode` of `season`. */
export type InboxItem = {
	id: string;
	tmdbId: number;
	slug: string;
	title: string;
	poster: string | null;
	season: number;
	episode: number;
	lastEpisode: number;
	createdAt: string;
	read: boolean;
};

export type InboxData = { imageBase: string; items: InboxItem[]; unread: number };

/** The home's New episodes rail: each series once, its latest alert, until the profile watched it. */
export type NewEpisodeItem = {
	id: number;
	slug: string;
	title: string;
	backdrop: string | null;
	season: number;
	episode: number;
	lastEpisode: number;
};

/** Anime airing in the week from today (the schedule's half for everyone). */
export type AnimeWeekData =
	| { configured: false }
	| { configured: true; today: string; imageBase: string; entries: ScheduleEntry[]; failed: boolean };
