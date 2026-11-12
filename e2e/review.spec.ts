/**
 * The browser review: every page in REVIEWED_PAGES, in en/ne × light/dark × 390/768/1280.
 * A route missing from the list fails tests/unit/e2e-pages.test.ts.
 */
import { E2E } from "./harness/config.ts";
import { pardaFixturePath } from "./harness/tmdb.ts"; // @parda
import { type Harness, RESOURCE_STATUS, signedIn, test } from "./support/fixtures.ts";
import {
	localizedPath,
	REVIEWED_PAGES,
	type ReviewedPage,
	routePattern,
	SEEDED_ITEM_SLUG,
	SEEDED_PUBLISHED_SLUG,
} from "./support/pages.ts";
import { reviewPage } from "./support/review.ts";

const THEMES = ["light", "dark"] as const;
const WIDTHS = [390, 768, 1280] as const;
const LOCALES = ["en", "ne"] as const;

let sitemapPaths: Promise<string[]> | undefined;
/** English paths listed in /sitemap.xml (read once per worker). */
const fromSitemap = () => {
	sitemapPaths ??= fetch(new URL("/sitemap.xml", E2E.baseURL))
		.then((response) => response.text())
		.then((xml) =>
			[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
				.map((match) => new URL(match[1] ?? "", E2E.baseURL).pathname)
				.filter((path) => !path.startsWith("/ne/") && path !== "/ne"),
		);
	return sitemapPaths;
};

async function resolvePath(page: ReviewedPage, harness: Harness) {
	if (page.path) return page.path;
	if (!page.params) return page.route;
	if (page.params.from === "test-crud-id") {
		return page.route.replace("$id", await harness.testCrudId(SEEDED_ITEM_SLUG));
	}
	if (page.params.from === "seeded-slug") return page.route.replace("$slug", SEEDED_PUBLISHED_SLUG);
	// portfolio:start
	if (page.params.from === "portfolio-project-id") {
		return page.route.replace("$id", await harness.portfolioId("project", "ledgerline"));
	}
	if (page.params.from === "portfolio-post-id") {
		return page.route.replace("$id", await harness.portfolioId("post", "server-render-everything"));
	}
	// portfolio:end
	// kharcha:start
	if (page.params.from === "kharcha-expense-id") {
		return page.route.replace("$expenseId", await harness.kharchaExpenseId(E2E.users.kharcha.email));
	}
	// kharcha:end
	// taskline:start
	if (page.params.from === "taskline-project-id") {
		return page.route.replace("$id", await harness.tasklineProjectId("WEB"));
	}
	if (page.params.from === "taskline-sprint-id") {
		return page.route
			.replace("$ws", "team")
			.replace("$key", "APP")
			.replace("$sprintId", await harness.tasklineSprintId("APP", page.params.state));
	}
	// taskline:end
	// apps:start
	if (page.params.from === "note-id") return page.route.replace("$noteId", (await harness.reviewNote("member")).id);
	if (page.params.from === "shared-note-token") {
		return page.route.replace("$token", (await harness.reviewNote("member")).token);
	}
	if (page.params.from === "link-id") return page.route.replace("$linkId", (await harness.reviewLink("member")).id);
	if (page.params.from === "expenses-data") {
		await harness.reviewExpenses("member");
		return page.route;
	}
	if (page.params.from === "habit-data") {
		await harness.reviewHabit("member");
		return page.route;
	}
	if (page.params.from === "habit-id") return page.route.replace("$habitId", (await harness.reviewHabit("member")).id);
	if (page.params.from === "form-data") {
		await harness.reviewForm("member");
		return page.route;
	}
	if (page.params.from === "form-id") return page.route.replace("$formId", (await harness.reviewForm("member")).id);
	if (page.params.from === "form-slug") return page.route.replace("$slug", (await harness.reviewForm("member")).slug);
	// apps:end
	// parda:start (a block: Biome moves a line's marker off an opening brace, decision 0244)
	if (page.params.from === "parda") return pardaFixturePath(page.params.page);
	if (page.params.from === "parda-source-id") return page.route.replace("$id", await harness.pardaSourceId("Server 1"));
	if (page.params.from === "parda-party") return page.route.replace("$code", await harness.pardaParty());
	if (page.params.from === "parda-curated") {
		const curated = await harness.pardaCurated();
		return page.route.replace(page.params.id === "slug" ? "$slug" : "$id", curated[page.params.id]);
	}
	// parda:end
	const pattern = routePattern(page.route);
	const path = (await fromSitemap()).find((candidate) => pattern.test(candidate));
	if (!path) throw new Error(`no sitemap URL matches ${page.route}`);
	return path;
}

for (const page of REVIEWED_PAGES) {
	const name = [page.route, page.as && `as ${page.as}`, page.label].filter(Boolean).join(" ");
	test.describe(name, () => {
		if (page.as) test.use(signedIn(page.as));
		for (const theme of THEMES) {
			for (const width of WIDTHS) {
				test.describe(`${theme} ${width}`, () => {
					test.use({ colorScheme: theme, viewport: { width, height: 900 } });
					for (const locale of LOCALES) {
						test(locale, async ({ page: browserPage, harness, guard }) => {
							if (page.status) guard.allow(RESOURCE_STATUS(page.status));
							const path = await resolvePath(page, harness);
							// parda:start
							// Parda resolves "system" to dark (0232), so its light pass needs the explicit choice.
							if (theme === "light" && page.route.startsWith("/app/parda")) {
								await browserPage.context().addCookies([{ name: "theme", value: "light", url: E2E.baseURL }]);
							}
							// parda:end
							await reviewPage(browserPage, localizedPath(path, locale), {
								...(page.status ? { status: page.status } : {}),
								...(page.live ? { live: true } : {}),
							});
						});
					}
				});
			}
		}
	});
}
