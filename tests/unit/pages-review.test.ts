import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOT_REVIEWED, REVIEWED_PAGES, routePattern } from "../../e2e/support/pages";

/** The `to` paths of every file route, read from the generated tree (importing it would load every route). */
const routePaths = () => {
	const source = readFileSync("src/routeTree.gen.ts", "utf8");
	const block = /export interface FileRoutesByTo \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
	return [...block.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1] ?? "");
};

describe("browser review page list (e2e/support/pages.ts)", () => {
	it("reads the route tree", () => {
		expect(routePaths()).toContain("/admin/test-crud/$id");
	});

	it("reviews or explicitly skips every route", () => {
		const reviewed = new Set(REVIEWED_PAGES.map((page) => page.route));
		const missing = routePaths().filter((route) => !reviewed.has(route) && !(route in NOT_REVIEWED));
		expect(missing, "add these routes to REVIEWED_PAGES (or NOT_REVIEWED with a reason)").toEqual([]);
	});

	it("lists only routes that exist", () => {
		const routes = new Set(routePaths());
		const stale = [
			...REVIEWED_PAGES.filter((page) => page.route !== "(not found)").map((page) => page.route),
			...Object.keys(NOT_REVIEWED),
		].filter((route) => !routes.has(route));
		expect(stale).toEqual([]);
	});

	it("says how every $param route gets a URL", () => {
		expect(REVIEWED_PAGES.filter((page) => page.route.includes("$") && !page.params && !page.path)).toEqual([]);
	});

	it("matches a $param route's concrete paths", () => {
		expect(routePattern("/work/$slug").test("/work/some-case")).toBe(true);
		expect(routePattern("/work/$slug").test("/work/a/b")).toBe(false);
	});
});
