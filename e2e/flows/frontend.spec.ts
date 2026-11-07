/**
 * Frontend quality (Task 31): the skip link, reduced motion and CSP violation reports.
 * Browsers deliver Reporting API reports out of band (not visible to Playwright), so the
 * policy and the endpoint are checked here and the forwarding to Sentry in
 * tests/server/csp-report.test.ts.
 */
import { expect, signedIn, test } from "../support/fixtures.ts";

test.describe("skip link", () => {
	for (const path of ["/", "/ne/dev/test-crud", "/login"]) {
		test(`moves keyboard focus past the header on ${path}`, async ({ page }) => {
			await page.goto(path, { waitUntil: "load" });
			await page.keyboard.press("Tab");
			const link = page.getByTestId("skip-link");
			await expect(link).toBeFocused();
			await expect(link).toBeInViewport();
			await page.keyboard.press("Enter");
			await expect(page.locator("main#main-content")).toBeFocused();
		});
	}

	test.describe("in the admin area", () => {
		test.use(signedIn("admin"));
		test("skips the sidebar too", async ({ page }) => {
			await page.goto("/admin/test-crud", { waitUntil: "load" });
			await page.keyboard.press("Tab");
			await page.keyboard.press("Enter");
			await expect(page.locator("main#main-content")).toBeFocused();
			// The next tab stop is inside the page, not the sidebar.
			await page.keyboard.press("Tab");
			const inSidebar = await page.evaluate(() =>
				Boolean(document.activeElement?.closest("[data-testid=admin-sidebar]")),
			);
			expect(inSidebar).toBe(false);
		});
	});
});

test.describe("reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("animations and transitions finish at once", async ({ page }) => {
		await page.goto("/", { waitUntil: "load" });
		const timings = await page.evaluate(() => {
			// Inline styles: the reduced-motion rule must beat those too.
			const probe = document.createElement("div");
			probe.style.animation = "probe 2s infinite";
			probe.style.transition = "opacity 700ms 300ms";
			document.body.append(probe);
			const style = getComputedStyle(probe);
			const seconds = (value: string) => Number.parseFloat(value);
			const result = {
				animation: seconds(style.animationDuration),
				iterations: style.animationIterationCount,
				transition: seconds(style.transitionDuration),
				delay: seconds(style.transitionDelay),
			};
			probe.remove();
			return result;
		});
		expect(timings.animation).toBeLessThan(0.001);
		expect(timings.iterations).toBe("1");
		expect(timings.transition).toBeLessThan(0.001);
		expect(timings.delay).toBe(0);
	});
});

test.describe("CSP violation reports", () => {
	test("pages name the report endpoint in their policy", async ({ request }) => {
		const headers = (await request.get("/")).headers();
		const endpoint = new URL("/api/csp-report", test.info().project.use.baseURL).href;
		expect(headers["reporting-endpoints"]).toBe(`csp="${endpoint}"`);
		expect(headers["content-security-policy"]).toContain(`report-uri ${endpoint}`);
		expect(headers["content-security-policy"]).toMatch(/report-to csp(?:;|$)/);
	});

	test("the endpoint accepts both report formats and refuses anything else", async ({ request }) => {
		const legacy = await request.post("/api/csp-report", {
			headers: { "content-type": "application/csp-report" },
			data: JSON.stringify({
				"csp-report": {
					"document-uri": "http://localhost/",
					"effective-directive": "img-src",
					"blocked-uri": "https://e2e.invalid/pixel.png",
				},
			}),
		});
		expect(legacy.status()).toBe(204);
		const reportingApi = await request.post("/api/csp-report", {
			headers: { "content-type": "application/reports+json" },
			data: JSON.stringify([
				{
					type: "csp-violation",
					url: "http://localhost/",
					body: { documentURL: "http://localhost/", effectiveDirective: "script-src-elem", blockedURL: "inline" },
				},
			]),
		});
		expect(reportingApi.status()).toBe(204);
		const wrongType = await request.post("/api/csp-report", { headers: { "content-type": "text/plain" }, data: "x" });
		expect(wrongType.status()).toBe(415);
	});
});
