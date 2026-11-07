/**
 * The browser review of one page load (docs/guides/testing.md): status, horizontal
 * overflow, layout shift, axe, a skip link to <main>; console and CSP problems are
 * failed by the guard fixture.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "./fixtures.ts";

/** WCAG 2.2 AA plus axe's best practices. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const MAX_CLS = 0.01;

export async function reviewPage(page: Page, url: string, { status = 200 }: { status?: number } = {}) {
	// Warm-up load: the measured load then has the fonts in the HTTP cache, as on an idle machine where
	// the preloaded fonts arrive before first paint. Cold, on a busy CPU, the fallback faces paint first
	// and the swap shifts text, so CLS would depend on how loaded the machine is (decision 0121).
	await page.goto(url, { waitUntil: "load" });
	const response = await page.goto(url, { waitUntil: "networkidle" });
	expect(response?.status(), `HTTP status of ${url}`).toBe(status);
	// Fonts settle and hydration finishes before measuring.
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});

	const overflow = await page.evaluate(() => {
		const width = document.documentElement.clientWidth;
		if (document.documentElement.scrollWidth <= width) return [];
		return [...document.querySelectorAll("body *")]
			.filter((element) => element.getBoundingClientRect().right > width + 1)
			.slice(0, 5)
			.map(
				(element) => `${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/).slice(0, 3).join(".")}`,
			);
	});
	expect.soft(overflow, "elements wider than the viewport (horizontal scroll)").toEqual([]);

	const layout = await page.evaluate(() => window.__e2e);
	expect
		.soft(layout.cls, `cumulative layout shift ≤ ${MAX_CLS}; shifts: ${layout.shifts.join(" | ")}`)
		.toBeLessThanOrEqual(MAX_CLS);

	const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
	const violations = axe.violations.map(
		(violation) =>
			`${violation.id} (${violation.impact}): ${violation.nodes
				.map((node) => node.target.join(" "))
				.slice(0, 5)
				.join(", ")}`,
	);
	expect.soft(violations, "axe violations").toEqual([]);

	// Keyboard: the first tab stop is a skip link whose target is the page's <main>.
	// After axe, so the focused (now visible) link can't affect the checks above.
	await page.keyboard.press("Tab");
	const skipLink = await page.evaluate(() => {
		const link = document.activeElement;
		if (!(link instanceof HTMLAnchorElement) || !link.hash) return `first tab stop is <${link?.tagName.toLowerCase()}>`;
		const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
		return target?.tagName === "MAIN"
			? null
			: `${link.hash} is ${target ? `<${target.tagName.toLowerCase()}>` : "missing"}`;
	});
	expect.soft(skipLink, "skip link to the page's <main>").toBeNull();
}
