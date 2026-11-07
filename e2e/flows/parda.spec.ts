/**
 * Parda's foundation (Task 59, decision 0230): the placeholder player's four routes are
 * real documents framed only by this app, and the player lab loads one and logs what it
 * reports, in a production build under the real CSP (the guard fails on any violation).
 */

import type { Browser, Page } from "@playwright/test";
import { E2E } from "../harness/config.ts";
import { fixtureTitlePath, pardaFixturePath, popularFixture } from "../harness/tmdb.ts";
import { expect, type Harness, RESOURCE_STATUS, signedIn, test } from "../support/fixtures.ts";

test.describe("Parda's placeholder player", () => {
	for (const server of [1, 2, 3, 4]) {
		test(`server ${server} serves its movie and series routes`, async ({ request }) => {
			for (const path of [`/parda/api/${server}/movie/550`, `/parda/api/${server}/tv/1396/1/1`]) {
				const response = await request.get(path);
				expect(response.status()).toBe(200);
				expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
				expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
				expect(await response.text()).toContain("<h1>");
			}
		});
	}

	test("anything else under the route is a 404", async ({ request }) => {
		expect((await request.get("/parda/api/5/movie/550")).status()).toBe(404);
		expect((await request.get("/parda/api/1/movie/abc")).status()).toBe(404);
	});

	test("the harness stands in for TMDB", async ({ request }) => {
		const response = await request.get(`${E2E.harnessURL}/tmdb/3/movie/popular?language=en-US`);
		expect(response.ok()).toBe(true);
		expect((await response.json()).results.length).toBeGreaterThan(0);
	});
});

test.describe("Parda's player lab as the viewer", () => {
	test.use(signedIn("viewer"));

	test("is a 403", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(403));
		const response = await page.goto("/admin/parda/player-lab", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(403);
	});
});

// Decision 0249: the account page inside Parda, and only for an account.
test.describe("Parda's account page", () => {
	test.use(signedIn("viewer"));

	test("opens from the account menu in Parda's frame and saves the name", async ({ page }) => {
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		await page.getByTestId("user-menu").click();
		await page.getByTestId("nav-account").click();
		await expect(page).toHaveURL(/\/app\/parda\/account$/);
		await expect(page.getByTestId("parda-header")).toBeVisible();
		await expect(page.getByTestId("account-page").getByRole("heading", { level: 1 })).toBeVisible();
		const form = page.getByTestId("profile-form");
		await form.getByRole("button").click();
		await expect(form.getByText("Saved.")).toBeVisible();
	});

	test("sends a visitor to Parda's sign-in", async ({ browser }) => {
		const visitor = await browser.newContext({ baseURL: E2E.baseURL, storageState: { cookies: [], origins: [] } });
		const page = await visitor.newPage();
		await page.goto("/app/parda/account");
		await expect(page).toHaveURL(/\/app\/parda\/sign-in\?redirect=/);
		await visitor.close();
	});
});

test.describe("Parda's player lab as the admin", () => {
	test.use(signedIn("admin"));

	test("loads a source, logs its messages, sends commands and rehearses a failure", async ({ page }) => {
		await page.goto("/admin/parda/player-lab", { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Load player" }).click();

		const log = page.getByTestId("pd-lab-log");
		await expect(log).toContainText('"kind":"ready"');
		await expect(log).toContainText('"kind":"play"');
		await expect(page.getByTestId("pd-lab-position")).toContainText("Position:");

		await page.getByRole("button", { name: "Pause" }).click();
		await expect(log).toContainText('"kind":"pause"');
		await page.getByRole("button", { name: "Forward 60 s" }).click();
		await expect(log).toContainText('"kind":"seeked"');

		await page.getByLabel("Rehearse").selectOption("fail");
		await page.getByRole("button", { name: "Load player" }).click();
		await expect(log).toContainText('"kind":"failed"');
	});

	test("reads the Viduki contract: MEDIA_DATA progress and all-servers-failed, and offers no commands (0248)", async ({
		page,
	}) => {
		await page.goto("/admin/parda/player-lab", { waitUntil: "networkidle" });
		const source = page.getByLabel("Source");
		await source.selectOption({ label: await source.locator("option", { hasText: "Viduki" }).innerText() });
		await page.getByRole("button", { name: "Load player" }).click();
		await expect(page.getByTestId("pd-lab-position")).toContainText("Position:", { timeout: 10_000 });
		await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);

		await page.getByLabel("Rehearse").selectOption("fail");
		await page.getByRole("button", { name: "Load player" }).click();
		await expect(page.getByTestId("pd-lab-log")).toContainText('"reason":"initial:404"');
	});
});

// Task 61: the frame, the brand and the pages for visitors.
test.describe("Parda's frame for a visitor", () => {
	test("is dark by default, branded, and keeps the visitor inside Parda", async ({ page }) => {
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		const html = page.locator("html");
		await expect(html).toHaveAttribute("data-section", "parda");
		await expect(html).toHaveClass(/\bdark\b/);
		await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/app/parda/manifest.webmanifest");
		await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#08080a");
		// Parda names no catalogue provider (0249): the footer carries its own wordmark.
		await expect(page.getByTestId("parda-footer")).toContainText("Parda");
		await expect(page.getByTestId("parda-footer")).not.toContainText("TMDB");
		await page.getByTestId("parda-nav-about").click();
		await expect(page).toHaveURL(/\/app\/parda\/about$/);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		await page.getByTestId("parda-sign-in-link").click();
		await expect(page).toHaveURL(/\/app\/parda\/sign-in\?redirect=/);
		await expect(page.getByTestId("parda-frame")).toBeVisible();
	});

	test("an explicit light choice wins over the dark default", async ({ page }) => {
		await page.context().addCookies([{ name: "theme", value: "light", url: E2E.baseURL }]);
		await page.goto("/app/parda/about", { waitUntil: "networkidle" });
		await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
	});

	test("an unknown address is Parda's 404, in its frame", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/ne/app/parda/no-such-page", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(404);
		await expect(page.getByTestId("parda-frame")).toBeVisible();
		await expect(page.getByTestId("not-found-page")).toBeVisible();
	});

	test("serves its manifest in each language", async ({ request }) => {
		for (const [path, lang, start] of [
			["/app/parda/manifest.webmanifest", "en", "/app/parda"],
			["/ne/app/parda/manifest.webmanifest", "ne", "/ne/app/parda"],
		] as const) {
			const response = await request.get(path);
			expect(response.ok()).toBe(true);
			const manifest = await response.json();
			expect(manifest).toMatchObject({ name: "Parda", lang, start_url: start, theme_color: "#08080a" });
		}
	});
});

test.describe("Parda's frame on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("puts the sections in the tab bar", async ({ page }) => {
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		const tabs = page.getByTestId("parda-tab-bar");
		await expect(tabs).toBeVisible();
		// About is in the footer on every page; Discover takes its place in the tab bar (Task 66).
		await expect(tabs.getByRole("link", { name: /About|बारेमा/ })).toHaveCount(0);
		await tabs.getByRole("link", { name: /Discover|अन्वेषण/ }).click();
		await expect(page).toHaveURL(/\/app\/parda\/discover$/);
		await expect(page.getByTestId("parda-header").getByTestId("parda-nav-discover")).toBeHidden();
		// Search stays in the top mask, as an icon.
		await page.getByTestId("parda-search-button").click();
		await expect(page.getByTestId("parda-search-overlay")).toBeVisible();
	});
});

