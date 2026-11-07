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
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { EditItemLink } from "@/features/test-crud/components/masked-links";
import { parseParams } from "@/lib/list/params";

const ID = "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001";
const CLOSE = { edit: undefined };

function Overlay() {
	const close = useCloseOverlay(CLOSE);
	return (
		<div role="dialog" aria-label="Edit">
			<button type="button" onClick={close}>
				Close
			</button>
		</div>
	);
}

/**
 * The app's shape: /admin/test-crud (list, `?edit=` opens the dialog) and
 * /admin/test-crud/$id (full page, UUIDs only). EditItemLink is the real one.
 */
function createApp(url: string) {
	const root = createRootRoute({ component: Outlet });
	const section = createRoute({ getParentRoute: () => root, path: "/admin/test-crud", component: Outlet });
	const list = createRoute({
		getParentRoute: () => section,
		path: "/",
		validateSearch: z.object({ edit: z.uuid().optional().catch(undefined) }),
		component: function List() {
			const { edit } = list.useSearch();
			return (
				<main>
					<h1>List</h1>
					<EditItemLink id={ID}>Quick edit</EditItemLink>
					{edit ? <Overlay /> : null}
				</main>
			);
		},
	});
	const detail = createRoute({
		getParentRoute: () => section,
		path: "$id",
		params: { parse: (raw) => parseParams(z.object({ id: z.uuid() }), raw) },
		component: () => <h1>Full edit page</h1>,
	});
	const notFound = () => <h1>Not found</h1>;
	const history = createMemoryHistory({ initialEntries: [url] });
	const router = createRouter({
		routeTree: root.addChildren([section.addChildren([list, detail])]),
		history,
		defaultNotFoundComponent: notFound,
	});
	return { router, history };
}

async function renderApp(url: string) {
	const app = createApp(url);
	await act(() => app.router.load());
	render(<RouterProvider router={app.router} />);
	return app;
}

describe("route masking: edit dialog over the list", () => {
	it("the link's href is the masked URL (new tab, no JS, crawlers get the full page)", async () => {
		await renderApp("/admin/test-crud");
		expect(screen.getByRole("link", { name: "Quick edit" })).toHaveAttribute("href", `/admin/test-crud/${ID}`);
	});

	it("click: the list stays with a dialog; the address bar shows the item URL", async () => {
		const { router, history } = await renderApp("/admin/test-crud");
		await userEvent.click(screen.getByRole("link", { name: "Quick edit" }));
		expect(await screen.findByRole("dialog", { name: "Edit" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "List" })).toBeInTheDocument();
		// Real location: the list with ?edit=; what the user sees: the masked URL.
		expect(router.state.location.pathname).toBe("/admin/test-crud");
		expect(router.state.location.search).toEqual({ edit: ID });
		expect(history.location.pathname).toBe(`/admin/test-crud/${ID}`);
	});

	it("closing goes back (no dialog, list URL); forward reopens it", async () => {
		const { router, history } = await renderApp("/admin/test-crud");
		await userEvent.click(screen.getByRole("link", { name: "Quick edit" }));
		await userEvent.click(await screen.findByRole("button", { name: "Close" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(history.location.pathname).toBe("/admin/test-crud");
		act(() => router.history.forward());
		expect(await screen.findByRole("dialog", { name: "Edit" })).toBeInTheDocument();
	});

	it("a fresh load of the masked URL (reload, shared link) opens the full page", async () => {
		await renderApp(`/admin/test-crud/${ID}`);
		expect(screen.getByRole("heading", { name: "Full edit page" })).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("params.parse: a non-UUID id doesn't match the route (404)", async () => {
		await renderApp("/admin/test-crud/not-a-uuid");
		expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
	});
});
