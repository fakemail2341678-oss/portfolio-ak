import { useEffect } from "react";
import { z } from "zod";
import { QUERY_MAX } from "../search";

/**
 * The search overlay's memory (Task 66, decision 0239), in this browser only: the last
 * searches, and the titles and people opened lately. Never sent anywhere. Every access is
 * wrapped: storage can be full, off or refused.
 */

const SEARCHES_KEY = "pd_recent_searches";
const VIEWED_KEY = "pd_recent_viewed";
const MAX_SEARCHES = 6;
const MAX_VIEWED = 8;

export type RecentlyViewed = {
	media: "movie" | "tv" | "person";
	id: number;
	/** A title's slug; "" for a person. */
	slug: string;
	name: string;
	/** A poster or a portrait: TMDB's path, with the image base it came with. */
	picture: string | null;
	imageBase: string;
};

const viewedSchema = z.array(
	z.object({
		media: z.enum(["movie", "tv", "person"]),
		id: z.number().int().positive(),
		slug: z.string().max(200),
		name: z.string().max(300),
		picture: z.string().max(200).nullable(),
		imageBase: z.string().max(200),
	}),
);
const searchesSchema = z.array(z.string().max(QUERY_MAX));

function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
	try {
		const raw = window.localStorage.getItem(key);
		const parsed = raw === null ? undefined : schema.safeParse(JSON.parse(raw));
		return parsed?.success ? parsed.data : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Full, off or refused: the overlay simply forgets.
	}
}

function clear(key: string) {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// As above.
	}
}

export const recentSearches = (): string[] => read(SEARCHES_KEY, searchesSchema, []);

/** The latest first, without repeats (compared without case). */
export function rememberSearch(q: string) {
	const query = q.trim().slice(0, QUERY_MAX);
	if (!query) return;
	const others = recentSearches().filter((each) => each.toLocaleLowerCase() !== query.toLocaleLowerCase());
	write(SEARCHES_KEY, [query, ...others].slice(0, MAX_SEARCHES));
}

export const clearRecentSearches = () => clear(SEARCHES_KEY);

export const recentlyViewed = (): RecentlyViewed[] => read(VIEWED_KEY, viewedSchema, []);

export function rememberViewed(item: RecentlyViewed) {
	const others = recentlyViewed().filter((each) => each.media !== item.media || each.id !== item.id);
	write(VIEWED_KEY, [item, ...others].slice(0, MAX_VIEWED));
}

export const clearRecentlyViewed = () => clear(VIEWED_KEY);

/** Remembers the page's title or person for the overlay once it's shown (Task 66). */
export function useRememberViewed({ media, id, slug, name, picture, imageBase }: RecentlyViewed) {
	useEffect(() => {
		rememberViewed({ media, id, slug, name, picture, imageBase });
	}, [media, id, slug, name, picture, imageBase]);
}
