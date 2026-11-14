/**
 * The UX audit of a reviewed page (Part 9 Task 98), off unless AUDIT_DIR is set:
 *
 *   AUDIT_DIR=.data/audit/ux AUDIT_WIDTHS=1280,1920 pnpm exec playwright test --project review --grep "light (1280|1920) › en"
 *
 * For each page the review loads it saves a screenshot of the first screen and a JSON file with:
 * how much of the width beside the sidebar the content uses, the page's anatomy (its <h1>,
 * breadcrumbs, landmarks), and the server functions the browser called while the page loaded
 * ("the first load asks for nothing", docs/PLAN.md 15.5). `node scripts/audit/ux.ts` reads them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type Page, test } from "@playwright/test";

const DIR = process.env.AUDIT_DIR;

/** The review's widths, or AUDIT_WIDTHS for an audit run (1920 is not a reviewed width). */
export const auditWidths = (reviewed: ReadonlyArray<number>): ReadonlyArray<number> =>
	process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(",").map(Number) : reviewed;

/** Starts watching the page's requests before the measured load; `finish` records the page after it. */
export function startAudit(page: Page) {
	if (!DIR) return undefined;
	const calls: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.pathname.startsWith("/_serverFn/")) calls.push(`${request.method()} ${url.pathname.slice(0, 80)}`);
	});

	return {
		async finish() {
			// review.spec.ts › <route and who> › <theme width> › <locale>
			const [, route = "", variant = "", locale = ""] = test.info().titlePath;
			const width = page.viewportSize()?.width ?? 0;
			const name = `${route.replace(/[^a-z0-9$]+/gi, "-").replace(/^-|-$/g, "") || "home"}--${variant.replace(/\s+/g, "-")}-${locale}`;
			const layout = await page.evaluate(() => {
				const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
				const visible = (element: Element) => {
					const rect = element.getBoundingClientRect();
					const style = getComputedStyle(element);
					return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
				};
				// A sidebar: something tall and narrow on the left edge. The content area starts where it ends.
				let contentLeft = 0;
				for (const element of document.querySelectorAll("aside, nav, [data-sidebar], [data-slot='sidebar']")) {
					const rect = element.getBoundingClientRect();
					const tall = rect.height >= viewport.height * 0.6;
					if (visible(element) && tall && rect.left <= 1 && rect.width < viewport.width * 0.4) {
						contentLeft = Math.max(contentLeft, rect.right);
					}
				}
				const main = document.querySelector("main");
				const mainRect = main?.getBoundingClientRect();
				// What the page shows in its first screen: text, pictures, controls and tables inside <main>.
				let left = Number.POSITIVE_INFINITY;
				let right = 0;
				for (const element of main?.querySelectorAll("*") ?? []) {
					const leaf =
						/^(IMG|SVG|CANVAS|VIDEO|INPUT|BUTTON|SELECT|TEXTAREA|TABLE|IFRAME)$/i.test(element.tagName) ||
						[...element.childNodes].some(
							(node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
						);
					if (!leaf || !visible(element)) continue;
					const rect = element.getBoundingClientRect();
					if (rect.top > viewport.height || rect.bottom < 0) continue;
					left = Math.min(left, Math.max(rect.left, contentLeft));
					right = Math.max(right, Math.min(rect.right, viewport.width));
				}
				const available = viewport.width - contentLeft;
				const used = right > left ? right - left : 0;
				const headings = [...document.querySelectorAll("h1")].filter(visible);
				return {
					viewport,
					contentLeft: Math.round(contentLeft),
					main: mainRect ? { left: Math.round(mainRect.left), width: Math.round(mainRect.width) } : null,
					used: { left: Math.round(left === Number.POSITIVE_INFINITY ? 0 : left), right: Math.round(right) },
					/** The share of the width beside the sidebar that the first screen's content spans. */
					share: available > 0 ? Math.round((used / available) * 100) / 100 : 0,
					emptyLeft: Math.round(Math.max(0, (left === Number.POSITIVE_INFINITY ? contentLeft : left) - contentLeft)),
					emptyRight: Math.round(Math.max(0, viewport.width - right)),
					anatomy: {
						mains: document.querySelectorAll("main").length,
						h1: headings.length,
						h1Text: (headings[0]?.textContent ?? "").trim().slice(0, 80),
						h1Top: headings[0] ? Math.round(headings[0].getBoundingClientRect().top) : null,
						breadcrumbs: Boolean(document.querySelector("[data-testid='breadcrumbs']")),
						sidebar: contentLeft > 0,
						header: Boolean(document.querySelector("body header")),
						footer: Boolean(document.querySelector("body footer")),
						tabs: document.querySelectorAll("[role='tablist']").length,
						tables: document.querySelectorAll("main table").length,
						forms: document.querySelectorAll("main form").length,
						scrollHeight: document.documentElement.scrollHeight,
					},
					title: document.title,
				};
			});
			mkdirSync(path.join(DIR, "screens", String(width)), { recursive: true });
			await page.screenshot({
				path: path.join(DIR, "screens", String(width), `${name}.jpg`),
				type: "jpeg",
				quality: 55,
			});
			writeFileSync(
				path.join(DIR, `${name}.json`),
				JSON.stringify(
					{ route, variant, locale, width, url: new URL(page.url()).pathname, calls, ...layout },
					null,
					"\t",
				),
			);
		},
	};
}