// Task 66: search (the overlay and the page) and Discover, on the recorded catalogue.
test.describe("Parda's search", () => {
	test.beforeEach(async ({ harness }) => {
		await harness.resetRateLimits();
	});

	test("the overlay opens with Ctrl K, lists hits, and Enter opens every result", async ({ page }) => {
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		await page.keyboard.press("Control+k");
		const overlay = page.getByTestId("parda-search-overlay");
		await expect(overlay).toBeVisible();
		// Empty, it suggests what's trending.
		await expect(overlay.getByTestId("parda-search-trending")).toBeVisible();
		await page.getByTestId("parda-search-input").fill("star");
		await expect(overlay.getByTestId("parda-search-titles").getByRole("option").first()).toBeVisible();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/app\/parda\/search\?q=star$/);
		await expect(page.getByTestId("parda-search-results").getByRole("link").first()).toBeVisible();
		await expect(page.getByTestId("parda-search-tab-all")).toHaveAttribute("aria-current", "page");
		await page.getByTestId("parda-search-tab-people").click();
		await expect(page).toHaveURL(/tab=people/);
		await expect(page.getByTestId("parda-search-results").getByTestId("person-card").first()).toBeVisible();
		// The search is remembered in this browser, for the overlay.
		await page.keyboard.press("/");
		await expect(page.getByTestId("parda-recent-searches")).toContainText("star");
	});

	test("a hit opens its page, which the overlay then lists as recently viewed", async ({ page }) => {
		await page.goto("/app/parda/about", { waitUntil: "networkidle" });
		await page.getByTestId("parda-search-button").click();
		await page.getByTestId("parda-search-input").fill("star");
		const first = page.getByTestId("parda-search-titles").getByRole("option").first();
		const name = (await first.locator("span.font-medium").textContent()) ?? "";
		await first.click();
		await expect(page).toHaveURL(/\/app\/parda\/(movie|series)\/\d+/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
		await page.keyboard.press("Control+k");
		await expect(page.getByTestId("parda-recently-viewed")).toContainText(name);
	});

	test("the page searches on Enter, and suggests what's trending when nothing is found", async ({ page }) => {
		await page.goto("/app/parda/search", { waitUntil: "networkidle" });
		await expect(page.getByTestId("parda-search-suggestions")).toBeVisible();
		await page.getByTestId("parda-search-field").fill("qzxv no such title");
		await page.getByTestId("parda-search-field").press("Enter");
		await expect(page).toHaveURL(/q=qzxv\+no\+such\+title/);
		await expect(page.getByTestId("parda-search-empty")).toBeVisible();
		await expect(page.getByTestId("parda-search-suggestions").getByRole("link").first()).toBeVisible();
		await page
			.getByRole("link", { name: /Discover/ })
			.first()
			.click();
		await expect(page).toHaveURL(/\/app\/parda\/discover$/);
	});
});

test.describe("Parda's search without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("the page's form and its tabs work as plain links", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await page.goto("/app/parda/search", { waitUntil: "load" });
		await page.getByTestId("parda-search-field").fill("star");
		await page.getByTestId("parda-search-field").press("Enter");
		await expect(page).toHaveURL(/q=star/);
		await expect(page.getByTestId("parda-search-results")).toBeVisible();
		await page.getByTestId("parda-search-tab-series").click();
		await expect(page).toHaveURL(/tab=series/);
		await expect(page.getByTestId("parda-search-results")).toBeVisible();
	});
});

test.describe("Parda's Discover", () => {
	test("filters through the address, and a chip removes a filter", async ({ page }) => {
		await page.goto("/app/parda/discover", { waitUntil: "networkidle" });
		await expect(page.getByTestId("parda-discover-results").getByRole("link").first()).toBeVisible();
		await page.getByLabel("Type").selectOption("series");
		await expect(page).toHaveURL(/type=series/);
		await page.getByLabel("Sort by").selectOption("rating");
		await expect(page).toHaveURL(/sort=rating/);
		await expect(page.getByTestId("parda-discover-results").getByRole("link").first()).toBeVisible();
		await page.goto("/app/parda/discover?genres=28", { waitUntil: "networkidle" });
		const chips = page.getByTestId("active-filters");
		await expect(chips).toContainText("Action");
		await chips.getByRole("link", { name: /Action/ }).click();
		await expect(page).toHaveURL(/\/app\/parda\/discover$/);
		await expect(page.getByTestId("active-filters")).toHaveCount(0);
	});

	test("a title's keyword and a hub's genre rail lead there", async ({ page }) => {
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		const keyword = page.getByTestId("title-keywords").getByRole("link").first();
		const name = (await keyword.textContent()) ?? "";
		await keyword.click();
		await expect(page).toHaveURL(/\/app\/parda\/discover\?keyword=\d+$/);
		await expect(page.getByTestId("active-filters")).toContainText(name);
		await expect(page.getByTestId("parda-discover-results").getByRole("link").first()).toBeVisible();

		await page.goto("/app/parda/movies", { waitUntil: "networkidle" });
		await page.getByTestId("rail-see-all").first().click();
		await expect(page).toHaveURL(/\/app\/parda\/discover\?genres=\d+$/);
		await expect(page.getByTestId("active-filters")).toBeVisible();
	});
});

// Task 62: the home, the hubs and the title page stub, on the recorded catalogue.
test.describe("Parda's home and hubs", () => {
	test("streams every rail, and the billboard plays its title", async ({ page }) => {
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		await expect(page.getByTestId("billboard")).toBeVisible();
		await expect(page.getByTestId("top10-rail").getByRole("link")).toHaveCount(10);
		// Every later rail streamed in: no skeleton is left, and nothing failed.
		await expect(page.getByTestId("rail-skeleton")).toHaveCount(0);
		await expect(page.getByTestId("rail-unavailable")).toHaveCount(0);
		await expect(page.getByTestId("title-rail")).toHaveCount(10);
		// The first picture, in the shape each width shows (the frame preloads other images of its own).
		await expect(page.locator('link[rel="preload"][as="image"][media]')).toHaveCount(2);
		const title = await page.getByTestId("billboard").getByRole("heading", { level: 2 }).textContent();
		// Play when a source can start it (0244): every seeded server can, so no slide falls back to Details.
		await expect(page.getByTestId("billboard-details")).toHaveCount(0);
		await page.getByTestId("billboard-play").click();
		await expect(page).toHaveURL(/\/app\/parda\/watch\/(movie|series)\/\d+-[a-z0-9-]+$/);
		await expect(page.getByRole("heading", { name: title ?? "", exact: true })).toBeVisible();
	});

	test("reaches each hub from the top mask, in Nepali too", async ({ page }) => {
		await page.goto("/ne/app/parda", { waitUntil: "networkidle" });
		for (const hub of ["movies", "series", "anime"] as const) {
			await page.getByTestId(`parda-nav-${hub}`).click();
			await expect(page).toHaveURL(new RegExp(`/ne/app/parda/${hub}$`));
			await expect(page.getByTestId(`parda-page-${hub}`)).toBeVisible();
			await expect(page.getByTestId(`parda-nav-${hub}`)).toHaveAttribute("aria-current", "page");
			await expect(page.getByTestId("title-rail").first()).toBeVisible();
		}
	});

	test("answers Parda's 404 for an unknown hub or title", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		for (const path of ["/app/parda/cartoons", "/app/parda/movie/abc", "/app/parda/film/550"]) {
			const response = await page.goto(path, { waitUntil: "networkidle" });
			expect(response?.status(), path).toBe(404);
			await expect(page.getByTestId("parda-frame")).toBeVisible();
		}
	});
});

