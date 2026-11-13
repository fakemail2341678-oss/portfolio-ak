import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { importKharchaSpend, reorderKharchaSearches } from "../../../../.storybook/mocks/functions/kharcha/spend";
import { sampleKharchaMe, sampleKharchaSession, sampleKharchaSpend } from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import type { SpendSearch } from "../search";
import { KharchaShell } from "../shell/kharcha-shell";
import { KharchaImportPage } from "./import-page";
import SavedSearchDialogs from "./saved-dialogs";
import { SpendView } from "./spend-page";

/** Task 93's screens: Spend's search (chips, suggestions, saved searches), its table and chart, saving and ordering searches, the import. */
function Screen({ children }: { children: React.ReactNode }) {
	return <KharchaShell>{children}</KharchaShell>;
}

const meta = {
	title: "Kharcha/Spend",
	component: Screen,
	decorators: [withKharcha],
	args: { children: null },
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/spend" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof Screen>;
export default meta;
type Story = StoryObj<typeof meta>;

const userId = sampleKharchaSession.user.id;
const search = (patch: Partial<SpendSearch> = {}): SpendSearch => ({
	q: "",
	view: "list",
	groupBy: "category",
	chart: "bar",
	sort: "-date",
	page: 1,
	...patch,
});

/** A search in the language: a chip per term (one it can't read marked and named), the controls showing the same, saved searches beside. */
export const Search: Story = {
	args: { children: <SpendView search={search({ q: "category:Groceries amount>abc date:this-month" })} /> },
	play: async ({ canvas }) => {
		const chips = await canvas.findByTestId("kharcha-spend-chips");
		await expect(
			within(chips).getAllByRole("link", { name: /category:Groceries|amount>abc|date:this-month/ }),
		).toHaveLength(3);
		await expect(canvas.getByTestId("kharcha-spend-ignored")).toHaveTextContent("amount>abc");
		await expect(canvas.getByRole("heading", { level: 1, name: m.kharcha_nav_spend() })).toBeVisible();
		const saved = canvas.getByTestId("kharcha-saved-column");
		await expect(within(saved).getByRole("link", { name: m.kharcha_search_this_month() })).toBeVisible();
		await expect(within(saved).getByRole("link", { name: "Trip food" })).toBeVisible();
	},
};

/** Suggestions while typing: the fields, then a field's values; Enter takes the one marked. */
export const Suggestions: Story = {
	args: { children: <SpendView search={search()} /> },
	play: async ({ canvas, userEvent }) => {
		const box = await canvas.findByTestId("kharcha-spend-q");
		await userEvent.click(box);
		await userEvent.type(box, "cat");
		await waitFor(() => expect(box).toHaveAttribute("aria-expanded", "true"));
		await expect(canvas.getAllByTestId("kharcha-spend-suggestion")[0]).toHaveTextContent("category:");
		await userEvent.keyboard("{Enter}");
		await expect(box).toHaveValue("category:");
		await userEvent.keyboard("{Escape}");
		await expect(box).toHaveAttribute("aria-expanded", "false");
	},
};

/** The table: the Columns menu, and the selection's bulk actions. */
export const Table: Story = {
	args: { children: <SpendView search={search({ view: "table" })} /> },
	play: async ({ canvas, userEvent }) => {
		const table = await canvas.findByTestId("kharcha-spend-table", {}, { timeout: 5000 });
		const [first] = await within(table).findAllByRole("checkbox", { name: /Weekly groceries/ });
		if (first) await userEvent.click(first);
		await expect(await canvas.findByTestId("kharcha-bulk-category")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-bulk-delete")).toBeVisible();
	},
};

/** The chart: the search's spending by category, its numbers as a table for screen readers too. */
export const Chart: Story = {
	args: { children: <SpendView search={search({ view: "chart", q: "date:this-month" })} /> },
	play: async ({ canvas }) => {
		const chart = await canvas.findByTestId("kharcha-spend-chart", {}, { timeout: 5000 });
		await expect(within(chart).getByRole("table", { hidden: true })).toBeInTheDocument();
		await expect(within(chart).getAllByRole("rowheader", { hidden: true })).toHaveLength(5);
	},
};

/** The donut: the five largest slices named beside their colours. */
export const Donut: Story = {
	args: { children: <SpendView search={search({ view: "chart", chart: "donut" })} /> },
	play: async ({ canvas }) => {
		const chart = await canvas.findByTestId("kharcha-spend-chart", {}, { timeout: 5000 });
		// The legend beside the donut (the screen readers' table names it too); the refund isn't a slice.
		const legend = within(chart).getByRole("list");
		await expect(within(legend).getAllByRole("listitem")).toHaveLength(4);
		await expect(within(legend).getByText(m.kharcha_category_none())).toBeVisible();
	},
};

/** Saving the search on screen under a name. */
export const SaveSearch: Story = {
	args: {
		children: (
			<SavedSearchDialogs
				userId={userId}
				dialog="save"
				query="tag:trip is:unsettled"
				searches={sampleKharchaMe.searches}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-save-search-dialog");
		await expect(within(dialog).getByRole("textbox", { name: m.kharcha_field_name() })).toHaveValue(
			"tag:trip is:unsettled",
		);
	},
};

/** The caller's searches: renamed in place, moved with the buttons or Alt and an arrow, deleted. */
export const ManageSearches: Story = {
	args: {
		children: (
			<SavedSearchDialogs
				userId={userId}
				dialog="manage"
				query=""
				searches={sampleKharchaMe.searches}
				onClose={() => undefined}
			/>
		),
	},
	play: async ({ canvasElement, userEvent }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByTestId("kharcha-manage-searches");
		const rows = within(dialog).getAllByTestId("kharcha-saved-search");
		await expect(rows).toHaveLength(sampleKharchaMe.searches.length);
		const [first] = rows;
		if (first) {
			first.focus();
			await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		}
		await waitFor(() =>
			expect(reorderKharchaSearches).toHaveBeenCalledWith({ data: { ids: ["s-big", "s-trip-food"] } }),
		);
	},
};

/** The import: pasted CSV, its columns guessed from the headers, a line with a problem left out. */
export const Import: Story = {
	parameters: { app: { session: sampleKharchaSession, route: "/app/kharcha/import" } },
	args: { children: <KharchaImportPage /> },
	play: async ({ canvas, userEvent }) => {
		const text = await canvas.findByRole("textbox", { name: m.csv_paste() });
		await userEvent.click(text);
		await userEvent.paste(
			"Date,Amount,Merchant,Category,Tags\n2026-11-01,450,Himalayan Java,Coffee,work\nlater,12,Shop,,\n",
		);
		await userEvent.click(canvas.getByRole("button", { name: m.csv_paste_read() }));
		const summary = await canvas.findByTestId("kharcha-import-summary");
		await expect(summary).toHaveTextContent(m.kharcha_import_valid({ count: formatNumber(1) }));
		await expect(summary).toHaveTextContent(m.kharcha_import_invalid({ count: formatNumber(1) }));
		await userEvent.click(canvas.getByTestId("kharcha-import-submit"));
		await waitFor(() => expect(importKharchaSpend).toHaveBeenCalled());
	},
};

/** The list on a phone: the saved searches as a row above the results. */
export const Phone: Story = {
	args: { children: <SpendView search={search({ q: "date:this-month" })} /> },
	globals: { viewport: { value: "mobile1" } },
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(canvas.getAllByTestId("kharcha-spend-row")).toHaveLength(sampleKharchaSpend.items.length),
		);
		const row = canvas.getByTestId("kharcha-saved-row");
		await expect(within(row).getByRole("link", { name: m.kharcha_search_this_month() })).toHaveAttribute(
			"aria-current",
			"page",
		);
	},
};
