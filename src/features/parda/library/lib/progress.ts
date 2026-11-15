/**
 * Continue watching's rules (PLAN 12.5, "Continue watching rules"; decision 0236). Pure and
 * isomorphic: the server applies them to a profile's rows, and the watch page to the
 * progress a browser keeps without a session.
 */

export type ProgressMedia = "movie" | "tv";

/** Started after a minute or 2%. */
export const STARTED_SECONDS = 60;
export const STARTED_SHARE = 0.02;
/** Finished at 92%, or with 5 minutes left of a movie, 2 of an episode. */
export const FINISHED_SHARE = 0.92;
export const FINISHED_LEFT = { movie: 300, tv: 120 } as const;
/** Untouched for six months: off the rail (History keeps it, Task 67). */
export const CONTINUE_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000;

export function isStarted(watched: number, duration: number | null): boolean {
	if (watched >= STARTED_SECONDS) return true;
	return duration !== null && duration > 0 && watched / duration >= STARTED_SHARE;
}

export function isFinished(media: ProgressMedia, watched: number, duration: number | null): boolean {
	if (duration === null || duration <= 0) return false;
	return watched / duration >= FINISHED_SHARE || duration - watched <= FINISHED_LEFT[media];
}

export type ProgressRow = {
	season: number | null;
	episode: number | null;
	watched: number;
	duration: number | null;
	finished: boolean;
	/** Epoch ms. */
	updatedAt: number;
};

export type EpisodeKey = { season: number; episode: number };

/** A series' shape: its seasons' sizes, and the last episode that has aired (null: none yet, or unknown). */
export type SeriesShape = {
	seasons: ReadonlyArray<{ number: number; episodes: number }>;
	latest: EpisodeKey | null;
};

export type ContinueEntry =
	/** Part way through: the movie, or this episode. */
	| { kind: "resume"; season: number | null; episode: number | null; watched: number; duration: number | null }
	/** The episode after the last one finished, not yet watched, aired. */
	| { kind: "next"; season: number; episode: number }
	/** The next one hasn't aired: the series waits in Schedule (Task 68). */
	| { kind: "schedule"; season: number; episode: number }
	/** Watched to the end: off the rail, *Rewatch* on the title. */
	| { kind: "complete" };

const compare = (a: EpisodeKey, b: EpisodeKey) => a.season - b.season || a.episode - b.episode;

/** Latest first; a tie (a season marked at once) goes to the later episode. */
const byRecent = (a: ProgressRow, b: ProgressRow) =>
	b.updatedAt - a.updatedAt || (b.season ?? 0) - (a.season ?? 0) || (b.episode ?? 0) - (a.episode ?? 0);

const keyOf = (row: Pick<ProgressRow, "season" | "episode">) => `${row.season}:${row.episode}`;

/**
 * The first episode after `after` that isn't finished, across seasons and skipping
 * specials (season 0). After a special, the walk starts at the first regular episode.
 */
export function nextUnwatched(shape: SeriesShape, finished: ReadonlySet<string>, after: EpisodeKey): EpisodeKey | null {
	const regular = shape.seasons.filter((season) => season.number > 0).sort((a, b) => a.number - b.number);
	for (const season of regular) {
		for (let episode = 1; episode <= season.episodes; episode++) {
			const key = { season: season.number, episode };
			if (after.season > 0 && compare(key, after) <= 0) continue;
			if (!finished.has(keyOf(key))) return key;
		}
	}
	return null;
}

/** Has `key` aired, given the last aired episode? Unknown counts as aired, so nothing is hidden for lack of data. */
const aired = (shape: SeriesShape, key: EpisodeKey) => shape.latest === null || compare(key, shape.latest) <= 0;

/**
 * What Continue watching shows for one title, from its rows: null when nothing has
 * started. A movie resumes or is complete. A series resumes the episode in progress,
 * or goes on to the next unwatched one; when that hasn't aired it waits in Schedule,
 * and when there's none left it's complete. Rows that only opened a player (under a
 * minute, unfinished) don't count.
 */
export function continueEntry(
	media: ProgressMedia,
	rows: ReadonlyArray<ProgressRow>,
	shape?: SeriesShape,
): ContinueEntry | null {
	const relevant = rows.filter((row) => row.finished || isStarted(row.watched, row.duration)).sort(byRecent);
	const latest = relevant[0];
	if (!latest) return null;
	if (!latest.finished) {
		return {
			kind: "resume",
			season: latest.season,
			episode: latest.episode,
			watched: latest.watched,
			duration: latest.duration,
		};
	}
	if (media === "movie" || !shape || latest.season === null || latest.episode === null) return { kind: "complete" };
	const finished = new Set(rows.filter((row) => row.finished).map(keyOf));
	const next = nextUnwatched(shape, finished, { season: latest.season, episode: latest.episode });
	if (!next) return { kind: "complete" };
	return aired(shape, next) ? { kind: "next", ...next } : { kind: "schedule", ...next };
}

/** Seconds left of a resume, rounded up to whole minutes for "23 min left". */
export const minutesLeft = (watched: number, duration: number | null) =>
	duration === null ? null : Math.max(1, Math.ceil((duration - watched) / 60));

/** An episode's or a movie's bar: the share watched, 1 when finished. */
export const progressShare = (row: Pick<ProgressRow, "watched" | "duration" | "finished">) =>
	row.finished ? 1 : row.duration ? Math.min(1, row.watched / row.duration) : 0;

/** Every episode up to the last aired one (a whole series or season marked watched). */
export function airedEpisodes(shape: SeriesShape, season?: number): EpisodeKey[] {
	const keys: EpisodeKey[] = [];
	for (const each of shape.seasons) {
		if (season !== undefined ? each.number !== season : each.number === 0) continue;
		for (let episode = 1; episode <= each.episodes; episode++) {
			const key = { season: each.number, episode };
			if (aired(shape, key)) keys.push(key);
		}
	}
	return keys;
}