// Task 63: a title's pages, a person and a collection, on the recorded catalogue.
test.describe("Parda's title pages", () => {
	test.beforeEach(async ({ page }) => {
		// Trailers are YouTube's: never reached from CI.
		await page.route("https://www.youtube-nocookie.com/**", (route) =>
			route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Trailer</title>" }),
		);
	});

	test("answers a missing or wrong slug with a 301 to the canonical address", async ({ request }) => {
		const canonical = pardaFixturePath("movie");
		const id = /\/(\d+)-/.exec(canonical)?.[1] ?? "";
		for (const path of [`/app/parda/movie/${id}`, `/app/parda/movie/${id}-wrong-name`, `/ne/app/parda/movie/${id}`]) {
			const response = await request.get(path, { maxRedirects: 0 });
			expect(response.status(), path).toBe(301);
			expect(response.headers().location, path).toMatch(new RegExp(`${canonical.replace(/\//g, "/")}$`));
		}
		expect(
			(await request.get(`${canonical}/credits`.replace(/-[a-z0-9-]+\//, "/"), { maxRedirects: 0 })).status(),
		).toBe(301);
	});

	test("a movie opens its trailer, browses its gallery, and Play leads to the watch page", async ({ page }) => {
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		await expect(page.getByTestId("title-heading")).toBeVisible();
		await expect(page.getByTestId("title-cast").getByTestId("person-card").first()).toBeVisible();
		await expect(page.getByTestId("title-crew")).toContainText(/Director/);
		await expect(page.getByTestId("title-play")).toHaveAttribute("href", /\/app\/parda\/watch\/movie\//);

		await page.getByTestId("title-trailer").click();
		await expect(page.getByTestId("video-frame")).toHaveAttribute(
			"src",
			/^https:\/\/www\.youtube-nocookie\.com\/embed\//,
		);
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("video-dialog")).toBeHidden();

		await page.getByTestId("gallery-item").first().click();
		const position = page.getByTestId("gallery-position");
		await expect(position).toHaveText(/^Picture 1 of \d+$/);
		await page.keyboard.press("ArrowRight");
		await expect(position).toHaveText(/^Picture 2 of \d+$/);
		await page.keyboard.press("ArrowLeft");
		await expect(position).toHaveText(/^Picture 1 of \d+$/);
		await page.keyboard.press("Escape");

		await page.getByTestId("title-play").click();
		await expect(page).toHaveURL(/\/app\/parda\/watch\/movie\//);
		await expect(page.locator('iframe[src^="/parda/api/1/movie/"]')).toBeVisible();
	});

	test("the cast leads to the full credits and to a person", async ({ page }) => {
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		await page.getByTestId("title-credits-link").click();
		await expect(page).toHaveURL(/\/credits$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cast and crew");
		await expect(page.getByTestId("credits-department").first()).toBeVisible();
		await page.getByTestId("credits-back").click();
		await page.getByTestId("title-cast").getByTestId("person-card").first().click();
		await expect(page).toHaveURL(/\/app\/parda\/person\/\d+$/);
		await expect(page.getByTestId("person-filmography")).toBeVisible();
	});

	test("a series switches seasons and opens an episode's sheet from the URL", async ({ page }) => {
		await page.goto(pardaFixturePath("series"), { waitUntil: "networkidle" });
		const episodes = page.getByTestId("title-episodes");
		await expect(episodes.getByTestId("episode-card").first()).toBeVisible();
		await episodes.getByTestId("episode-card").first().click();
		await expect(page).toHaveURL(/[?&]episode=\d+/);
		await expect(page.getByTestId("episode-sheet")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("episode-sheet")).toBeHidden();
		await expect(page).not.toHaveURL(/episode=/);
		const seasons = episodes.getByTestId("season-link");
		if ((await seasons.count()) > 1) {
			await seasons.nth(1).click();
			await expect(page).toHaveURL(/[?&]season=\d+/);
			await expect(seasons.nth(1)).toHaveAttribute("aria-current", "page");
			await expect(seasons.first()).not.toHaveAttribute("aria-current", "page");
		}
	});

	test("a franchise banner leads to its collection, in release order", async ({ page }) => {
		await page.goto(pardaFixturePath("collection"), { waitUntil: "networkidle" });
		await expect(page.getByTestId("collection-parts").getByTestId("poster-card").nth(1)).toBeVisible();
		await page.goto("/app/parda/movie/155", { waitUntil: "networkidle" });
		await expect(page).toHaveURL(/\/app\/parda\/movie\/155-[a-z-]+$/);
		await page.getByTestId("title-franchise").getByRole("link").click();
		await expect(page).toHaveURL(/\/app\/parda\/collection\/\d+$/);
		await expect(page.getByTestId("parda-collection")).toBeVisible();
	});

	test("Surprise me redirects to a title from the page's lists", async ({ request, page }) => {
		for (const from of ["home", "movies", "series", "anime"]) {
			const response = await request.get(`/app/parda/surprise?from=${from}`, { maxRedirects: 0 });
			expect(response.status(), from).toBeGreaterThanOrEqual(300);
			expect(response.status(), from).toBeLessThan(400);
			expect(response.headers().location, from).toMatch(/\/app\/parda\/(movie|series)\/\d+(-[a-z0-9-]+)?$/);
		}
		await page.goto("/app/parda", { waitUntil: "networkidle" });
		await expect(page.getByTestId("surprise-me").first()).toHaveAttribute("href", /\/app\/parda\/surprise\?from=home$/);
	});

	test("an unknown person or collection is Parda's 404", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		for (const path of ["/app/parda/person/1", "/app/parda/collection/1", "/app/parda/person/abc"]) {
			const response = await page.goto(path, { waitUntil: "networkidle" });
			expect(response?.status(), path).toBe(404);
			await expect(page.getByTestId("parda-frame")).toBeVisible();
		}
		expect(fixtureTitlePath()).toMatch(/^\/app\/parda\/(movie|series)\/\d+/);
	});
});

// Task 64: the watch page against the placeholder player (decision 0236). `cue` rewrites a
// server's requests on the way out, the way an admin's row would: `start=` puts the clock
// where a test needs it, `cue=fail|silent|stall` rehearses trouble.
const cue = (page: Page, server: number, params: Record<string, string>) =>
	page.route(`**/parda/api/${server}/**`, async (route) => {
		const url = new URL(route.request().url());
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		await route.continue({ url: url.toString() });
	});

const frame = (page: Page) => page.getByTestId("watch-box").locator("iframe");
/** Playing: the first position moved (so progress was saved once), and Parda's controls took over. */
const playing = async (page: Page) => {
	await expect(page.getByTestId("watch-box")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
	await expect(page.getByTestId("click-shield")).toBeVisible();
};

test.describe("Parda's watch page", () => {
	test("falls back to another CDN group when a server fails", async ({ page }) => {
		await cue(page, 1, { cue: "fail" });
		await page.goto(pardaFixturePath("watch-movie"));
		await expect(page.getByText("Trying Server 3…")).toBeVisible();
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/3\/movie\//);
		await playing(page);
	});

	test("only offers another server when one is slow to start, and stays put (0247)", async ({ page }) => {
		test.slow();
		await cue(page, 1, { cue: "silent" });
		await page.goto(pardaFixturePath("watch-movie"));
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\/movie\//);
		await expect(page.getByText("Taking a while to start. Try another server?")).toBeVisible({ timeout: 25_000 });
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\/movie\//);
	});

	test("the bar has full screen and picture-in-picture (0248)", async ({ page }) => {
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		await expect(page.getByTestId("control-fullscreen")).toBeEnabled();
		const pip = page.getByTestId("control-pip");
		await expect(pip).toHaveAccessibleName("Picture-in-picture");
		if (await page.evaluate(() => "documentPictureInPicture" in window)) await expect(pip).toBeEnabled();
		else await expect(pip).toBeDisabled();
	});

	test("a picked server that fails stays picked and only offers another (0247)", async ({ page }) => {
		await cue(page, 2, { cue: "fail" });
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		await page.getByTestId("server-menu").click();
		await page.getByTestId("server-option").filter({ hasText: "Server 2" }).click();
		await expect(page.getByText("Server 2 stopped working. Try another server?")).toBeVisible();
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/2\/movie\//);
		expect(await page.evaluate(() => localStorage.getItem("pd_server"))).not.toBeNull();
	});

	test("remembers a picked server until Auto clears it, and a switch starts 30 s earlier", async ({ page }) => {
		await cue(page, 1, { start: "600" });
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		await page.getByTestId("server-menu").click();
		await page.getByTestId("server-option").filter({ hasText: "Server 2" }).click();
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/2\/movie\/\d+\?start=(5[7-9]\d|6\d\d)&/);
		await page.reload();
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/2\//);
		await page.getByTestId("server-menu").click();
		await page.getByTestId("server-auto").click();
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\//);
		expect(await page.evaluate(() => localStorage.getItem("pd_server"))).toBeNull();
	});

	test("offers a smoother server when playback stutters, and stays put", async ({ page }) => {
		await cue(page, 1, { cue: "stall" });
		await page.goto(pardaFixturePath("watch-movie"));
		await expect(page.getByText("Playback is stuttering. Try a smoother server?")).toBeVisible({ timeout: 20_000 });
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\//);
	});

	test("the click shield takes the clicks, and Parda's controls send commands", async ({ page }) => {
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		const shield = page.getByTestId("click-shield");
		const box = await shield.boundingBox();
		if (!box) throw new Error("no shield");
		const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), {
			x: box.x + box.width / 2,
			y: box.y + box.height / 2,
		});
		expect(onTop).toBe("click-shield");
		await shield.click();
		await expect(page.getByTestId("control-toggle")).toHaveAccessibleName("Play");
		const paused = await page.getByTestId("control-time").textContent();
		await page.waitForTimeout(1_000);
		await expect(page.getByTestId("control-time")).toHaveText(paused ?? "");
		await page.getByTestId("control-toggle").click();
		await expect(page.getByTestId("control-toggle")).toHaveAccessibleName("Pause");
		await page.getByTestId("control-player-menu").click();
		await expect(shield).toBeHidden();
	});

	test("the uBlock Origin Lite button opens Chrome's store in a new tab, and Don't show again sticks", async ({
		page,
	}) => {
		await page.goto(pardaFixturePath("watch-movie"));
		const install = page.getByTestId("blocker-install");
		await expect(install).toHaveAttribute(
			"href",
			/^https:\/\/chromewebstore\.google\.com\/detail\/ublock-origin-lite\//,
		);
		await expect(install).toHaveAttribute("target", "_blank");
		await expect(install).toHaveAttribute("rel", "noopener");
		await page.getByTestId("blocker-dismiss").click();
		await expect(page.getByTestId("blocker-hint")).toBeHidden();
		await page.reload();
		await expect(page.getByTestId("watch-heading")).toBeVisible();
		await expect(page.getByTestId("blocker-hint")).toBeHidden();
		await page.goto("/app/parda/about#ad-blocker");
		await expect(page.locator("#ad-blocker a[href^='https://']")).toHaveCount(4);
	});

	test("Up next counts down near the end and plays the next episode", async ({ page }) => {
		await cue(page, 1, { start: "1485" });
		await page.goto(pardaFixturePath("watch-series"));
		await expect(page.getByTestId("up-next")).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId("up-next-countdown")).toBeVisible();
		await expect(page).toHaveURL(/[?&]e=2(&|$)/, { timeout: 20_000 });
		await expect(page.getByTestId("watch-heading")).toBeVisible();
	});

	test("without a session, progress stays in the browser: the title's action and the rail show it", async ({
		page,
	}) => {
		await cue(page, 1, { start: "1800" });
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		await expect.poll(() => page.evaluate(() => localStorage.getItem("pd_progress") ?? "")).toContain('"watched"');
		await page.goto(pardaFixturePath("movie"));
		await expect(page.getByTestId("title-play")).toContainText(/Resume · \d+ min left/);
		await page.goto("/app/parda");
		await expect(page.getByTestId("continue-rail").getByTestId("backdrop-card")).toHaveCount(1);
		await page.getByTestId("continue-remove").click();
		await expect(page.getByTestId("continue-rail")).toBeHidden();
	});
});

test.describe("Parda's progress with a session", () => {
	test.use(signedIn("member"));

	test("progress survives a reload: the action, the bar and the rail show it", async ({ page }) => {
		await cue(page, 1, { start: "2400" });
		await page.goto(pardaFixturePath("watch-movie"));
		await playing(page);
		// The first moving position is saved at once; pausing saves again.
		await page.getByTestId("click-shield").click();
		await expect(page.getByTestId("control-toggle")).toHaveAccessibleName("Play");
		await expect
			.poll(async () => {
				await page.goto(pardaFixturePath("movie"));
				return page.getByTestId("title-play").textContent();
			})
			.toMatch(/Resume · \d+ min left/);
		await expect(page.getByTestId("title-hero").getByRole("progressbar")).toBeVisible();
		await page.goto("/app/parda");
		await expect(page.getByTestId("continue-rail").getByTestId("backdrop-card").first()).toBeVisible();
		// The watch page resumes from our record.
		await page.unroute("**/parda/api/1/**");
		await page.goto(pardaFixturePath("watch-movie"));
		await expect(frame(page)).toHaveAttribute("src", /start=2[4-9]\d\d/);
	});
});

test.describe("Parda's marks for a visitor", () => {
	test("marking a season watched starts a guest, moves the action and shows the banner", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await page.goto(pardaFixturePath("series"), { waitUntil: "networkidle" });
		const play = page.getByTestId("title-play");
		await expect(play).toHaveText(/Play/);
		await page.getByTestId("mark-season").click();
		await expect(play).toHaveText(/Next: |Rewatch/);
		await expect(page.getByTestId("parda-guest-banner")).toContainText(/deleted on/);
		await expect(page.getByTestId("season-watched")).toBeVisible();
	});
});

