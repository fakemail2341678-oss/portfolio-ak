// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sessionQueryOptions } from "@/features/auth/queries";
import { TasklineShell } from "@/features/taskline/shell/taskline-shell";
import type { TasklineNav } from "@/features/taskline/types";
import type { Session } from "@/lib/session";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";
import {
	sampleGuestNav,
	sampleTasklineGuest,
	sampleTasklineMember,
	sampleTasklineNav,
} from "../../../.storybook/mocks/taskline";

/**
 * Taskline's shell (decision 0208): its sidebar navigation, the workspace switcher
 * (only with both the team and a sandbox), the guest banner and the palette. The
 * shell takes its navigation as data, so nothing here calls the server.
 */
async function renderShell(nav: TasklineNav, session: Session, path = "/app/taskline/team/projects") {
	const page = () => (
		<TasklineShell nav={nav}>
			<main>page</main>
		</TasklineShell>
	);
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: Outlet });
	const routeTree = rootRoute.addChildren([
		createRoute({ getParentRoute: () => rootRoute, path: "/app/taskline/$ws/projects", component: page }),
		createRoute({ getParentRoute: () => rootRoute, path: "$", component: page }),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [path] }),
		context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
	});
	await act(() => router.load());
	const queryClient = new QueryClient();
	queryClient.setQueryData(sessionQueryOptions().queryKey, session);
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	await screen.findByText("page");
	return router;
}

describe("Taskline's shell", () => {
	it("links Home and the current workspace's projects, and lists starred and recent projects", async () => {
		await renderShell(sampleTasklineNav, sampleTasklineMember);
		const sidebar = screen.getByTestId("taskline-sidebar");
		expect(within(sidebar).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/app/taskline/home");
		const projects = within(sidebar).getByRole("link", { name: "Projects" });
		expect(projects).toHaveAttribute("href", "/app/taskline/team/projects");
		expect(projects).toHaveAttribute("data-active", "true");
		const starred = screen.getByTestId("nav-starred");
		expect(within(starred).getByRole("link", { name: /Website relaunch/ })).toHaveAttribute(
			"href",
			"/app/taskline/team/p/WEB",
		);
		// The two WEB projects are told apart: the sandbox's carries the sandbox's name.
		const recent = within(screen.getByTestId("nav-recent")).getAllByRole("link");
		expect(recent.map((link) => link.getAttribute("href"))).toEqual([
			"/app/taskline/team/p/APP",
			"/app/taskline/team/p/WEB",
			"/app/taskline/sandbox/p/WEB",
		]);
		expect(recent[2]).toHaveTextContent("Your sandbox");
		// Nothing of the other sections' chrome.
		expect(screen.queryByTestId("app-switcher")).toBeNull();
		expect(screen.queryByTestId("admin-sidebar")).toBeNull();
	});

	it("shows the workspace switcher only to someone with both the team and a sandbox", async () => {
		await renderShell(sampleTasklineNav, sampleTasklineMember);
		const switcher = screen.getByTestId("workspace-switcher");
		expect(switcher).toHaveTextContent("Himal Studio");
		act(() => {
			fireEvent.pointerDown(switcher, { button: 0, ctrlKey: false, pointerType: "mouse" });
		});
		const menu = await screen.findByRole("menu");
		expect(within(menu).getByRole("menuitem", { name: /Sandbox/ })).toHaveAttribute(
			"href",
			"/app/taskline/sandbox/projects",
		);
	});

	it("has no switcher and shows the guest banner for a guest", async () => {
		await renderShell(sampleGuestNav, sampleTasklineGuest, "/app/taskline/sandbox/projects");
		expect(screen.queryByTestId("workspace-switcher")).toBeNull();
		const banner = screen.getByTestId("guest-banner");
		expect(banner).toHaveTextContent("deleted after 7 days");
		expect(within(banner).getByRole("link", { name: "Sign up to keep it" })).toHaveAttribute(
			"href",
			expect.stringMatching(/^\/app\/taskline\/sign-up\?redirect=/),
		);
	});

	it("shows no guest banner to an account", async () => {
		await renderShell(sampleTasklineNav, sampleTasklineMember);
		expect(screen.queryByTestId("guest-banner")).toBeNull();
	});

	it("opens the palette with Ctrl K, listing every project and a new project per workspace", async () => {
		await renderShell(sampleTasklineNav, sampleTasklineMember);
		act(() => {
			fireEvent.keyDown(document, { key: "k", ctrlKey: true });
		});
		const dialog = await screen.findByRole("dialog", { name: "Command palette" });
		expect(within(dialog).getByText("Operations")).toBeInTheDocument();
		expect(within(dialog).getByText("New project in Himal Studio")).toBeInTheDocument();
		expect(within(dialog).getByText("New project in Sandbox")).toBeInTheDocument();
	});

	it("opens the shortcuts with ?", async () => {
		await renderShell(sampleTasklineNav, sampleTasklineMember);
		act(() => {
			fireEvent.keyDown(document, { key: "?", shiftKey: true });
		});
		expect(await screen.findByTestId("shortcuts-dialog")).toHaveTextContent("Open the command palette");
	});
});
