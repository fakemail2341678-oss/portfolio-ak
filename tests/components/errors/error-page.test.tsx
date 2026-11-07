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
import { ErrorPage } from "@/components/errors/error-page";
import { AppError, type AppErrorCode } from "@/lib/errors";

/** A page whose beforeLoad throws `code`, rendered through ErrorPage as the router does. */
async function renderError(code: AppErrorCode) {
	const root = createRootRoute({ component: Outlet });
	const page = createRoute({
		getParentRoute: () => root,
		path: "/admin/things",
		beforeLoad: () => {
			throw new AppError(code);
		},
		errorComponent: ErrorPage,
	});
	const home = createRoute({ getParentRoute: () => root, path: "/" });
	const login = createRoute({ getParentRoute: () => root, path: "/login" });
	const router = createRouter({
		routeTree: root.addChildren([page, home, login]),
		history: createMemoryHistory({ initialEntries: ["/admin/things?page=2"] }),
	});
	await act(() => router.load());
	render(<RouterProvider router={router} />);
	return screen.findByTestId("error-page");
}

describe("<ErrorPage>", () => {
	it("FORBIDDEN: the access-denied page, with go back instead of retry", async () => {
		const page = await renderError("FORBIDDEN");
		expect(within(page).getByRole("heading").textContent).toBe("Access denied");
		expect(within(page).getByRole("alert").dataset.errorCode).toBe("FORBIDDEN");
		expect(within(page).getByRole("button", { name: "Go back" })).toBeTruthy();
		expect(within(page).queryByRole("button", { name: "Try again" })).toBeNull();
	});

	it("UNAUTHORIZED: a log-in link that returns to this page", async () => {
		const page = await renderError("UNAUTHORIZED");
		const link = within(page).getByRole("link", { name: "Log in" });
		const href = new URL(link.getAttribute("href") ?? "", "http://localhost");
		expect(href.pathname).toBe("/login");
		expect(href.searchParams.get("redirect")).toBe("/admin/things?page=2");
	});

	it("other errors: the generic page with try again", async () => {
		const page = await renderError("INTERNAL");
		expect(within(page).getByRole("heading").textContent).toBe("Something went wrong");
		expect(within(page).getByRole("button", { name: "Try again" })).toBeTruthy();
	});
});