// Task 65: the admin's controls (decision 0237). Each flow uses its own source or title, so
// the flows above, which play Servers 1 to 4 and the first popular titles, run beside it.
const rowAction = async (page: Page, label: string, action: string) => {
	await page.getByRole("button", { name: `Actions for ${label}` }).click();
	await page.getByRole("menuitem", { name: action, exact: true }).click();
};
const frameSrc = async (page: Page, path: string) =>
	(await page.request.get(path)).headers()["content-security-policy"]?.match(/frame-src ([^;]*)/)?.[1] ?? "";

test.describe("Parda's admin", () => {
	test.use(signedIn("admin"));

	test("a source added frames, disabling it takes it out of the switcher and the CSP, deleting it removes it", async ({
		page,
		guard,
	}) => {
		// The refused save answers 400.
		guard.allow(RESOURCE_STATUS(400));
		const name = `E2E Server ${Date.now()}`;
		const origin = "https://e2e-player.invalid";
		const watch = pardaFixturePath("watch-movie");

		await page.goto("/admin/parda/sources/new", { waitUntil: "networkidle" });
		await page.getByLabel("Name (English)").fill(name);
		await page.getByLabel("Movie address").fill(`${origin}/movie/{id}`);
		await page.getByLabel("Episode address").fill(`${origin}/tv/{id}/{season}/{episode}`);
		await page.getByRole("switch", { name: "Enabled" }).click();
		await page.getByRole("button", { name: "Create" }).click();
		// The server checks the templates against the origins, and answers on the field.
		await expect(page.getByText("Add this address's origin to the origins below.").first()).toBeVisible();
		await page.getByLabel("Origins").fill(origin);
		await page.getByLabel("Origins").press("Enter");
		await page.getByRole("button", { name: "Create" }).click();
		await expect(page).toHaveURL(/\/admin\/parda\/sources$/);
		await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

		expect(await frameSrc(page, watch)).toContain(origin);
		await page.goto(watch, { waitUntil: "networkidle" });
		await page.getByTestId("server-menu").click();
		await expect(page.getByTestId("server-option").filter({ hasText: name })).toBeVisible();
		await page.keyboard.press("Escape");

		await page.goto("/admin/parda/sources", { waitUntil: "networkidle" });
		await rowAction(page, name, "Disable");
		await expect(page.getByText(`“${name}” is disabled.`)).toBeVisible();
		expect(await frameSrc(page, watch)).not.toContain(origin);
		await page.goto(watch, { waitUntil: "networkidle" });
		await page.getByTestId("server-menu").click();
		await expect(page.getByTestId("server-option").filter({ hasText: "Server 2" })).toBeVisible();
		await expect(page.getByTestId("server-option").filter({ hasText: name })).toHaveCount(0);
		await page.keyboard.press("Escape");

		await page.goto("/admin/parda/sources", { waitUntil: "networkidle" });
		await rowAction(page, name, "Delete");
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
	});

	test("a blocked title is Parda's 404 and leaves the rails; unblocking brings it back", async ({ page, guard }) => {
		const title = popularFixture("movie", 1);
		const linked = (html: string) => html.includes(`/app/parda/movie/${title.id}`);
		expect(linked(await (await page.request.get("/app/parda")).text())).toBe(true);

		await page.goto("/admin/parda/titles/new", { waitUntil: "networkidle" });
		await page.getByLabel("Title id").fill(String(title.id));
		await page.getByLabel("Reason").fill("An e2e takedown");
		await page.getByRole("button", { name: "Block", exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/parda\/titles$/);
		await expect(page.getByText("An e2e takedown")).toBeVisible();

		// Blocking it again is refused on the id.
		await page.goto("/admin/parda/titles/new", { waitUntil: "networkidle" });
		await page.getByLabel("Title id").fill(String(title.id));
		await page.getByLabel("Reason").fill("Twice");
		await page.getByRole("button", { name: "Block", exact: true }).click();
		await expect(page.getByText("This title is already blocked.").first()).toBeVisible();

		// The second block answers 409; the blocked page 404.
		guard.allow(RESOURCE_STATUS(409));
		guard.allow(RESOURCE_STATUS(404));
		const blocked = await page.goto(title.path);
		expect(blocked?.status()).toBe(404);
		await expect(page.getByTestId("parda-frame")).toBeVisible();
		expect(linked(await (await page.request.get("/app/parda")).text())).toBe(false);

		await page.goto("/admin/parda/titles", { waitUntil: "networkidle" });
		const row = page.getByRole("row").filter({ hasText: "An e2e takedown" });
		await row.getByRole("button", { name: /^Actions for / }).click();
		await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(page.getByText("An e2e takedown")).toHaveCount(0);
		expect(linked(await (await page.request.get("/app/parda")).text())).toBe(true);
	});

	test("reports are resolved in bulk and leave the open queue", async ({ page, harness }) => {
		await harness.resetRateLimits();
		const note = `E2E report ${Date.now()}`;
		await page.goto(pardaFixturePath("watch-movie"), { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Report a problem" }).click();
		await page.getByLabel("Details (optional)").fill(note);
		await page.getByRole("button", { name: "Send report" }).click();
		await expect(page.getByText("Thanks: your report was sent.")).toBeVisible();

		await page.goto(`/admin/parda/reports?q=${encodeURIComponent(note)}`, { waitUntil: "networkidle" });
		const row = page.getByRole("row").filter({ hasText: note });
		await expect(row).toBeVisible();
		await row.getByRole("checkbox").check();
		await page.getByTestId("parda-reports-resolve").click();
		await expect(page.getByText("Reports updated: 1.")).toBeVisible();
		await page.reload();
		await expect(page.getByRole("row").filter({ hasText: note })).toHaveCount(0);
		await page.goto(`/admin/parda/reports?q=${encodeURIComponent(note)}&status=resolved`, { waitUntil: "networkidle" });
		await expect(page.getByRole("row").filter({ hasText: note })).toContainText("Resolved");
	});

	test("the banner shows under Parda's header for visitors, and clearing it hides it", async ({ page, browser }) => {
		const text = `E2E notice ${Date.now()}`;
		const setBanner = async (value: string) => {
			await page.goto("/admin/parda/settings", { waitUntil: "networkidle" });
			await page.getByLabel("Banner (English)").fill(value);
			const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.ok());
			await page.getByRole("button", { name: "Save" }).click();
			await saved;
		};
		await setBanner(text);
		const visitor = await browser.newPage({ baseURL: E2E.baseURL });
		await visitor.goto("/app/parda/about", { waitUntil: "networkidle" });
		await expect(visitor.getByTestId("parda-notice-banner")).toHaveText(text);
		await setBanner("");
		await visitor.reload();
		await expect(visitor.getByTestId("parda-notice-banner")).toHaveCount(0);
		await visitor.close();
	});
});

// Task 65a: source ranking (decision 0238). Standings come from the harness, as the daily
// rollup would leave them; each flow puts the seed order back when it ends.
const setOrder = async (page: Page, mode: "auto" | "manual") => {
	await page.goto("/admin/parda/sources", { waitUntil: "networkidle" });
	const order = page.getByTestId("parda-source-order");
	if ((await order.getAttribute("data-state")) !== mode) await page.getByTestId(`parda-source-order-${mode}`).click();
	await expect(order).toHaveAttribute("data-state", mode);
};

test.describe("Parda's curation", () => {
	test.use(signedIn("admin"));

	test("a collection is built with the picker, published at /c/{slug}, placed as a rail, then deleted", async ({
		page,
		harness,
		guard,
	}) => {
		guard.allow(RESOURCE_STATUS(404));
		await harness.resetRateLimits();
		await page.goto("/admin/parda/collections/new");
		await page.waitForLoadState("networkidle");
		await page.getByRole("textbox", { name: /^Name/ }).first().fill("Flow picks");
		await expect(page.getByLabel("Address")).toHaveValue("flow-picks");
		// Publishing with no titles is refused on the titles.
		await page.getByRole("switch", { name: "Published" }).click();
		await page.getByRole("button", { name: "Create collection" }).click();
		await expect(page.getByText("Add a title before publishing.").first()).toBeVisible();

		await page.getByRole("combobox", { name: "Add a title" }).click();
		await page.getByRole("combobox", { name: "Search the catalogue for a title" }).fill("star");
		const option = page.getByRole("option").first();
		await expect(option).toBeVisible();
		await option.click();
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("collection-title")).toHaveCount(1);
		await page.getByRole("button", { name: "Create collection" }).click();
		await expect(page).toHaveURL(/\/admin\/parda\/collections$/);
		await expect(page.getByTestId("parda-collections-table")).toContainText("/c/flow-picks");

		await page.goto("/app/parda/c/flow-picks");
		await expect(page.getByRole("heading", { level: 1, name: "Flow picks" })).toBeVisible();
		await expect(page.getByTestId("collection-parts").getByRole("listitem")).toHaveCount(1);

		// Off on the home until the layout places it.
		await page.goto("/app/parda");
		await expect(page.getByRole("heading", { name: "Flow picks" })).toHaveCount(0);
		await page.goto("/admin/parda/layout");
		await page.waitForLoadState("networkidle");
		const toggle = page.getByRole("switch", { name: "Show Flow picks" });
		await toggle.click();
		// Alt + arrows move a rail from its handle, here all the way to the top.
		const handle = page.getByRole("button", { name: "Move Flow picks" });
		await handle.focus();
		const count = await page.getByTestId("parda-layout-rail").count();
		for (let step = 0; step < count; step += 1) await page.keyboard.press("Alt+ArrowUp");
		await expect(page.getByTestId("parda-layout-rail").first()).toContainText("Flow picks");
		await page.getByTestId("parda-layout-save").click();
		await expect(page.getByTestId("parda-layout-save")).toBeDisabled();

		await page.goto("/app/parda");
		const rail = page.getByRole("region", { name: "Flow picks" });
		await expect(rail).toBeVisible();
		await rail.getByTestId("rail-see-all").or(page.getByTestId("rail-see-all").first()).first().click();
		await expect(page).toHaveURL(/\/app\/parda\/c\/flow-picks$/);

		// Deleting it takes the page and the rail.
		await page.goto("/admin/parda/collections");
		await page.waitForLoadState("networkidle");
		await page
			.getByTestId("parda-collections-table")
			.getByRole("button", { name: /actions/i })
			.first()
			.click();
		await page.getByRole("menuitem", { name: "Delete" }).click();
		await page.getByRole("button", { name: "Delete" }).last().click();
		await expect(page.getByText("/c/flow-picks")).toHaveCount(0);
		const gone = await page.goto("/app/parda/c/flow-picks");
		expect(gone?.status()).toBe(404);
	});

	test("a billboard slot leads its page with the admin's tagline, until it's deleted", async ({ page }) => {
		await page.goto("/admin/parda/billboard/new?page=series");
		await page.waitForLoadState("networkidle");
		// Refused without a title.
		await page.getByRole("button", { name: "Add slot" }).click();
		await expect(page.getByText("Choose a title.").first()).toBeVisible();
		await page.getByRole("combobox", { name: "Title" }).click();
		await page.getByRole("combobox", { name: "Search the catalogue for a title" }).fill("star");
		await page.getByRole("option").first().click();
		await page
			.getByRole("textbox", { name: /^Tagline/ })
			.first()
			.fill("The curator's choice");
		await page.getByRole("button", { name: "Add slot" }).click();
		await expect(page).toHaveURL(/\/admin\/parda\/billboard\?page=series$/);
		await expect(page.getByTestId("parda-billboard-table")).toContainText("Showing");

		await page.goto("/app/parda/series");
		await expect(page.getByText("The curator's choice").first()).toBeVisible();

		await page.goto("/admin/parda/billboard?page=series");
		await page.waitForLoadState("networkidle");
		await page
			.getByTestId("parda-billboard-table")
			.getByRole("button", { name: /actions/i })
			.first()
			.click();
		await page.getByRole("menuitem", { name: "Delete" }).click();
		await page.getByRole("button", { name: "Delete" }).last().click();
		await expect(page.getByRole("cell", { name: "Showing" })).toHaveCount(0);
		await page.goto("/app/parda/series");
		await expect(page.getByText("The curator's choice")).toHaveCount(0);
	});

	test("the overview adds today's plays to the finished days, by range", async ({ page, harness }) => {
		await harness.pardaPlays();
		try {
			await page.goto("/admin/parda?range=today");
			const overview = page.getByTestId("parda-admin-overview");
			await expect(overview).toBeVisible();
			await expect(page.getByTestId("parda-range-today")).toHaveAttribute("aria-current", "page");
			// Other pages may be playing while this runs: exact figures are in tests/server/parda-curation.test.ts.
			await expect(page.getByTestId("parda-top-titles").getByRole("link").first()).toBeVisible();
			await expect(page.getByTestId("parda-top-searches")).toContainText("e2e top search");
			await expect(page.getByTestId("parda-zero-searches")).toContainText("e2e nothing found");
			await expect(page.getByTestId("parda-servers")).toContainText("Server 1");

			// A longer range takes the finished days in; the links work without a reload.
			await page.getByTestId("parda-range-30d").click();
			await expect(page).toHaveURL(/range=30d/);
			await expect(page.getByTestId("parda-range-30d")).toHaveAttribute("aria-current", "page");
			await expect(overview.locator("[data-figures]").filter({ hasText: "Plays, 30 days" })).toContainText(/\d{3}/);
		} finally {
			await harness.pardaPlays(false);
		}
	});
});

test.describe("Parda's source ranking", () => {
	test.use(signedIn("admin"));

	test.afterEach(async ({ page, harness }) => {
		await harness.pardaUnrank();
		// Switching the mode clears this server's 30 s cache of the standings.
		await setOrder(page, "manual");
		await setOrder(page, "auto");
	});

	test("the probe's route needs its secret, names what to probe and stores a run", async ({ request }) => {
		const endpoint = "/api/parda/probe";
		expect((await request.get(endpoint)).status()).toBe(401);
		const headers = { authorization: `Bearer ${E2E.probeSecret}` };
		const plan = (await (await request.get(endpoint, { headers })).json()) as {
			titles: unknown[];
			sources: Array<{ id: string; name: string; urls: Array<string | null> }>;
		};
		expect(plan.sources.map((source) => source.name)).toEqual(
			expect.arrayContaining(["Server 1", "Server 2", "Server 3", "Server 4"]),
		);
		expect(plan.sources.every((source) => source.urls.length === plan.titles.length)).toBe(true);
		const run = {
			sourceId: plan.sources[0]?.id,
			media: "movie",
			tmdbId: 550,
			alive: true,
			startMs: 1_200,
			topHeight: null,
			ladder: [],
			popups: 0,
			clicks: 0,
			redirects: 0,
			videoHosts: [],
			error: null,
		};
		expect((await request.post(endpoint, { headers, data: { results: [{ ...run, extra: 1 }] } })).status()).toBe(400);
		const stored = await request.post(endpoint, { headers, data: { results: [run] } });
		expect(await stored.json()).toEqual({ ok: true, stored: 1, ignored: 0 });
	});

	test("automatic order starts on the best score; manual order on the admin's first", async ({ page, harness }) => {
		const watch = pardaFixturePath("watch-movie");
		await harness.pardaRank({ "Server 1": 0.2, "Server 2": 0.3, "Server 3": 0.4, "Server 4": 0.9 });
		await setOrder(page, "manual");
		await page.goto(watch);
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\/movie\//);

		await setOrder(page, "auto");
		// The list shows the scores and today's order.
		const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Server 4", exact: true }) });
		await expect(row).toContainText("0.9");
		await page.goto(watch);
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/4\/movie\//);
	});

	test("a slow connection starts on an adaptive source", async ({ page, harness }) => {
		const edit = async (choice: string) => {
			await page.goto(`/admin/parda/sources/${await harness.pardaSourceId("Server 4")}`, { waitUntil: "networkidle" });
			await page.getByRole("combobox", { name: "Adaptive quality" }).click();
			await page.getByRole("option", { name: choice, exact: true }).click();
			await page.getByRole("button", { name: "Save" }).click();
			await expect(page).toHaveURL(/\/admin\/parda\/sources$/);
		};
		await edit("Adaptive");
		try {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "connection", {
					configurable: true,
					value: { downlink: 1.5, saveData: false },
				});
			});
			await page.goto(pardaFixturePath("watch-movie"));
			await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/4\/movie\//);
		} finally {
			await edit("From the probe");
		}
	});

	test("a source failing on a title for two viewers is tried last there", async ({ page, browser, harness }) => {
		await harness.resetRateLimits();
		const watch = pardaFixturePath("watch-series");
		// Each failure must come from someone else (a visitor, then the admin): one client can't hide a source.
		const failOnce = async (viewer: Page, failures: number) => {
			await cue(viewer, 1, { cue: "fail" });
			await viewer.goto(watch);
			await expect(viewer.getByText("Trying Server 3…")).toBeVisible();
			await expect(viewer.getByTestId("watch-box")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
			await expect.poll(async () => (await harness.pardaTitleFails())[0]?.failures ?? 0).toBe(failures);
			await viewer.unroute("**/parda/api/1/**");
		};
		// A visitor: newContext would otherwise take the admin's storageState from test.use.
		const visitor = await browser.newContext({ baseURL: E2E.baseURL, storageState: { cookies: [], origins: [] } });
		await failOnce(await visitor.newPage(), 1);
		await visitor.close();
		await page.goto(watch);
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\//);
		await failOnce(page, 2);
		expect((await harness.pardaTitleFails())[0]?.skip_until).not.toBeNull();
		await page.goto(watch);
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/2\//);
		// Another title still starts on Server 1.
		await page.goto(pardaFixturePath("watch-movie"));
		await expect(frame(page)).toHaveAttribute("src", /^\/parda\/api\/1\//);
	});
});

