import type { ComponentProps } from "react";
import type { Thing, WithContext } from "schema-dts";
import { m } from "@/paraglide/messages";
import { baseLocale, getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";
import { clientEnv } from "./env/client";
import { formatNumber } from "./i18n/intl";

/** Title template: "Page · Site". The site name comes from VITE_APP_TITLE. */
export const pageTitle = (page?: string): string =>
	page ? `${page} · ${clientEnv.VITE_APP_TITLE}` : clientEnv.VITE_APP_TITLE;

/** Absolute URL on the public origin (VITE_SITE_URL). */
export const absoluteUrl = (path: string): string => new URL(path, clientEnv.VITE_SITE_URL).href;

/** The page's URL in a given language ("/test-crud" -> "/ne/test-crud" for ne). */
export const localizedUrl = (path: string, locale: Locale): string => absoluteUrl(localizeHref(path, { locale }));

export const OG_LOCALES: Readonly<Record<Locale, string>> = { en: "en_US", ne: "ne_NP" };

/** A social preview image. `url` is absolute or a site path. */
export type SeoImage = { url: string; width: number; height: number; alt: string };

/** Used when a page has no image of its own (public/og-default.png, 1200x630). */
export const defaultOgImage = (): SeoImage => ({
	url: "/og-default.png",
	width: 1200,
	height: 630,
	alt: clientEnv.VITE_APP_TITLE,
});

/** A schema.org object; `@context` is added by seo(). */
export type JsonLd = Exclude<Thing, string>;

/** Private pages (admin, auth, account, dev, tokens in the URL): kept out of search results. */
export const NOINDEX = { name: "robots", content: "noindex, nofollow" } as const;

/** Head for a private page: its title plus NOINDEX. Layouts add NOINDEX for their children too. */
export const privateHead = (title?: string) => ({ meta: [{ title: pageTitle(title) }, NOINDEX] });

export type SeoInput = {
	/** Page title without the site name (the template adds it). Omitted on the home page: the site name alone. */
	title?: string | undefined;
	description: string;
	/** De-localized path with any query that identifies the page, e.g. "/test-crud?page=2". */
	path: string;
	/** Preview image; the site default when missing. */
	image?: SeoImage | null | undefined;
	type?: "website" | "article";
	/** For indexable-looking pages that shouldn't be indexed (e.g. search results): links are still followed. */
	noindex?: boolean;
	/** schema.org data for the page, emitted as <script type="application/ld+json">. */
	jsonLd?: JsonLd | ReadonlyArray<JsonLd>;
	/** The product the page belongs to, when it isn't the site (Taskline, decision 0208): the title suffix and og:site_name. */
	siteName?: string;
};

/** One entry of a route head's `meta` array. */
export type HeadMeta = ComponentProps<"meta">;

/**
 * A JSON-LD head entry. TanStack Router renders `{ "script:ld+json": data }`
 * as <script type="application/ld+json"> with "<", ">" and "&" escaped
 * (headContentUtils); its head() type only lists <meta> props, hence the cast.
 */
export const jsonLdMeta = (data: JsonLd): HeadMeta => {
	const entry: { "script:ld+json": WithContext<JsonLd> } = {
		"script:ld+json": { "@context": "https://schema.org", ...data },
	};
	return entry as unknown as HeadMeta;
};

const isJsonLdList = (value: JsonLd | ReadonlyArray<JsonLd>): value is ReadonlyArray<JsonLd> => Array.isArray(value);

/**
 * Head tags for a public page: title, description, robots, canonical, hreflang
 * alternates for every locale plus x-default, Open Graph, Twitter cards and
 * JSON-LD. Spread into a route's `head`: `head: () => seo({...})`.
 */
export function seo({
	title,
	description,
	path,
	image,
	type = "website",
	noindex = false,
	jsonLd = [],
	siteName = clientEnv.VITE_APP_TITLE,
}: SeoInput) {
	const locale = getLocale();
	const canonical = localizedUrl(path, locale);
	const shortTitle = title ?? siteName;
	const preview = image ?? defaultOgImage();
	const imageUrl = absoluteUrl(preview.url);
	const structured: ReadonlyArray<JsonLd> = isJsonLdList(jsonLd) ? jsonLd : [jsonLd];
	const meta: HeadMeta[] = [
		{ title: title ? `${title} · ${siteName}` : siteName },
		{ name: "description", content: description },
		{ name: "robots", content: noindex ? "noindex, follow" : "index, follow, max-image-preview:large" },
		{ property: "og:type", content: type },
		{ property: "og:site_name", content: siteName },
		{ property: "og:title", content: shortTitle },
		{ property: "og:description", content: description },
		{ property: "og:url", content: canonical },
		{ property: "og:locale", content: OG_LOCALES[locale] },
		...locales
			.filter((other) => other !== locale)
			.map((other) => ({ property: "og:locale:alternate", content: OG_LOCALES[other] })),
		{ property: "og:image", content: imageUrl },
		{ property: "og:image:width", content: String(preview.width) },
		{ property: "og:image:height", content: String(preview.height) },
		{ property: "og:image:alt", content: preview.alt },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: shortTitle },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: imageUrl },
		{ name: "twitter:image:alt", content: preview.alt },
		...structured.map(jsonLdMeta),
	];
	return {
		meta,
		links: [
			{ rel: "canonical", href: canonical },
			...locales.map((other) => ({ rel: "alternate", hrefLang: other, href: localizedUrl(path, other) })),
			{ rel: "alternate", hrefLang: "x-default", href: localizedUrl(path, baseLocale) },
		],
	};
}

export type ListSeoInput = Omit<SeoInput, "path" | "noindex"> & {
	/** The list's de-localized path, e.g. "/test-crud". */
	path: string;
	q: string;
	page: number;
};

/**
 * A public list page. Page 1 is canonical at the bare path; later pages are
 * their own URLs with their own title and description; searches are noindex.
 * Other params (sort) don't change the canonical.
 *
 * No page uses it today (the Test CRUD list moved to the private /dev), but it is
 * the list-page recipe's head (docs/guides/conventions.md) for the next public list,
 * so knip is told it's kept on purpose.
 *
 * @public
 */
export function listSeo({ title = clientEnv.VITE_APP_TITLE, description, path, q, page, ...rest }: ListSeoInput) {
	const paged = page > 1 && !q;
	const pageLabel = formatNumber(page);
	return seo({
		...rest,
		title: q
			? m.seo_list_search_title({ title, q })
			: paged
				? m.seo_list_page_title({ title, page: pageLabel })
				: title,
		description: paged ? m.seo_list_page_description({ description, page: pageLabel }) : description,
		path: paged ? `${path}?page=${page}` : path,
		noindex: q !== "",
	});
}
