import "@tanstack/react-start/server-only";
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { isAppError } from "@/lib/errors";
import { type PardaMedia, pdTitle } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import type { Tmdb } from "../tmdb/client";
import { fillInList, mapList, parse } from "../tmdb/mappers";

/** TMDB lists 20 titles a page: 25 pages are the top 500 of each media type. */
const PAGES = 25;
const MEDIA: ReadonlyArray<PardaMedia> = ["movie", "tv"];

/**
 * Refreshes `pd_title` from TMDB's popular lists. Ranks are rewritten: a title that left
 * the top keeps its row with no rank, since later tables may still point at it.
 */
export async function refreshTitles(db: Db, tmdb: Tmdb, pages = PAGES): Promise<{ titles: number }> {
	let titles = 0;
	for (const media of MEDIA) {
		const seen = new Set<number>();
		const rows: Array<typeof pdTitle.$inferInsert> = [];
		for (let page = 1; page <= pages; page += 1) {
			const [english, nepali] = await Promise.all([
				tmdb.get(`${media}/popular`, { page, language: "en-US" }).then((raw) => mapList(media, raw)),
				tmdb.get(`${media}/popular`, { page, language: "ne-NP" }).then((raw) => mapList(media, raw)),
			]);
			const filled = fillInList(nepali, english);
			for (const item of english.results) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				rows.push({
					media,
					tmdbId: item.id,
					title: { en: item.title, ne: filled.results.find((row) => row.id === item.id)?.title ?? item.title },
					poster: item.poster,
					backdrop: item.backdrop,
					year: item.year,
					genres: item.genres,
					popularityRank: rows.length + 1,
					refreshedAt: new Date(),
				});
			}
			if (page >= english.totalPages) break;
		}
		await db.transaction(async (tx) => {
			await tx.update(pdTitle).set({ popularityRank: null }).where(sql`${pdTitle.media} = ${media}`);
			if (rows.length === 0) return;
			await tx
				.insert(pdTitle)
				.values(rows)
				.onConflictDoUpdate({
					target: [pdTitle.media, pdTitle.tmdbId],
					set: {
						title: sql`excluded.title`,
						poster: sql`excluded.poster`,
						backdrop: sql`excluded.backdrop`,
						year: sql`excluded.year`,
						genres: sql`excluded.genres`,
						popularityRank: sql`excluded.popularity_rank`,
						refreshedAt: sql`excluded.refreshed_at`,
					},
				});
		});
		titles += rows.length;
	}
	return { titles };
}

/** A certificate is asked again after this long: they rarely change, and new titles come first. */
const CERTIFICATE_MAX_AGE_DAYS = 30;
/** Per run: about a minute at four at a time, well under TMDB's 40 a second; the top 1,000 fill in three days. */
const CERTIFICATES_PER_RUN = 400;
const CONCURRENCY = 4;

const releaseDates = z.object({
	results: z.array(
		z.object({
			iso_3166_1: z.string(),
			release_dates: z.array(z.object({ certification: z.string().nullish() })),
		}),
	),
});
const contentRatings = z.object({
	results: z.array(z.object({ iso_3166_1: z.string(), rating: z.string().nullish() })),
});

/** A title's US certificate from TMDB (the kids' cap ladder, decision 0240); null when it has none. */
export async function usCertificateOf(tmdb: Tmdb, media: PardaMedia, id: number): Promise<string | null> {
	if (media === "movie") {
		const answer = parse(releaseDates, await tmdb.get(`movie/${id}/release_dates`), "release dates");
		const us = answer.results.find((row) => row.iso_3166_1 === "US");
		return us?.release_dates.map((date) => date.certification?.trim()).find(Boolean) ?? null;
	}
	const answer = parse(contentRatings, await tmdb.get(`tv/${id}/content_ratings`), "content ratings");
	return answer.results.find((row) => row.iso_3166_1 === "US")?.rating?.trim() || null;
}

/**
 * Fills `pd_title.certification` for the ranked titles never asked, then the oldest asked
 * (decision 0240): what a kids' profile's search, trending and recommendations are
 * filtered by. A title TMDB can't answer for is tried again on a later run.
 */
export async function refreshCertificates(
	db: Db,
	tmdb: Tmdb,
	options: { limit?: number; now?: Date } = {},
): Promise<{ checked: number; failed: number }> {
	const now = options.now ?? new Date();
	const stale = new Date(now.getTime() - CERTIFICATE_MAX_AGE_DAYS * 86_400_000);
	const due = await db
		.select({ media: pdTitle.media, id: pdTitle.tmdbId })
		.from(pdTitle)
		.where(
			and(
				isNotNull(pdTitle.popularityRank),
				or(isNull(pdTitle.certificationCheckedAt), lt(pdTitle.certificationCheckedAt, stale)),
			),
		)
		.orderBy(sql`${pdTitle.certificationCheckedAt} asc nulls first`, asc(pdTitle.popularityRank))
		.limit(options.limit ?? CERTIFICATES_PER_RUN);
	let checked = 0;
	let failed = 0;
	for (let at = 0; at < due.length; at += CONCURRENCY) {
		await Promise.all(
			due.slice(at, at + CONCURRENCY).map(async (title) => {
				try {
					const certification = await usCertificateOf(tmdb, title.media, title.id);
					await db
						.update(pdTitle)
						.set({ certification, certificationCheckedAt: now })
						.where(and(eq(pdTitle.media, title.media), eq(pdTitle.tmdbId, title.id)));
					checked += 1;
				} catch (error) {
					if (!isAppError(error)) throw error;
					failed += 1;
					log("warn", "parda certificate unavailable", { media: title.media, id: title.id, ...errorFields(error) });
				}
			}),
		);
	}
	return { checked, failed };
}