// Task 67: the library and profiles (decision 0240). Each flow is a visitor whose first
// save starts a guest, so its profiles and rows are its own beside every other flow.
test.describe("Parda's library", () => {
	test("+ My List and ♥ start a guest, and the library lists and drops them", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		const heading = (await page.getByTestId("title-heading").textContent())?.trim() ?? "";
		await page.getByTestId("title-hero").getByTestId("list-toggle").click();
		await expect(page.getByTestId("title-hero").getByTestId("list-toggle")).toHaveAttribute("aria-pressed", "true");
		await expect(page.getByTestId("parda-guest-banner")).toBeVisible();
		await page.getByTestId("title-hero").getByTestId("favourite-toggle").click();
		await expect(page.getByTestId("title-hero").getByTestId("favourite-toggle")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.getByTestId("rate-like").click();
		await expect(page.getByTestId("rate-like")).toHaveAttribute("aria-pressed", "true");

		await page.goto("/app/parda/library/list");
		const list = page.getByTestId("library-list");
		await expect(list.getByTestId("poster-card")).toHaveCount(1);
		await expect(list).toContainText(heading.slice(0, 12));
		await page.goto("/app/parda/library/favourites");
		await expect(page.getByTestId("library-favourites").getByTestId("poster-card")).toHaveCount(1);
		// Off from the card: the list is empty again.
		await page.goto("/app/parda/library/list");
		await list.getByTestId("card-list-toggle").click();
		await page.reload();
		await expect(page.getByTestId("library-empty")).toBeVisible();
	});

	test("History lists a title marked watched, takes it out, and clears", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		await page.getByTestId("mark-title").click();
		await expect(page.getByTestId("mark-title")).toHaveAttribute("aria-pressed", "true");
		await page.goto("/app/parda/library/history");
		await expect(page.getByTestId("history-entry")).toHaveCount(1);
		await page.getByTestId("history-remove").click();
		await expect(page.getByTestId("library-empty")).toBeVisible();

		await page.goto(pardaFixturePath("series"), { waitUntil: "networkidle" });
		await page.getByTestId("mark-season").click();
		await expect(page.getByTestId("season-watched")).toBeVisible();
		await page.goto("/app/parda/library/history");
		await page.getByTestId("history-clear").click();
		await page.getByRole("alertdialog").getByRole("button", { name: "Clear history" }).click();
		await expect(page.getByTestId("library-empty")).toBeVisible();
	});
});

