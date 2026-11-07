import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { overwriteGetLocale } from "@/paraglide/runtime";
import { webManifest } from "@/server/seo/manifest";
import { robotsTxt } from "@/server/seo/robots";
import { sitemapEntries, sitemapXml } from "@/server/seo/sitemap";
import { seedPortfolio } from "../../scripts/lib/portfolio-seed.ts"; // @portfolio
import { createTestDb } from "../utils/test-db";

/** Pages with content read their entries from the database: the portfolio's demo content is seeded. */
let env: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
	env = await createTestDb();
	// portfolio:start
	await seedPortfolio(async (sql, params) => {
		const result = await env.client.query<Record<string, unknown>>(sql, params);
		return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
	});
	// portfolio:end
}, 60_000);
afterAll(() => env.close());
const entries = () => sitemapEntries({ db: env.db });

afterEach(() => {
	overwriteGetLocale(() => "en");
});

describe("sitemap", () => {
	it("lists the home page and the portfolio's pages first", async () => {
		const paths = (await entries()).map((entry) => entry.path);
		// portfolio:start
		const projects = paths.filter((path) => path.startsWith("/work/"));
		const posts = paths.filter((path) => path.startsWith("/journal/"));
		// portfolio:end
		const expected = [
			"/",
			// portfolio:start
			"/work",
			...projects,
			"/about",
			"/journal",
			...posts,
			"/contact",
			// portfolio:end
		];
		// Generated features with public pages follow (pnpm new:feature --public).
		expect(paths.slice(0, expected.length)).toEqual(expected);
		// portfolio:start
		// Published rows only, in display order, each with its last change.
		expect(projects).toHaveLength(7);
		expect(projects[0]).toBe("/work/ledgerline");
		expect(posts).toHaveLength(6);
		expect((await entries()).find((entry) => entry.path === "/work/ledgerline")?.lastmod).toBeInstanceOf(Date);
		// portfolio:end
	});

	it("never lists private pages", async () => {
		const paths = (await entries()).map((entry) => entry.path);
		for (const path of paths) {
			expect(path).not.toMatch(
				/^\/(admin|login|register|sign-in-code|forgot-password|account|health|dev|reset-password|verify-email|api)/,
			);
		}
	});

	it("writes one <url> per page and language, each with every hreflang alternate", () => {
		const xml = sitemapXml([
			{ path: "/" },
			{ path: "/work?page=2&x=<1>" },
			{ path: "/work/momo", lastmod: new Date("2026-10-01T00:00:00Z") },
		]);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
		expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
		expect(xml.match(/<url>/g)).toHaveLength(6);
		expect(xml).toContain("<loc>http://localhost:3000/</loc>");
		expect(xml).toContain("<loc>http://localhost:3000/ne/</loc>");
		expect(xml).toContain(
			"<url><loc>http://localhost:3000/ne/work/momo</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod>" +
				'<xhtml:link rel="alternate" hreflang="en" href="http://localhost:3000/work/momo"/>' +
				'<xhtml:link rel="alternate" hreflang="ne" href="http://localhost:3000/ne/work/momo"/>' +
				'<xhtml:link rel="alternate" hreflang="x-default" href="http://localhost:3000/work/momo"/></url>',
		);
		// Query strings are XML-escaped.
		expect(xml).toContain("/work?page=2&amp;x=%3C1%3E</loc>");
		expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
	});
});

describe("robots.txt", () => {
	it("points to the sitemap and keeps crawlers out of the admin area and endpoints", () => {
		expect(robotsTxt()).toBe(
			[
				"User-agent: *",
				"Allow: /",
				"Disallow: /admin",
				"Disallow: /ne/admin",
				"Disallow: /api/",
				"Disallow: /_serverFn/",
				"",
				"Sitemap: http://localhost:3000/sitemap.xml",
				"",
			].join("\n"),
		);
	});
});

describe("web manifest", () => {
	it("is localized and lists the app icons", () => {
		const english = webManifest("en");
		expect(english).toMatchObject({ name: "Portfolio", lang: "en", start_url: "/" });
		const manifest = webManifest("ne");
		expect(manifest).toMatchObject({ lang: "ne", start_url: "/ne/" });
		expect(manifest.description).not.toBe(english.description);
		expect(manifest.icons.map((icon) => icon.src)).toEqual([
			"/icon-192.png",
			"/icon-512.png",
			"/icon-maskable-512.png",
			"/favicon.svg",
		]);
	});
});
