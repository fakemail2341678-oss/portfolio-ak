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
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/components/admin-shell/admin-shell";
import { preferenceHtmlProps, ThemeSync, ThemeToggle } from "@/components/layout/theme";
import { AppearanceSettings } from "@/features/admin/components/appearance-settings";
import { sessionQueryOptions } from "@/features/auth/queries";
import { ALL_PERMISSIONS } from "@/features/rbac/permissions";
import type { Session } from "@/lib/session";
import { useTablePreferences, useTheme } from "@/lib/stores/hooks";
import { createPreferencesStore, DEFAULT_PREFERENCES, type Preferences } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";

/** Renders `ui` inside a memory router whose context carries a preferences store. */
async function renderWithPreferences(ui: ReactNode, initial: Partial<Preferences> = {}) {
	const preferences = createPreferencesStore({ ...DEFAULT_PREFERENCES, ...initial });
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: Outlet });
	const page = () => <>{ui}</>;
	const routeTree = rootRoute.addChildren([
		createRoute({ getParentRoute: () => rootRoute, path: "/", component: page }),
		createRoute({ getParentRoute: () => rootRoute, path: "/admin", component: page }),
	]);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/admin"] }),
		context: { preferences },
	});
	await act(() => router.load());
	// The sidebar shows sections by permission, read from the session query.
	const queryClient = new QueryClient();
	const session: Session = {
		user: { id: "a", email: "a@example.com", name: "A", role: "admin", twoFactorEnabled: false },
		permissions: [...ALL_PERMISSIONS],
	};
	queryClient.setQueryData(sessionQueryOptions().queryKey, session);
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return { preferences, user: userEvent.setup() };
}

/** ThemeSync as the root uses it outside a branded section: fed the preference. */
function SyncedTheme() {
	const { theme } = useTheme();
	return <ThemeSync theme={theme} />;
}

// jsdom has no matchMedia; ThemeSync listens to the OS colour scheme.
let osDark = false;
const listeners = new Set<() => void>();
beforeEach(() => {
	osDark = false;
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({
			get matches() {
				return osDark;
			},
			addEventListener: (_: string, listener: () => void) => listeners.add(listener),
			removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
		})),
	);
});
afterEach(() => {
	vi.unstubAllGlobals();
	listeners.clear();
	document.documentElement.className = "";
	for (const name of ["theme", "accent", "radius", "density", "sidebar", "table-prefs"]) {
		// biome-ignore lint/suspicious/noDocumentCookie: test cleanup of the cookies the store writes.
		document.cookie = `${name}=; Path=/; Max-Age=0`;
	}
});

describe("ThemeToggle + ThemeSync", () => {
	it("offers light/dark/system, applies the choice to <html> and persists it", async () => {
		const { user, preferences } = await renderWithPreferences(
			<>
				<ThemeToggle />
				<SyncedTheme />
			</>,
		);
		const trigger = await screen.findByRole("button", { name: "Theme: System" });
		await user.click(trigger);
		expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Light", "Dark", "System"]);
		expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "true");
		await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
		expect(preferences.state.theme).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");
		expect(document.cookie).toContain("theme=dark");
		expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeInTheDocument();
	});

	it("follows the OS setting while on system", async () => {
		osDark = true;
		await renderWithPreferences(<SyncedTheme />);
		expect(document.documentElement).toHaveClass("dark");
		osDark = false;
		act(() => {
			for (const listener of listeners) listener();
		});
		expect(document.documentElement).not.toHaveClass("dark");
	});

	it("applies the theme it's given, not the OS's, once a section has resolved system", async () => {
		await renderWithPreferences(<ThemeSync theme="dark" />);
		expect(document.documentElement).toHaveClass("dark");
		expect(listeners.size).toBe(0);
	});
});

describe("AdminShell sidebar", () => {
	it("collapses and expands, announcing state, and remembers it", async () => {
		const { user, preferences } = await renderWithPreferences(<AdminShell>page</AdminShell>);
		const toggle = await screen.findByRole("button", { name: "Collapse sidebar" });
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("data-active", "true");

		await user.click(toggle);
		expect(preferences.state.sidebarCollapsed).toBe(true);
		expect(document.cookie).toContain("sidebar=collapsed");
		expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByTestId("admin-sidebar").closest("[data-state]")).toHaveAttribute("data-state", "collapsed");
	});

	it("renders collapsed when the stored preference says so", async () => {
		await renderWithPreferences(<AdminShell>page</AdminShell>, { sidebarCollapsed: true });
		await screen.findByText("page");
		expect(screen.getByTestId("admin-sidebar").closest("[data-state]")).toHaveAttribute("data-state", "collapsed");
	});
});

describe("Graphite presets", () => {
	it("are attributes of <html>, from the preferences", () => {
		expect(preferenceHtmlProps({ theme: "dark", accent: "rose", radius: "round", density: "compact" })).toEqual({
			className: "dark",
			"data-theme": "dark",
			"data-accent": "rose",
			"data-radius": "round",
			"data-density": "compact",
		});
	});

	it("the appearance page changes each one and keeps it in a cookie", async () => {
		const { user, preferences } = await renderWithPreferences(<AppearanceSettings />);
		const violet = await screen.findByRole("radio", { name: "Violet" });
		expect(screen.getByRole("radio", { name: "Indigo" })).toBeChecked();
		await user.click(violet);
		await user.click(screen.getByRole("radio", { name: "Round" }));
		await user.click(screen.getByRole("radio", { name: "Compact" }));
		await user.click(screen.getByRole("radio", { name: "Dark" }));
		expect(preferences.state).toMatchObject({ accent: "violet", radius: "round", density: "compact", theme: "dark" });
		expect(violet).toBeChecked();
		for (const cookie of ["accent=violet", "radius=round", "density=compact", "theme=dark"]) {
			expect(document.cookie).toContain(cookie);
		}
	});
});

function TablePrefsProbe() {
	const table = useTablePreferences("test-crud", { pageSize: 20 });
	return (
		<div>
			<output data-testid="size">{table.pageSize}</output>
			<output data-testid="price">{String(table.isColumnVisible("price"))}</output>
			<button type="button" onClick={() => table.setPageSize(50)}>
				size
			</button>
			<button type="button" onClick={() => table.setColumnVisible("price", false)}>
				hide
			</button>
		</div>
	);
}

describe("useTablePreferences", () => {
	it("uses defaults until changed, then persists page size and hidden columns", async () => {
		const { user } = await renderWithPreferences(<TablePrefsProbe />);
		expect(await screen.findByTestId("size")).toHaveTextContent("20");
		expect(screen.getByTestId("price")).toHaveTextContent("true");
		await user.click(screen.getByRole("button", { name: "size" }));
		await user.click(screen.getByRole("button", { name: "hide" }));
		expect(screen.getByTestId("size")).toHaveTextContent("50");
		expect(screen.getByTestId("price")).toHaveTextContent("false");
		expect(decodeURIComponent(document.cookie)).toContain('"test-crud":{"pageSize":50,"hiddenColumns":["price"]}');
	});

	it("starts from stored preferences", async () => {
		await renderWithPreferences(<TablePrefsProbe />, { tables: { "test-crud": { pageSize: 100 } } });
		expect(await screen.findByTestId("size")).toHaveTextContent("100");
	});
});