test.describe("Parda's profiles", () => {
	test("a kids' profile browses under its cap, and a PIN keeps it out of the parent's", async ({ page, harness }) => {
		await harness.resetRateLimits();
		await page.goto(pardaFixturePath("movie"), { waitUntil: "networkidle" });
		await page.getByTestId("title-hero").getByTestId("list-toggle").click();
		await expect(page.getByTestId("parda-guest-banner")).toBeVisible();

		await page.goto("/app/parda/profiles");
		await page.getByTestId("profiles-manage").click();
		await page.getByTestId("profile-add").click();
		const dialog = page.getByTestId("profile-dialog");
		await dialog.getByLabel("Name").fill("Kid");
		await dialog.getByRole("switch", { name: "Kids' profile" }).click();
		await dialog.getByRole("button", { name: "Add profile" }).click();
		await expect(dialog).toBeHidden();
		await expect(page.getByTestId("profile-tile")).toHaveCount(2);

		// Lock the account's own profile (the first) with a PIN.
		await page.getByTestId("profile-edit").first().click();
		await dialog.getByTestId("profile-pin-input").fill("2468");
		await dialog.getByTestId("profile-pin-save").click();
		await expect(page.getByText("The PIN is set.")).toBeVisible();
		await dialog.getByRole("button", { name: "Close" }).click();
		await page.getByTestId("profiles-manage").click();

		await page.getByTestId("profile-pick").filter({ hasText: "Kid" }).click();
		await page.waitForURL(/\/app\/parda$/);
		// The capped rails are TMDB's discover answers for the kids' cap.
		await expect(page.getByTestId("title-rail").first()).toBeVisible();
		await page.goto("/app/parda/profiles");
		await expect(page.getByTestId("profiles-kids-note")).toBeVisible();
		await expect(page.getByTestId("profiles-manage")).toHaveCount(0);

		await page.getByTestId("profile-pick").first().click();
		const pin = page.getByTestId("pin-dialog");
		await pin.getByTestId("pin-entry").fill("1111");
		await pin.getByTestId("pin-submit").click();
		await expect(pin.getByRole("alert")).toHaveText("That PIN isn't right.");
		await pin.getByTestId("pin-entry").fill("2468");
		await pin.getByTestId("pin-submit").click();
		await page.waitForURL(/\/app\/parda$/);
		await page.goto("/app/parda/profiles");
		await expect(page.getByTestId("profiles-manage")).toBeVisible();
	});
});

