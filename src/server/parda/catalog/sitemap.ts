import "@tanstack/react-start/server-only";
import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { PARDA_PATHS } from "@/features/parda/links";
import { titleSlug } from "@/features/parda/slug";
import { pdBlockedTitle, pdCollection, pdCollectionItem, pdTitle } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { SitemapEntry } from "@/server/seo/sitemap";

/** Per media type: the top 500 titles in all (PLAN 12.5, "SEO"). */
const PER_MEDIA = 250;

/**
 * Parda's title pages in the sitemap (PLAN Task 63): the most popular of each media type
 * from `pd_title` (the daily refresh ranks them), minus takedowns, at their canonical
 * address with the slug; and the published curated collections with a title (decision 0242).
 */
export async function pardaSitemapEntries({ db }: { db: Db }): Promise<SitemapEntry[]> {
	const rows = await db
		.select({ media: pdTitle.media, id: pdTitle.tmdbId, title: pdTitle.title, refreshedAt: pdTitle.refreshedAt })
		.from(pdTitle)
		.where(
			and(
				isNotNull(pdTitle.popularityRank),
				lte(pdTitle.popularityRank, PER_MEDIA),
				sql`not exists (select 1 from ${pdBlockedTitle} where ${pdBlockedTitle.media} = ${pdTitle.media} and ${pdBlockedTitle.tmdbId} = ${pdTitle.tmdbId})`,
			),
		)
		.orderBy(asc(pdTitle.media), asc(pdTitle.popularityRank));
	const collections = await db
		.select({ slug: pdCollection.slug, updatedAt: pdCollection.updatedAt })
		.from(pdCollection)
		.where(
			and(
				eq(pdCollection.published, true),
				sql`exists (select 1 from ${pdCollectionItem} where ${pdCollectionItem.collectionId} = ${pdCollection.id})`,
			),
		)
		.orderBy(asc(pdCollection.slug));
	return [
		...collections.map((row) => ({ path: PARDA_PATHS.curated(row.slug), lastmod: row.updatedAt })),
		...rows.map((row) => ({
			path: PARDA_PATHS.title(row.media, row.id, titleSlug(row.title.en)),
			lastmod: row.refreshedAt,
		})),
	];
}
