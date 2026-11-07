import { isFinished, isStarted } from "./progress";
import type { ContinueItem, LibraryMedia } from "./types";

/**
 * What a browser keeps without a session (PLAN 12.5, decision 0236): progress (the 50
 * latest entries), the server the viewer picked and whether the ad-blocker hint is
 * hidden. Every access is wrapped: storage can be full, off or refused.
 */

const PROGRESS_KEY = "pd_progress";
const SERVER_KEY = "pd_server";
const BLOCKER_HINT_KEY = "pd_blocker_hint";
/** Set while local progress exists, so the server reserves the Continue watching rail's space (no shift). */
export const LOCAL_COOKIE = "pd_local";
const MAX_ENTRIES = 50;

export type LocalProgress = {
	media: LibraryMedia;
	id: number;
	season?: number;
	episode?: number;
	watched: number;
	duration: number | null;
	updatedAt: number;
	/** For the rail, which has no catalogue to ask. */
	slug: string;
	title: string;
	backdrop: string | null;
	/** The episode after this one, for "Next: S1 E2" once it's finished. */
	next?: { season: number; episode: number } | null;
};

const read = (key: string): string | null => {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const write = (key: string, value: string | null) => {
	try {
		if (value === null) window.localStorage.removeItem(key);
		else window.localStorage.setItem(key, value);
	} catch {
		// Full, off or refused: the viewer loses only this convenience.
	}
};

const setLocalCookie = (present: boolean) => {
	// biome-ignore lint/suspicious/noDocumentCookie: one non-sensitive flag; the Cookie Store API isn't in Safari or Firefox.
	document.cookie = `${LOCAL_COOKIE}=${present ? "1" : ""}; path=/; max-age=${present ? 15_552_000 : 0}; samesite=lax`;
};

const sameEntry = (a: LocalProgress, b: Pick<LocalProgress, "media" | "id" | "season" | "episode">) =>
	a.media === b.media && a.id === b.id && a.season === b.season && a.episode === b.episode;

const isEntry = (value: unknown): value is LocalProgress =>
	typeof value === "object" &&
	value !== null &&
	((value as LocalProgress).media === "movie" || (value as LocalProgress).media === "tv") &&
	Number.isSafeInteger((value as LocalProgress).id) &&
	typeof (value as LocalProgress).watched === "number" &&
	typeof (value as LocalProgress).updatedAt === "number" &&
	typeof (value as LocalProgress).title === "string" &&
	typeof (value as LocalProgress).slug === "string";

export function readLocalProgress(): LocalProgress[] {
	const raw = read(PROGRESS_KEY);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
	} catch {
		return [];
	}
}

export function saveLocalProgress(entry: LocalProgress): void {
	const rest = readLocalProgress().filter((each) => !sameEntry(each, entry));
	const entries = [entry, ...rest].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ENTRIES);
	write(PROGRESS_KEY, JSON.stringify(entries));
	setLocalCookie(true);
}

/** *Remove* without a session: the title's entries go. */
export function removeLocalTitle(media: LibraryMedia, id: number): void {
	const entries = readLocalProgress().filter((each) => !(each.media === media && each.id === id));
	write(PROGRESS_KEY, entries.length ? JSON.stringify(entries) : null);
	setLocalCookie(entries.length > 0);
}

export function clearLocalProgress(): void {
	write(PROGRESS_KEY, null);
	setLocalCookie(false);
}

/** In the browser only: true while it keeps progress of its own. */
export const hasLocalProgress = () => document.cookie.split("; ").includes(`${LOCAL_COOKIE}=1`);

/** The episode's or movie's own entry, for a resume without a session. */
export const localEntry = (media: LibraryMedia, id: number, season?: number, episode?: number) =>
	readLocalProgress().find((each) => sameEntry(each, { media, id, season, episode })) ?? null;

/** Continue watching from local entries: the latest per title, part way through, or finished with a next episode. */
export function localContinue(entries: ReadonlyArray<LocalProgress>): ContinueItem[] {
	const seen = new Set<string>();
	const items: ContinueItem[] = [];
	for (const entry of [...entries].sort((a, b) => b.updatedAt - a.updatedAt)) {
		const key = `${entry.media}:${entry.id}`;
		if (seen.has(key)) continue;
		const finished = isFinished(entry.media, entry.watched, entry.duration);
		if (!finished && !isStarted(entry.watched, entry.duration)) continue;
		seen.add(key);
		const base = {
			media: entry.media,
			id: entry.id,
			slug: entry.slug,
			title: entry.title,
			backdrop: entry.backdrop,
			poster: null,
		};
		if (!finished) {
			items.push({
				...base,
				cta: {
					kind: "resume",
					season: entry.season ?? null,
					episode: entry.episode ?? null,
					left: entry.duration === null ? null : Math.max(1, Math.ceil((entry.duration - entry.watched) / 60)),
					share: entry.duration ? Math.min(1, entry.watched / entry.duration) : 0,
				},
				share: entry.duration ? Math.min(1, entry.watched / entry.duration) : 0,
			});
		} else if (entry.media === "tv" && entry.next) {
			items.push({ ...base, cta: { kind: "next", ...entry.next }, share: 0 });
		}
	}
	return items;
}

/** The server the viewer picked (a source id), or null for Auto. */
export const pickedServer = () => read(SERVER_KEY);
export const pickServer = (sourceId: string | null) => write(SERVER_KEY, sourceId);

export const blockerHintHidden = () => read(BLOCKER_HINT_KEY) === "hidden";
export const hideBlockerHint = () => write(BLOCKER_HINT_KEY, "hidden");