// Task 68: the schedule and new-episode alerts (decision 0241). The daily check is covered
// on PGlite; here the harness writes its alert for this flow's own guest.
test.describe("Parda's alerts", () => {
	test("the bell shows a new episode of a followed series, opens its episode, and the home and schedule list it", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		const series = pardaFixturePath("series");
		await page.goto(series, { waitUntil: "networkidle" });
		const title = (await page.getByTestId("title-heading").textContent())?.trim() ?? "";
		await page.getByTestId("title-hero").getByTestId("list-toggle").click();
		await expect(page.getByTestId("parda-guest-banner")).toBeVisible();
		await expect(page.getByTestId("parda-bell")).toBeVisible();
		await expect(page.getByTestId("parda-bell-count")).toHaveCount(0);

		const session = (await (await page.request.get("/api/auth/get-session")).json()) as { user: { id: string } };
		const id = Number(/\/series\/(\d+)/.exec(series)?.[1]);
		await harness.pardaAlert(session.user.id, id, title);

		await page.goto("/app/parda", { waitUntil: "networkidle" });
		await expect(page.getByTestId("parda-bell-count")).toHaveText("1");
		await expect(page.getByTestId("new-episodes-rail")).toContainText(title.slice(0, 12));
		await page.getByTestId("parda-bell").click();
		const inbox = page.getByTestId("parda-inbox");
		await expect(inbox.getByTestId("inbox-item")).toHaveCount(1);
		await expect(inbox.getByTestId("inbox-unread")).toHaveCount(1);
		await expect(page.getByTestId("parda-bell-count")).toHaveCount(0);
		await inbox.getByTestId("inbox-item").click();
		await page.waitForURL(/\/app\/parda\/watch\/series\/\d+[^?]*\?s=1&e=1$/);

		// Read now, after a reload too; the bell leads to the schedule.
		await page.goto("/app/parda");
		await expect(page.getByTestId("parda-bell-count")).toHaveCount(0);
		await page.getByTestId("parda-bell").click();
		await page.getByTestId("parda-inbox-schedule").click();
		await page.waitForURL(/\/app\/parda\/schedule$/);
		await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
		await expect(page.getByTestId("schedule-signed-out")).toHaveCount(0);
	});

	test("a visitor's schedule asks them to sign in, and has no bell", async ({ page }) => {
		await page.goto("/app/parda/schedule");
		await expect(page.getByTestId("schedule-signed-out")).toBeVisible();
		await expect(page.getByTestId("parda-bell")).toHaveCount(0);
	});
});

