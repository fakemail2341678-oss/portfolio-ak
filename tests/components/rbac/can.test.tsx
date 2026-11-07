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
import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "@/components/admin-shell/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { sessionQueryOptions } from "@/features/auth/queries";
import { Can, useCan } from "@/features/rbac/can";
import type { Permission } from "@/features/rbac/permissions";
import type { Session } from "@/lib/session";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import type { RouterContext } from "@/router";

/** Renders `ui` for a signed-in user holding `permissions` (null: signed out). */
async function renderAs(permissions: Permission[] | null, ui: ReactNode) {
	const queryClient = new QueryClient();
	const session: Session | null =
		permissions === null
			? null
			: { user: { id: "u1", email: "u@example.com", name: "U", role: "user", twoFactorEnabled: false }, permissions };
	queryClient.setQueryData(sessionQueryOptions().queryKey, session);
	const root = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: Outlet });
	const page = createRoute({ getParentRoute: () => root, path: "/admin", component: () => <>{ui}</> });
	const router = createRouter({
		routeTree: root.addChildren([page]),
		history: createMemoryHistory({ initialEntries: ["/admin"] }),
		context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
	});
	await act(() => router.load());
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

function Probe() {
	return <output>{useCan("test-crud:read", "test-crud:delete") ? "can" : "cannot"}</output>;
}

describe("<Can> and useCan", () => {
	it("render only for users holding every listed permission", async () => {
		await renderAs(
			["test-crud:read"],
			<>
				<Can permission="test-crud:read">
					<button type="button">Read</button>
				</Can>
				<Can permission="users:ban" fallback={<span>No ban</span>}>
					<button type="button">Ban</button>
				</Can>
				<Probe />
			</>,
		);
		expect(screen.getByRole("button", { name: "Read" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Ban" })).toBeNull();
		expect(screen.getByText("No ban")).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("cannot");
	});

	it("signed out: nothing is allowed", async () => {
		await renderAs(null, <Probe />);
		expect(screen.getByRole("status")).toHaveTextContent("cannot");
	});
});

describe("<AppSidebar>", () => {
	const AdminSidebar = () => (
		<SidebarProvider>
			<AppSidebar />
		</SidebarProvider>
	);
	// Every link but the brand (to the dashboard too) at the top.
	const links = () =>
		within(screen.getByRole("navigation"))
			.getAllByRole("link")
			.slice(1)
			.map((link) => link.getAttribute("href"));

	it("an editor sees the dashboard, Test CRUD and their own appearance settings only", async () => {
		await renderAs(["test-crud:read", "test-crud:create"], <AdminSidebar />);
		expect(links()).toEqual(["/admin", "/admin/test-crud", "/admin/settings/appearance"]);
	});

	it("users:read and roles:read add Users, Roles and Permissions", async () => {
		await renderAs(["users:read", "roles:read"], <AdminSidebar />);
		expect(links()).toEqual([
			"/admin",
			"/admin/users",
			"/admin/roles",
			"/admin/roles/permissions",
			"/admin/settings/appearance",
		]);
	});
});
