// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	stripSearchParams,
	useSearch,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActiveFilters } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { BooleanFilter, MultiSelectFilter, SearchFilter, SelectFilter } from "@/components/filters/filters";
import { arrayParam, booleanParam, enumParam, pageParam, searchParam } from "@/lib/list/params";
import { parseSearch, stringifySearch } from "@/lib/list/url";

const schema = z.object({
	q: searchParam(),
	status: enumParam(["all", "draft", "published"], "all"),
	tags: arrayParam(z.string()),
	hasImage: booleanParam(),
	sort: enumParam(["title", "-title"], "title"),
	page: pageParam(),
});
const DEFAULTS = { q: "", status: "all", tags: [] as string[], sort: "title", page: 1 } as const;

/** A list route with a FilterBar, wired like the real pages. */
async function renderList(url: string) {
	const root = createRootRoute({ component: Outlet });
	const list = createRoute({
		getParentRoute: () => root,
		path: "/items",
		validateSearch: schema,
		search: { middlewares: [stripSearchParams(DEFAULTS)] },
		component: function List() {
			// Re-parsed with the route's schema: typing `list.useSearch()` inside its own definition is circular.
			const search = schema.parse(useSearch({ strict: false }));
			return (
				<>
					<FilterBar values={search} preserve={["sort"]}>
						<SearchFilter label="Search" value={search.q} />
						<SelectFilter
							name="status"
							label="Status"
							value={search.status}
							options={[
								{ value: "all", label: "All" },
								{ value: "draft", label: "Draft" },
							]}
						/>
						<MultiSelectFilter
							name="tags"
							label="Tags"
							value={search.tags}
							options={["food", "drink"].map((tag) => ({ value: tag, label: tag }))}
						/>
						<BooleanFilter name="hasImage" label="Image" value={search.hasImage} />
					</FilterBar>
					<ActiveFilters
						chips={search.tags.map((tag) => ({
							id: tag,
							label: `Tag: ${tag}`,
							remove: { tags: search.tags.filter((t) => t !== tag) },
						}))}
						clearAll={{ q: undefined, status: undefined, tags: undefined, hasImage: undefined }}
					/>
				</>
			);
		},
	});
	const router = createRouter({
		routeTree: root.addChildren([list]),
		history: createMemoryHistory({ initialEntries: [url] }),
		parseSearch,
		stringifySearch,
	});
	await act(() => router.load());
	render(<RouterProvider router={router} />);
	await screen.findByRole("searchbox", { name: "Search" });
	const href = () => router.state.location.href;
	return { router, href };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("<FilterBar>", () => {
	it("server-renders the URL's values into native controls", async () => {
		await renderList("/items?q=momo&status=draft&tags=food&hasImage=true");
		expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("momo");
		expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("draft");
		expect(screen.getByRole("checkbox", { name: "food" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "drink" })).not.toBeChecked();
		expect(screen.getByRole("combobox", { name: "Image" })).toHaveValue("true");
	});

	it("applies a select at once, keeps other params and resets the page", async () => {
		const { href } = await renderList("/items?sort=-title&page=3");
		fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "draft" } });
		await waitFor(() => expect(href()).toBe("/items?sort=-title&status=draft"));
	});

	it("checkboxes become repeated keys; unchecking removes them", async () => {
		const { href } = await renderList("/items");
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.click(screen.getByRole("checkbox", { name: "food" }));
		await waitFor(() => expect(href()).toBe("/items?tags=food"));
		await user.click(screen.getByRole("checkbox", { name: "drink" }));
		await waitFor(() => expect(href()).toBe("/items?tags=food&tags=drink"));
		await user.click(screen.getByRole("checkbox", { name: "food" }));
		await waitFor(() => expect(href()).toBe("/items?tags=drink"));
	});

	it("typing waits for a pause, then replaces the history entry", async () => {
		const { router, href } = await renderList("/items");
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		const box = screen.getByRole("searchbox", { name: "Search" });
		await user.type(box, "mo");
		expect(href()).toBe("/items");
		await act(() => vi.advanceTimersByTimeAsync(500));
		await waitFor(() => expect(href()).toBe("/items?q=mo"));
		expect(box).toHaveFocus();
		// replace: Back goes to where the user was before the list, not to "?q=m".
		expect(router.history.length).toBe(1);
	});

	it("Enter submits immediately", async () => {
		const { href } = await renderList("/items");
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.type(screen.getByRole("searchbox", { name: "Search" }), "tea{Enter}");
		await waitFor(() => expect(href()).toBe("/items?q=tea"));
	});

	it("chips are links that remove one filter; controls follow the URL", async () => {
		const { href } = await renderList("/items?tags=food&tags=drink&status=draft");
		const chip = screen.getByRole("link", { name: "Remove filter: Tag: food" });
		expect(chip).toHaveAttribute("href", "/items?status=draft&tags=drink");
		await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(chip);
		await waitFor(() => expect(href()).toBe("/items?status=draft&tags=drink"));
		expect(screen.getByRole("checkbox", { name: "food" })).not.toBeChecked();
	});

	it("'Clear all' keeps sort and resets every filter control", async () => {
		const { href } = await renderList("/items?tags=food&status=draft&sort=-title&q=x");
		await userEvent
			.setup({ advanceTimers: vi.advanceTimersByTime })
			.click(screen.getByRole("link", { name: "Clear all" }));
		await waitFor(() => expect(href()).toBe("/items?sort=-title"));
		expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
		expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
	});

	it("without JavaScript the form is a GET form carrying preserved params", async () => {
		await renderList("/items?sort=-title");
		const form = screen.getByRole("searchbox", { name: "Search" }).closest("form");
		expect(form).toHaveAttribute("method", "get");
		expect(form?.hasAttribute("action")).toBe(false);
		expect(form?.querySelector('input[type="hidden"][name="sort"]')).toHaveValue("-title");
	});
});
