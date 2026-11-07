// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	type RouteComponent,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { sessionQueryOptions } from "@/features/auth/queries";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";
import { Route as RootRoute } from "@/routes/__root";
import { Route as AdminRoute } from "@/routes/_admin";
import { Route as AuthRoute } from "@/routes/_auth";
import { Route as AuthedRoute } from "@/routes/_authed";
import { Route as PublicRoute } from "@/routes/_public";
import { Route as SiteRoute } from "@/routes/_site"; // @portfolio
import { Route as DevRoute } from "@/routes/dev/route";

// portfolio:start
// The portfolio's reads are server functions whose modules import server code (Start strips it from
// the browser build; here nothing does). This test only reads the layout's options.
vi.mock("@/functions/portfolio-public", () => ({
	getPublicProfile: vi.fn(),
	getHome: vi.fn(),
	getWork: vi.fn(),
	getCaseStudy: vi.fn(),
	getAbout: vi.fn(),
	getJournal: vi.fn(),
	getArticle: vi.fn(),
	submitContactMessage: vi.fn(),
}));
// portfolio:end

/**
 * One header per section (decision 0161): the root renders none, each layout
 * renders its own, and the portfolio layout skips the session lookup.
 */
async function renderLayout(layout: RouteComponent | undefined) {
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({
		component: Outlet,
		notFoundComponent: NotFoundPage,
	});
	const section = createRoute({ getParentRoute: () => rootRoute, path: "/section", component: layout ?? Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <p>home</p> }),
		section.addChildren([createRoute({ getParentRoute: () => section, path: "/", component: () => <p>page</p> })]),
	]);
	return async (path: string) => {
		const router = createRouter({
			routeTree,
			history: createMemoryHistory({ initialEntries: [path] }),
			context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
		});
		await act(() => router.load());
		const queryClient = new QueryClient();
		queryClient.setQueryData(sessionQueryOptions().queryKey, null);
		render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);
	};
}

describe("section headers", () => {
	it("the root layout renders no header", () => {
		// The root's shell renders <html>, which jsdom can't mount inside a container.
		expect(readFileSync("src/routes/__root.tsx", "utf8")).not.toMatch(/SiteHeader|PortfolioHeader/);
	});

	it.each([
		["_public", PublicRoute],
		["_auth", AuthRoute],
		["_authed", AuthedRoute],
		["_admin", AdminRoute],
		["dev", DevRoute],
	] as const)("the %s layout renders its header once", async (_name, route) => {
		const visit = await renderLayout(route.options.component);
		await visit("/section");
		await screen.findByText("page");
		expect(screen.getAllByRole("banner")).toHaveLength(1);
	});

	it("each section has its own frame (Graphite shells, decision 0164)", async () => {
		const frames = [
			[AuthRoute, "auth-brand-panel"],
			[PublicRoute, "auth-brand-panel"],
			[AdminRoute, "admin-sidebar"],
			[DevRoute, "nav-login"],
		] as const;
		for (const [route, testId] of frames) {
			const visit = await renderLayout(route.options.component);
			await visit("/section");
			expect(await screen.findByTestId(testId)).toBeTruthy();
			cleanup();
		}
	});

	it("only /dev's header has section links", async () => {
		const visitDev = await renderLayout(DevRoute.options.component);
		await visitDev("/section");
		const nav = await screen.findByRole("navigation", { name: "Main" });
		expect(nav.querySelectorAll("a").length).toBe(4);
	});

	it("a root 404 has no header, but still a <main> for the skip link and a link home", async () => {
		const visit = await renderLayout(undefined);
		await visit("/no-such-page");
		const main = await screen.findByTestId("not-found-page");
		expect(screen.queryByRole("banner")).toBeNull();
		expect(main.tagName).toBe("MAIN");
		expect(main.id).toBe("main-content");
		expect(screen.getByRole("link").getAttribute("href")).toBe("/");
	});
});

describe("session scope", () => {
	type BeforeLoad = (options: {
		context: { queryClient: QueryClient };
		matches: ReadonlyArray<{ staticData: object }>;
	}) => Promise<{ session: unknown }>;
	const beforeLoad = RootRoute.options.beforeLoad as unknown as BeforeLoad;
	const signedIn = { user: { id: "u1" }, permissions: [] };

	// portfolio:start
	it("the portfolio layout skips the session", () => {
		expect(SiteRoute.options.staticData).toMatchObject({ session: "skip" });
	});
	// portfolio:end

	it("the root looks the session up, except when a matched route skips it", async () => {
		const queryClient = new QueryClient();
		const query = vi.spyOn(queryClient, "query").mockResolvedValue(signedIn);
		await expect(beforeLoad({ context: { queryClient }, matches: [{ staticData: {} }] })).resolves.toEqual({
			session: signedIn,
		});
		expect(query).toHaveBeenCalledTimes(1);
		await expect(
			beforeLoad({ context: { queryClient }, matches: [{ staticData: {} }, { staticData: { session: "skip" } }] }),
		).resolves.toEqual({ session: null });
		expect(query).toHaveBeenCalledTimes(1);
	});
});
