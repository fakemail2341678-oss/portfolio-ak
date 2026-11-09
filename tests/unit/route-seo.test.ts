import { type AnyRoute, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { pageTitle } from "@/lib/seo";
import { type Locale, locales, overwriteGetLocale } from "@/paraglide/runtime";
import type { RouterContext } from "@/router";
import { routeTree } from "@/routeTree.gen";

/**
 * SEO rules for EVERY route, from the real route tree: each page's head is
 * computed the way TanStack Router merges it (the deepest route wins per meta
 * name/property and for the title; links and JSON-LD add up), in both locales.
 *
 * - Indexable pages (INDEXABLE below) have a unique localized title and
 *   description, robots index, a canonical, hreflang en/ne/x-default, Open
 *   Graph + Twitter tags and, where they apply, valid JSON-LD.
 * - Every other page is noindex. A new page that is neither fails here: give it
 *   seo() (and add it to INDEXABLE) or privateHead() / a private layout.
 */

type Meta = Record<string, unknown>;
type Link = { rel?: string; hrefLang?: string; href?: string };
type Head = { meta?: Array<Meta | undefined>; links?: Array<Link | undefined> };
type HeadContext = { match: { search: Record<string, unknown> }; params: Record<string, string>; loaderData: unknown };

const SITE = "http://localhost:3000";

// portfolio:start
/** Loader data the portfolio pages' heads read (src/routes/_site). */
const samplePerson = {
	name: "Aarav Shrestha",
	role: "Full-stack developer",
	intro: "Ten years of shipping web products end to end, from schema to pixel.",
	socials: ["https://example.com/github"],
	seo: { title: "", description: "", image: null },
};
const sampleProject = {
	title: "Ledgerline",
	summary: "A treasury dashboard that closes the month in hours, not days.",
	slug: "ledgerline",
	year: 2026,
	client: "Himal Capital",
	stack: ["PostgreSQL", "TanStack Start"],
	image: null,
	preview: false,
};
const samplePost = {
	title: "Server-render everything",
	excerpt: "A love letter to complete HTML, and why spinners are expensive.",
	slug: "server-render-everything",
	publishedAt: "2026-09-02",
	tags: ["React", "SSR"],
	image: null,
	preview: false,
};
// portfolio:end

// parda:start
/** The heads of Parda's pages titled by TMDB (src/features/parda/title/load.ts builds them). */
const pardaHead = (title: string, path: string, jsonLd: Meta) => ({
	title,
	description: `${title}: a sample description long enough for the rules.`,
	path,
	image: { url: "https://image.tmdb.org/t/p/w1280/backdrop.jpg", width: 1280, height: 720, alt: title },
	jsonLd,
	preload: null,
});
const pardaContentPages: ReadonlyArray<{
	to: string;
	label: string;
	context: Partial<HeadContext>;
	path: string;
	siteName: string;
}> = [
	{
		to: "/app/parda/$type/$id",
		label: "parda title",
		context: {
			params: { type: "movie", id: "550-fight-club" },
			loaderData: pardaHead("Fight Club (1999)", "/app/parda/movie/550-fight-club", {
				"@type": "Movie",
				name: "Fight Club",
			}),
		},
		path: "/app/parda/movie/550-fight-club",
		siteName: "Parda",
	},
	{
		to: "/app/parda/$type/$id/credits",
		label: "parda credits",
		context: {
			params: { type: "series", id: "1396-breaking-bad" },
			loaderData: pardaHead("Breaking Bad: cast and crew", "/app/parda/series/1396-breaking-bad/credits", {
				"@type": "WebPage",
				name: "Breaking Bad: cast and crew",
			}),
		},
		path: "/app/parda/series/1396-breaking-bad/credits",
		siteName: "Parda",
	},
	{
		to: "/app/parda/person/$id",
		label: "parda person",
		context: {
			params: { id: "287" },
			loaderData: pardaHead("Brad Pitt", "/app/parda/person/287", { "@type": "Person", name: "Brad Pitt" }),
		},
		path: "/app/parda/person/287",
		siteName: "Parda",
	},
	{
		to: "/app/parda/collection/$id",
		label: "parda collection",
		context: {
			params: { id: "263" },
			loaderData: pardaHead("The Dark Knight Collection", "/app/parda/collection/263", {
				"@type": "CollectionPage",
				name: "The Dark Knight Collection",
			}),
		},
		path: "/app/parda/collection/263",
		siteName: "Parda",
	},
	{
		to: "/app/parda/c/$slug",
		label: "parda curated",
		context: {
			params: { slug: "festival-picks" },
			loaderData: pardaHead("Festival picks", "/app/parda/c/festival-picks", {
				"@type": "CollectionPage",
				name: "Festival picks",
			}),
		},
		path: "/app/parda/c/festival-picks",
		siteName: "Parda",
	},
];
// parda:end

/**
 * Every indexable page: its path (as in FileRoutesByTo, so the home is "/" whichever
 * layout serves it), the context its head() gets, and its expected canonical path.
 */
const INDEXABLE: ReadonlyArray<{
	to: string;
	label: string;
	context: Partial<HeadContext>;
	path: string;
	/** A product of its own titles its pages with its name (Taskline, decision 0208). */
	siteName?: string;
}> = [
	// portfolio:start
	{ to: "/", label: "home", context: { loaderData: samplePerson }, path: "/" },
	{ to: "/work", label: "work", context: { match: { search: {} } }, path: "/work" },
	{
		to: "/work/$slug",
		label: "case study",
		context: { params: { slug: "ledgerline" }, loaderData: sampleProject },
		path: "/work/ledgerline",
	},
	{ to: "/about", label: "about", context: { loaderData: samplePerson }, path: "/about" },
	{ to: "/journal", label: "journal", context: {}, path: "/journal" },
	{
		to: "/journal/$slug",
		label: "article",
		context: { params: { slug: samplePost.slug }, loaderData: samplePost },
		path: "/journal/server-render-everything",
	},
	{ to: "/contact", label: "contact", context: {}, path: "/contact" },
	// portfolio:end
	// apps:start
	{ to: "/apps", label: "apps", context: {}, path: "/apps" },
	{ to: "/apps/notes", label: "notes", context: { match: { search: {} } }, path: "/apps/notes" },
	{ to: "/apps/links", label: "links", context: {}, path: "/apps/links" },
	{ to: "/apps/expenses", label: "expenses", context: { match: { search: {} } }, path: "/apps/expenses" },
	{ to: "/apps/habits", label: "habits", context: { match: { search: {} } }, path: "/apps/habits" },
	{ to: "/apps/forms", label: "forms", context: {}, path: "/apps/forms" },
	// apps:end
	{ to: "/app/taskline", label: "taskline", context: {}, path: "/app/taskline", siteName: "Taskline" }, // @taskline
	// parda:start
	{ to: "/app/parda", label: "parda home", context: {}, path: "/app/parda", siteName: "Parda" },
	...(["movies", "series", "anime"] as const).map((hub) => ({
		to: "/app/parda/$hub",
		label: `parda ${hub}`,
		context: { params: { hub } },
		path: `/app/parda/${hub}`,
		siteName: "Parda",
	})),
	{ to: "/app/parda/about", label: "parda about", context: {}, path: "/app/parda/about", siteName: "Parda" },
	{ to: "/app/parda/discover", label: "parda discover", context: {}, path: "/app/parda/discover", siteName: "Parda" },
	...pardaContentPages,
	// parda:end
	// chaal:start
	{ to: "/app/chaal", label: "chaal home", context: {}, path: "/app/chaal", siteName: "Chaal" },
	{ to: "/app/chaal/about", label: "chaal about", context: {}, path: "/app/chaal/about", siteName: "Chaal" },
	{ to: "/app/chaal/analysis", label: "chaal analysis", context: {}, path: "/app/chaal/analysis", siteName: "Chaal" },
	{ to: "/app/chaal/play", label: "chaal play", context: {}, path: "/app/chaal/play", siteName: "Chaal" },
	{ to: "/app/chaal/puzzles", label: "chaal puzzles", context: {}, path: "/app/chaal/puzzles", siteName: "Chaal" },
	{ to: "/app/chaal/players", label: "chaal players", context: {}, path: "/app/chaal/players", siteName: "Chaal" },
	{ to: "/app/chaal/watch", label: "chaal watch", context: {}, path: "/app/chaal/watch", siteName: "Chaal" },
	{
		to: "/app/chaal/broadcasts",
		label: "chaal broadcasts",
		context: {},
		path: "/app/chaal/broadcasts",
		siteName: "Chaal",
	},
	// chaal:end
	// @strip-demo:indexable (the neutral landing page goes here when the portfolio is stripped)
	// @new-feature:indexable
];

/** Pages titled by their content (loader data), not by a message: the samples aren't translated. */
const CONTENT_TITLED = new Set([
	"home",
	"case study",
	"article",
	// parda:start
	"parda title",
	"parda credits",
	"parda person",
	"parda collection",
	"parda curated",
	// parda:end
	// @new-feature:content-titled
]);

// Building a router resolves every route's full id ("/_site/work/$slug") and path.
// Nothing loads, so the context is never read.
const router = createRouter({ routeTree, context: {} as RouterContext });
const children = (route: AnyRoute): AnyRoute[] => Object.values(route.children ?? {}) as AnyRoute[];
/** Pages: leaf routes that render something (server-only routes like /sitemap.xml have no component). */
const pages = (Object.values(router.routesById) as AnyRoute[]).filter(
	(route) => children(route).length === 0 && !(route.options.server && !route.options.component),
);
const byTo = new Map(pages.map((route) => [route.to as string, route]));

const ancestry = (route: AnyRoute): AnyRoute[] =>
	route.parentRoute ? [...ancestry(route.parentRoute), route] : [route];

function headFor(route: AnyRoute, context: Partial<HeadContext> = {}) {
	const full: HeadContext = { match: { search: {} }, params: {}, loaderData: undefined, ...context };
	const heads = ancestry(route).map(
		(each) => ((each.options as { head?: (ctx: HeadContext) => Head }).head?.(full) ?? {}) as Head,
	);
	// Router merge rules (headContentUtils): walk from the deepest match up.
	let title: string | undefined;
	const meta = new Map<string, string>();
	const jsonLd: Meta[] = [];
	for (const head of [...heads].reverse()) {
		for (const entry of [...(head.meta ?? [])].reverse()) {
			if (!entry) continue;
			if (typeof entry.title === "string") title ??= entry.title;
			else if ("script:ld+json" in entry) jsonLd.unshift(entry["script:ld+json"] as Meta);
			else {
				const key = (entry.name ?? entry.property) as string | undefined;
				if (key && !meta.has(key)) meta.set(key, String(entry.content));
			}
		}
	}
	const links = heads.flatMap((head) => (head.links ?? []).filter((link): link is Link => Boolean(link)));
	return { title, meta, links, jsonLd };
}

const localized = (path: string, locale: Locale) => new URL(locale === "en" ? path : `/ne${path}`, SITE).href;

afterEach(() => {
	overwriteGetLocale(() => "en");
});

describe.each(locales)("route SEO (%s)", (locale) => {
	const withLocale = <T>(run: () => T): T => {
		overwriteGetLocale(() => locale);
		return run();
	};

	it("every indexable page has a title, description, canonical, hreflang, Open Graph and Twitter tags", () => {
		withLocale(() => {
			for (const page of INDEXABLE) {
				const route = byTo.get(page.to);
				expect(route, page.to).toBeDefined();
				if (!route) continue;
				const head = headFor(route, page.context);
				const where = `${page.label} (${locale})`;
				expect(head.title, where).toMatch(new RegExp(`${page.siteName ?? pageTitle()}$`));
				expect(head.meta.get("description")?.length ?? 0, where).toBeGreaterThan(20);
				expect(head.meta.get("robots"), where).toMatch(/^index, follow/);

				const canonical = head.links.filter((link) => link.rel === "canonical");
				expect(
					canonical.map((link) => link.href),
					where,
				).toEqual([localized(page.path, locale)]);
				const alternates = Object.fromEntries(
					head.links.filter((link) => link.rel === "alternate").map((link) => [link.hrefLang, link.href]),
				);
				expect(alternates, where).toEqual({
					en: localized(page.path, "en"),
					ne: localized(page.path, "ne"),
					"x-default": localized(page.path, "en"),
				});

				expect(head.meta.get("og:url"), where).toBe(localized(page.path, locale));
				for (const key of ["og:title", "og:description", "og:image", "og:image:alt", "twitter:card", "twitter:image"]) {
					expect(head.meta.get(key), `${where} ${key}`).toBeTruthy();
				}
				expect(head.meta.get("og:image"), where).toMatch(/^https?:\/\//);
				expect(head.meta.get("og:locale"), where).toBe(locale === "en" ? "en_US" : "ne_NP");
			}
		});
	});

	it("indexable pages have unique titles and descriptions", () => {
		withLocale(() => {
			const heads = INDEXABLE.flatMap((page) => {
				const route = byTo.get(page.to);
				return route ? [headFor(route, page.context)] : [];
			});
			const titles = heads.map((head) => head.title);
			const descriptions = heads.map((head) => head.meta.get("description"));
			expect(new Set(titles).size).toBe(INDEXABLE.length);
			expect(new Set(descriptions).size).toBe(INDEXABLE.length);
		});
	});

	it("every other page is noindex", () => {
		withLocale(() => {
			const indexable = new Set(INDEXABLE.map((page) => page.to));
			const others = pages.filter((route) => !indexable.has(route.to));
			expect(others.length).toBeGreaterThan(15);
			for (const route of others) {
				// Detail-style heads may need params; private ones never read them.
				const head = headFor(route, { params: { id: "x", slug: "x" } });
				expect(head.meta.get("robots"), `${route.id} needs privateHead() or seo()`).toMatch(/noindex/);
				expect(head.title, route.id).toBeTruthy();
			}
		});
	});

	it("home describes the site (WebSite)", () => {
		withLocale(() => {
			const route = byTo.get("/");
			if (!route) throw new Error("home");
			const home = INDEXABLE.find((page) => page.to === "/");
			const website = headFor(route, home?.context).jsonLd.find((data) => data["@type"] === "WebSite");
			expect(website).toMatchObject({
				"@context": "https://schema.org",
				"@id": `${localized("/", locale)}#website`,
				name: "Portfolio",
				url: localized("/", locale),
				inLanguage: locale,
			});
		});
	});

	// portfolio:start
	it("the portfolio describes its owner, case studies and articles (Person, CreativeWork, BlogPosting)", () => {
		withLocale(() => {
			const jsonLdOf = (to: string, context: Partial<HeadContext>) => {
				const route = byTo.get(to);
				if (!route) throw new Error(to);
				return headFor(route, context).jsonLd;
			};
			const person = { "@id": `${SITE}/#person` };
			expect(jsonLdOf("/", { loaderData: samplePerson })).toEqual([
				expect.objectContaining({ "@type": "WebSite", publisher: person }),
				expect.objectContaining({ "@type": "Person", ...person, name: "Aarav Shrestha", sameAs: samplePerson.socials }),
			]);
			expect(jsonLdOf("/about", { loaderData: samplePerson })).toEqual([
				expect.objectContaining({ "@type": "ProfilePage", mainEntity: expect.objectContaining(person) }),
			]);
			const caseUrl = localized("/work/ledgerline", locale);
			expect(jsonLdOf("/work/$slug", { params: { slug: "ledgerline" }, loaderData: sampleProject })).toEqual([
				expect.objectContaining({
					"@type": "CreativeWork",
					"@id": `${caseUrl}#work`,
					name: "Ledgerline",
					creator: person,
					inLanguage: locale,
				}),
			]);
			const articleUrl = localized("/journal/server-render-everything", locale);
			expect(jsonLdOf("/journal/$slug", { params: { slug: samplePost.slug }, loaderData: samplePost })).toEqual([
				expect.objectContaining({
					"@type": "BlogPosting",
					"@id": `${articleUrl}#article`,
					headline: samplePost.title,
					datePublished: "2026-09-02",
					author: person,
				}),
			]);
		});
	});

	it("a filtered work index is noindex, still canonical to the full list", () => {
		withLocale(() => {
			const route = byTo.get("/work");
			if (!route) throw new Error("work");
			const head = headFor(route, { match: { search: { discipline: "ai" } } });
			expect(head.meta.get("robots")).toBe("noindex, follow");
			expect(head.links.find((link) => link.rel === "canonical")?.href).toBe(localized("/work", locale));
		});
	});
	// portfolio:end
});

it("English and Nepali pages have different titles (except pages titled by their content)", () => {
	const titles = (locale: Locale) => {
		overwriteGetLocale(() => locale);
		return INDEXABLE.filter((page) => !CONTENT_TITLED.has(page.label)).map((page) => {
			const route = byTo.get(page.to);
			return route ? headFor(route, page.context).title : undefined;
		});
	};
	const en = titles("en");
	const ne = titles("ne");
	en.forEach((title, index) => {
		expect(title).not.toBe(ne[index]);
	});
});
