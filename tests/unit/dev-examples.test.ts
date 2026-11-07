import { existsSync } from "node:fs";
import { type AnyRoute, createRouter, isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/features/dev/examples/registry";
import type { RouterContext } from "@/router";
import { routeTree } from "@/routeTree.gen";

const router = createRouter({ routeTree, context: {} as RouterContext });
const exampleRoutes = (Object.values(router.routesById) as AnyRoute[])
	.map((route) => route.fullPath as string)
	.filter((path) => /^\/dev\/examples\/[^/$]+\/?$/.test(path))
	.map((path) => path.replace(/^\/dev\/examples\//, "").replace(/\/$/, ""));

describe("/dev/examples", () => {
	it("the index lists exactly the example routes", () => {
		expect([...new Set(exampleRoutes)].sort()).toEqual(EXAMPLES.map((example) => example.slug).sort());
	});

	it("covers every module named in the plan", () => {
		// 14 from Part 2, plus the recipes: idempotency keys (Task 28), list extras, caching,
		// background jobs and the contact form (Task 33). Task 31's command palette became
		// part of the admin shell in Task 36 (decision 0165); Task 37 added the kit pages (components, fields).
		expect(EXAMPLES).toHaveLength(21);
	});

	it("each example's source file and guide exist", () => {
		for (const example of EXAMPLES) {
			expect(existsSync(example.source), example.source).toBe(true);
			expect(existsSync(example.guide), example.guide).toBe(true);
		}
	});

	// DEV_ROUTES is read once, when src/lib/dev-routes.ts loads (Vite inlines it in builds):
	// each case loads the guards again under its own env.
	const load = async (env: { DEV: boolean; VITE_DEV_ROUTES?: string }) => {
		vi.resetModules();
		vi.stubEnv("DEV", env.DEV);
		vi.stubEnv("VITE_DEV_ROUTES", env.VITE_DEV_ROUTES ?? "");
		const [{ Route }, { assertDev }, { isAppError }] = await Promise.all([
			import("@/routes/dev/route"),
			import("@/middleware/dev"),
			import("@/lib/errors"),
		]);
		return { beforeLoad: Route.options.beforeLoad as () => void, assertDev, isAppError };
	};
	const thrownBy = (fn: () => void) => {
		try {
			fn();
		} catch (error) {
			return error;
		}
		return undefined;
	};

	it("every /dev page is a 404 in a plain build", async () => {
		const { beforeLoad } = await load({ DEV: false });
		expect(isNotFound(thrownBy(beforeLoad))).toBe(true);
	});

	it("is open in development, and in a build made with VITE_DEV_ROUTES=true (the e2e harness)", async () => {
		expect(thrownBy((await load({ DEV: true })).beforeLoad)).toBeUndefined();
		expect(thrownBy((await load({ DEV: false, VITE_DEV_ROUTES: "true" })).beforeLoad)).toBeUndefined();
	});

	it("dev-only server functions refuse with NOT_FOUND in a plain build", async () => {
		expect(thrownBy((await load({ DEV: true })).assertDev)).toBeUndefined();
		const { assertDev, isAppError } = await load({ DEV: false, VITE_DEV_ROUTES: "false" });
		const thrown = thrownBy(assertDev);
		expect(isAppError(thrown) && thrown.code).toBe("NOT_FOUND");
	});
});
