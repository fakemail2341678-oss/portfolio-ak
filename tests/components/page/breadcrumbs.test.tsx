// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { loaderTitleCrumb, staticCrumb } from "@/lib/breadcrumbs";

/**
 * The same route shapes as the app: a pathless layout (`_public`), a section
 * layout (`route.tsx`) with an index route, and a detail route whose loader
 * returns the title.
 */
async function renderAt(url: string) {
	const page = () => <Breadcrumbs jsonLd />;
	const root = createRootRoute({ component: Outlet });
	const publicLayout = createRoute({
		getParentRoute: () => root,
		id: "_public",
		staticData: { breadcrumb: staticCrumb(() => "Home") },
		component: Outlet,
	});
	const home = createRoute({ getParentRoute: () => publicLayout, path: "/", component: page });
	const section = createRoute({
		getParentRoute: () => publicLayout,
		path: "items",
		staticData: { breadcrumb: staticCrumb(() => "Items") },
		component: Outlet,
	});
	const list = createRoute({ getParentRoute: () => section, path: "/", component: page });
	const detail = createRoute({
		getParentRoute: () => section,
		path: "$slug",
		loader: ({ params }) => ({ title: `Item ${params.slug}` }),
		staticData: { breadcrumb: loaderTitleCrumb },
		component: page,
	});
	const router = createRouter({
		routeTree: root.addChildren([publicLayout.addChildren([home, section.addChildren([list, detail])])]),
		history: createMemoryHistory({ initialEntries: [url] }),
	});
	await act(() => router.load());
	render(<RouterProvider router={router} />);
	return screen.findByTestId("breadcrumbs");
}

describe("<Breadcrumbs>", () => {
	it("builds the trail from route staticData and loader data", async () => {
		const nav = await renderAt("/items/momo");
		const links = within(nav).getAllByRole("link");
		expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
			["Home", "/"],
			["Items", "/items"],
		]);
		expect(within(nav).getByText("Item momo")).toHaveAttribute("aria-current", "page");
	});

	it("the section's index page is the current crumb (no duplicate)", async () => {
		const nav = await renderAt("/items");
		expect(
			within(nav)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Home", "Items"]);
		expect(within(nav).getByText("Items")).toHaveAttribute("aria-current", "page");
	});

	it("emits matching BreadcrumbList JSON-LD", async () => {
		const nav = await renderAt("/items/momo");
		const script = nav.querySelector('script[type="application/ld+json"]');
		const data = JSON.parse(script?.textContent ?? "{}") as { itemListElement: Array<{ name: string }> };
		expect(data.itemListElement.map((item) => item.name)).toEqual(["Home", "Items", "Item momo"]);
	});
});