// Task 69a: a watch party, in two browsers, on the stand-in for the realtime service.
test.describe("Parda's watch party", () => {
	test.use(signedIn("member"));

	const box = (page: Page) => page.getByTestId("party-box");
	const status = (page: Page) => page.getByTestId("party-status");
	const partyFrame = (page: Page) => box(page).locator("iframe");
	const seconds = async (page: Page) => {
		const text = (await page.getByTestId("control-time").textContent()) ?? "";
		const [minutes = "0", rest = "0"] = (text.split(" / ")[0] ?? "").split(":");
		return Number(minutes) * 60 + Number(rest);
	};
	/** Freezes this viewer's placeholder, or lets it go: a stall nobody can fake from a cue. */
	const rehearseStall = (page: Page, on: boolean) =>
		page.evaluate(
			(hold) =>
				document
					.querySelector<HTMLIFrameElement>('[data-testid="party-box"] iframe')
					?.contentWindow?.postMessage({ type: "parda.command", action: "rehearse-stall", on: hold }, location.origin),
			on,
		);
	const openParty = async (page: Page) => {
		await page.goto(pardaFixturePath("watch-movie"), { waitUntil: "networkidle" });
		await page.getByTestId("watch-together").click();
		await page.waitForURL(/\/app\/parda\/party\/[\w-]{16}$/);
		await expect(page.getByTestId("party-ready")).toBeEnabled();
		await expect(page.getByTestId("party-start")).toBeEnabled();
		return page.url();
	};
	const visitor = async (browser: Browser, url: string) => {
		const context = await browser.newContext({ baseURL: E2E.baseURL, storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();
		await page.goto(url, { waitUntil: "networkidle" });
		return { context, page };
	};
	const bothPlaying = async (host: Page, guest: Page) => {
		for (const page of [host, guest]) {
			await expect(box(page)).toHaveAttribute("data-phase", "live", { timeout: 15_000 });
			await expect(status(page)).toHaveText("Playing together", { timeout: 15_000 });
		}
	};
	const started = async (browser: Browser, host: Page, harness: Harness) => {
		await harness.resetRateLimits();
		const url = await openParty(host);
		const { context, page: guest } = await visitor(browser, url);
		await guest.getByTestId("party-ready").click();
		await expect(host.getByTestId("party-member")).toHaveCount(2, { timeout: 15_000 });
		await host.getByTestId("party-ready").click();
		await bothPlaying(host, guest);
		return { context, guest, url };
	};

	test("shows the button, with the realtime host in the CSP only as configured", async ({ page }) => {
		const response = await page.goto(pardaFixturePath("watch-movie"), { waitUntil: "networkidle" });
		await expect(page.getByTestId("watch-together")).toBeVisible();
		const relay = new URL(E2E.harnessURL.replace("http", "ws")).origin;
		expect(response?.headers()["content-security-policy"]).toMatch(new RegExp(`connect-src [^;]*${relay}`));
	});

	test("a wrong code is Parda's 404", async ({ page, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		const response = await page.goto("/app/parda/party/no-such-party-00", { waitUntil: "networkidle" });
		expect(response?.status()).toBe(404);
		await expect(page.getByTestId("parda-frame")).toBeVisible();
	});

	test("starts once everyone is ready, and a guest joins from the link", async ({ browser, page, harness }) => {
		const { context, guest } = await started(browser, page, harness);
		await expect(partyFrame(page)).toHaveAttribute("src", /^\/parda\/api\/\d\/movie\//);
		await expect(partyFrame(guest)).toHaveAttribute("src", /^\/parda\/api\/\d\/movie\//);
		// The party's clock runs in both.
		await expect.poll(() => seconds(guest), { timeout: 10_000 }).toBeGreaterThan(0);
		await context.close();
	});

	test("the host can start alone, and a late joiner lands on the group's position", async ({
		browser,
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		const url = await openParty(page);
		await page.getByTestId("party-ready").click();
		await page.getByTestId("party-start").click();
		await expect(status(page)).toHaveText("Playing together", { timeout: 15_000 });
		await expect.poll(() => seconds(page), { timeout: 15_000 }).toBeGreaterThan(4);
		const { context, page: late } = await visitor(browser, url);
		await expect(status(late)).toContainText("already playing");
		await late.getByTestId("party-ready").click();
		await expect(partyFrame(late)).toHaveAttribute("src", /start=[1-9]/);
		await expect.poll(async () => Math.abs((await seconds(late)) - (await seconds(page)))).toBeLessThanOrEqual(3);
		await context.close();
	});

	test("a pause on one pauses the other, and either can resume", async ({ browser, page, harness }) => {
		const { context, guest } = await started(browser, page, harness);
		await page.getByTestId("control-toggle").click();
		await expect(status(guest)).toHaveText("Paused for everyone");
		await expect(guest.getByTestId("control-toggle")).toHaveAttribute("aria-label", "Play");
		const frozen = await seconds(guest);
		await guest.waitForTimeout(1500);
		expect(await seconds(guest)).toBe(frozen);
		await guest.getByTestId("control-toggle").click();
		await bothPlaying(page, guest);
		await context.close();
	});

	test("a seek moves everyone", async ({ browser, page, harness }) => {
		const { context, guest } = await started(browser, page, harness);
		await guest.getByTestId("control-seek").fill("600");
		await expect.poll(() => seconds(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(600);
		await expect.poll(() => seconds(guest), { timeout: 10_000 }).toBeGreaterThanOrEqual(600);
		await context.close();
	});

	test("a stall on one pauses the other and names them; resuming seeks both to one position", async ({
		browser,
		page,
		harness,
	}) => {
		const { context, guest } = await started(browser, page, harness);
		const name = (await guest.getByTestId("party-member").filter({ hasText: "(you)" }).textContent()) ?? "";
		const guestName = /^(.+) \(you\)/.exec(name)?.[1] ?? "";
		expect(guestName).not.toBe("");
		// Past the commands' grace, so the stall detector counts.
		await guest.waitForTimeout(3500);
		await rehearseStall(guest, true);
		await expect(status(page)).toHaveText(`Waiting for ${guestName}`, { timeout: 10_000 });
		await expect(status(guest)).toContainText("You're buffering");
		await expect(page.getByTestId("control-toggle")).toHaveAttribute("aria-label", "Play");
		await rehearseStall(guest, false);
		await bothPlaying(page, guest);
		await expect.poll(async () => Math.abs((await seconds(page)) - (await seconds(guest)))).toBeLessThanOrEqual(2);
		await context.close();
	});

	test("a reload rejoins at the group's position", async ({ browser, page, harness }) => {
		const { context, guest } = await started(browser, page, harness);
		await page.getByTestId("control-seek").fill("900");
		await expect.poll(() => seconds(guest), { timeout: 10_000 }).toBeGreaterThanOrEqual(900);
		await guest.reload({ waitUntil: "networkidle" });
		await guest.getByTestId("party-ready").click();
		await expect(partyFrame(guest)).toHaveAttribute("src", /start=9\d\d/);
		await expect(status(guest)).toHaveText("Playing together", { timeout: 15_000 });
		await context.close();
	});

	test("only the host changes the source; everyone moves, 30 s earlier", async ({ browser, page, harness }) => {
		const { context, guest } = await started(browser, page, harness);
		await expect(guest.getByTestId("party-server-menu")).toHaveCount(0);
		await page.getByTestId("control-seek").fill("600");
		await expect.poll(() => seconds(guest), { timeout: 10_000 }).toBeGreaterThanOrEqual(600);
		const before = /\/parda\/api\/(\d)\//.exec((await partyFrame(page).getAttribute("src")) ?? "")?.[1];
		await page.getByTestId("party-server-menu").click();
		await page
			.getByTestId("party-server-option")
			.filter({ hasNotText: `Server ${before}` })
			.first()
			.click();
		for (const viewer of [page, guest]) {
			await expect(partyFrame(viewer)).not.toHaveAttribute("src", new RegExp(`/parda/api/${before}/`));
			await expect(partyFrame(viewer)).toHaveAttribute("src", /start=5[7-9]\d/);
		}
		await bothPlaying(page, guest);
		await context.close();
	});

	test("the host ends it for everyone, and its link is gone", async ({ browser, page, harness, guard }) => {
		guard.allow(RESOURCE_STATUS(404));
		const { context, guest, url } = await started(browser, page, harness);
		await page.getByTestId("party-end").click();
		await expect(page.getByTestId("party-ended")).toBeVisible();
		await expect(guest.getByTestId("party-ended")).toBeVisible();
		await context.close();
		expect((await page.goto(url))?.status()).toBe(404);
	});
});

test.describe("Parda's watch party on a server without commands", () => {
	test.use(signedIn("admin"));

	test("starts together, says it can't pause together, and resyncs with its start position", async ({
		page,
		harness,
	}) => {
		await harness.resetRateLimits();
		const name = `E2E Silent ${Date.now()}`;
		await page.goto("/admin/parda/sources/new", { waitUntil: "networkidle" });
		await page.getByLabel("Name (English)").fill(name);
		await page.getByLabel("Movie address").fill("/1/movie/{id}?start={start}&cue=silent");
		await page.getByLabel("Episode address").fill("/1/tv/{id}/{season}/{episode}?start={start}&cue=silent");
		await page.getByRole("switch", { name: "Enabled" }).click();
		await page.getByRole("button", { name: "Create" }).click();
		await expect(page).toHaveURL(/\/admin\/parda\/sources$/);

		await page.goto(pardaFixturePath("watch-movie"), { waitUntil: "networkidle" });
		await page.getByTestId("watch-together").click();
		await page.waitForURL(/\/app\/parda\/party\/[\w-]{16}$/);
		const partyBox = page.getByTestId("party-box");
		await expect(page.getByTestId("party-start")).toBeEnabled();
		await expect(partyBox).toHaveAttribute("data-mode", "full");
		await page.getByTestId("party-ready").click();
		await page.getByTestId("party-start").click();
		await expect(partyBox).toHaveAttribute("data-phase", "live", { timeout: 15_000 });

		await page.getByTestId("party-server-menu").click();
		await page.getByTestId("party-server-option").filter({ hasText: name }).click();
		await expect(partyBox).toHaveAttribute("data-mode", "together");
		await expect(page.getByTestId("party-status")).toContainText("can't pause together");
		await expect(page.getByTestId("shield-controls")).toHaveCount(0);
		await expect(page.getByTestId("party-switch-sync")).toBeVisible();

		const frame = partyBox.locator("iframe");
		await expect(frame).toHaveAttribute("src", /cue=silent/);
		await expect(frame).toHaveAttribute("src", /start=0&/);
		await page.waitForTimeout(3000);
		await page.getByTestId("party-resync").click();
		await expect(frame).toHaveAttribute("src", /start=[1-9]/);

		await page.getByTestId("party-switch-sync").click();
		await expect(partyBox).toHaveAttribute("data-mode", "full");
		await page.getByTestId("party-end").click();
		await expect(page.getByTestId("party-ended")).toBeVisible();

		await page.goto("/admin/parda/sources", { waitUntil: "networkidle" });
		await rowAction(page, name, "Delete");
		await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
		await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
	});
});
