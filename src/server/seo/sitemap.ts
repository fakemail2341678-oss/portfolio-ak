import "@tanstack/react-start/server-only";
import { APPS, appPath } from "@/features/apps/registry"; // @apps
import { PARDA_SITEMAP } from "@/features/parda/links"; // @parda
import { localizedUrl } from "@/lib/seo";
import { baseLocale, locales } from "@/paraglide/runtime";
import { pardaSitemapEntries } from "@/server/parda/catalog/sitemap"; // @parda
import { listSitemap } from "@/server/portfolio/public"; // @portfolio
import type { Services } from "@/server/services";

/** One indexable page: its de-localized path (the canonical one) and when it last changed. */
export type SitemapEntry = { path: string; lastmod?: Date | undefined };

/** Features with public pages: each lists its own (`pnpm new:feature --public` adds one here). */
const SITEMAP_SOURCES: ReadonlyArray<(services: Pick<Services, "db">) => Promise<SitemapEntry[]>> = [
	pardaSitemapEntries, // @parda
	// @new-feature:sitemap
];

const escapeXml = (value: string) =>
	value.replace(/[<>&'"]/g, (char) => `&${{ "<": "lt", ">": "gt", "&": "amp", "'": "apos", '"': "quot" }[char]};`);

/**
 * Every indexable page: the same pages that seo() marks index (public, not a
 * search). Private pages (admin, auth, account, /dev, health, token links) never
 * appear here; they're noindex in their head. Features with public pages add
 * theirs from the database (SITEMAP_SOURCES).
 */
export async function sitemapEntries({ db }: Pick<Services, "db">): Promise<SitemapEntry[]> {
	const entries: SitemapEntry[] = [{ path: "/" }];
	// portfolio:start
	// The portfolio: its pages, and its published projects and posts (decision 0176).
	const portfolio = await listSitemap(db);
	entries.push(
		{ path: "/work" },
		...portfolio.projects.map((project) => ({ path: `/work/${project.slug}`, lastmod: project.updatedAt })),
		{ path: "/about" },
		{ path: "/journal" },
		...portfolio.posts.map((post) => ({ path: `/journal/${post.slug}`, lastmod: post.updatedAt })),
		{ path: "/contact" },
	);
	// portfolio:end
	// The showcase apps' gallery and landings (decision 0187); what's inside an app is private.
	entries.push({ path: "/apps" }, ...APPS.map((app) => ({ path: appPath(app.slug) }))); // @apps
	entries.push({ path: "/app/taskline" }); // @taskline
	entries.push(...PARDA_SITEMAP.map((path) => ({ path }))); // @parda
	for (const source of SITEMAP_SOURCES) entries.push(...(await source({ db })));
	return entries;
}

/**
 * sitemaps.org XML with one <url> per page per locale, each listing every
 * language version (hreflang en, ne and x-default), as Google documents for
 * localized pages.
 */
export function sitemapXml(entries: ReadonlyArray<SitemapEntry>): string {
	const urls = entries.flatMap((entry) => {
		const alternates = [
			...locales.map((locale) => [locale, localizedUrl(entry.path, locale)] as const),
			["x-default", localizedUrl(entry.path, baseLocale)] as const,
		]
			.map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href)}"/>`)
			.join("");
		const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.toISOString()}</lastmod>` : "";
		return locales.map(
			(locale) => `<url><loc>${escapeXml(localizedUrl(entry.path, locale))}</loc>${lastmod}${alternates}</url>`,
		);
	});
	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
		...urls,
		"</urlset>",
		"",
	].join("\n");
}
