// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingPage, SectionPending } from "@/components/errors/pending-page";
import { NavigationProgress } from "@/components/layout/navigation-progress";

/** A root with the line and two pages; /slow waits for `release` before its loader finishes. */
async function renderApp(slow: Promise<void>) {
	const root = createRootRoute({
		component: () => (
			<>
				<NavigationProgress />
				<Outlet />
			</>
		),
	});
	const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <p>home</p> });
	const slowPage = createRoute({
		getParentRoute: () => root,
		path: "/slow",
		loader: () => slow,
		component: () => <p>slow page</p>,
	});
	const router = createRouter({
		routeTree: root.addChildren([home, slowPage]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	await act(() => router.load());
	render(<RouterProvider router={router} />);
	await screen.findByText("home");
	return router;
}

describe("<NavigationProgress>", () => {
	it("shows the line while a navigation loads, fills it, then removes it", async () => {
		let release = () => {};
		const slow = new Promise<void>((done) => {
			release = done;
		});
		const router = await renderApp(slow);
		expect(screen.queryByTestId("navigation-progress")).toBeNull();

		// Started inside act, not awaited by it: the loader is still waiting for release().
		let navigation: Promise<void> = Promise.resolve();
		await act(async () => {
			navigation = router.navigate({ href: "/slow" });
		});
		// Not at once: a quick load never shows it.
		expect(screen.queryByTestId("navigation-progress")).toBeNull();
		const line = await screen.findByTestId("navigation-progress");
		expect(line.dataset.phase).toBe("loading");
		expect(line.getAttribute("aria-hidden")).toBe("true");

		await act(async () => {
			release();
			await navigation;
		});
		await screen.findByText("slow page");
		await waitFor(() => expect(screen.queryByTestId("navigation-progress")).toBeNull());
	});
});

describe("<PendingPage>", () => {
	it("is its own main landmark by default", () => {
		render(<PendingPage />);
		expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("status").textContent).toBe("Loading…");
	});

	it("adds no landmark inside a layout's main, and shows a section's own view", () => {
		const { unmount } = render(
			<SectionPending insideMain>
				<PendingPage />
			</SectionPending>,
		);
		expect(screen.queryByRole("main")).toBeNull();
		expect(screen.getByRole("status").textContent).toBe("Loading…");
		unmount();
		render(
			<SectionPending component={() => <p>printing</p>}>
				<PendingPage />
			</SectionPending>,
		);
		expect(screen.getByText("printing")).toBeTruthy();
	});
});
