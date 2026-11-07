import "@tanstack/react-start/server-only";
import { asc, isNotNull } from "drizzle-orm";
import { pdBlockedTitle, pdSettings, pdSource, pdTitle } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { loadCuration } from "./curation";
import { latestStandings } from "./player/stats";

/**
 * The rows every page's reads depend on, read from Postgres at most every 30 s per
 * process (decision 0229): takedowns, the settings, the sources and their latest daily
 * standings (decision 0238), and what the admin curates (decision 0242). A change reaches
 * every server within 30 s, without a query on each read.
 */
const TTL_MS = 30_000;
const CERTIFICATIONS_TTL_MS = 10 * 60_000;

export type PardaSourceRow = typeof pdSource.$inferSelect;

const DEFAULT_SETTINGS = { region: "US", cacheEpoch: 0, playbackEnabled: true, sourceOrder: "auto" } as const;

const cached = <T>(load: () => Promise<T>, now: () => number, ttl = TTL_MS) => {
	let entry: { value: Promise<T>; until: number } | undefined;
	const read = () => {
		if (!entry || now() >= entry.until) {
			const value = load();
			const current = { value, until: now() + ttl };
			entry = current;
			// A failed read isn't kept: the next caller tries again.
			value.catch(() => {
				if (entry === current) entry = undefined;
			});
		}
		return entry.value;
	};
	return Object.assign(read, {
		clear: () => {
			entry = undefined;
		},
	});
};

export const titleKey = (media: string, id: number) => `${media}:${id}`;

export function createPardaControls(db: Db, now: () => number = Date.now) {
	const blocked = cached(async () => {
		const rows = await db.select({ media: pdBlockedTitle.media, id: pdBlockedTitle.tmdbId }).from(pdBlockedTitle);
		return new Set(rows.map((row) => titleKey(row.media, row.id)));
	}, now);
	const settings = cached(async () => {
		const [row] = await db.select().from(pdSettings).limit(1);
		return row ?? DEFAULT_SETTINGS;
	}, now);
	const sources = cached(() => db.select().from(pdSource).orderBy(asc(pdSource.position)), now);
	const standings = cached(() => latestStandings(db), now);
	const curation = cached(() => loadCuration(db), now);
	// The daily job changes these; ten minutes keeps a kids' list from querying them on every read.
	const certifications = cached(
		async () => {
			const rows = await db
				.select({ media: pdTitle.media, id: pdTitle.tmdbId, certification: pdTitle.certification })
				.from(pdTitle)
				.where(isNotNull(pdTitle.certification));
			return new Map(rows.map((row) => [titleKey(row.media, row.id), row.certification ?? ""]));
		},
		now,
		CERTIFICATIONS_TTL_MS,
	);
	return {
		blocked,
		settings,
		sources,
		/** Each source's latest daily rollup and score: what the automatic order reads. */
		standings,
		/** Billboard slots, collections and each page's saved rails. */
		curation,
		/** The US certificate of every title `pd_title` knows one for: what a kids' list is filtered by (decision 0240). */
		certifications,
		/**
		 * After an admin's write (decision 0237): this process reads the rows again at once,
		 * so the admin sees the change on the next page; other servers within 30 s.
		 */
		invalidate: () => {
			blocked.clear();
			settings.clear();
			sources.clear();
			standings.clear();
			curation.clear();
			certifications.clear();
		},
	};
}

export type PardaControls = ReturnType<typeof createPardaControls>;
