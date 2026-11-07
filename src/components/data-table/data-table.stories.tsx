import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSearch } from "@tanstack/react-router";
import { expect, fn, waitFor, within } from "storybook/test";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { DataTable, type DataTableColumn } from "./data-table";
import { DataTableSkeleton } from "./data-table-skeleton";

type Person = { id: string; name: string; city: string; age: number };

const people: Person[] = [
	{ id: "1", name: "Sita", city: "Kathmandu", age: 31 },
	{ id: "2", name: "Ram", city: "Pokhara", age: 27 },
	{ id: "3", name: "Gita", city: "Lalitpur", age: 45 },
];

const columns: ReadonlyArray<DataTableColumn<Person>> = [
	{ id: "name", header: () => "Name", sort: "name", cell: (row) => row.name, csv: (row) => row.name },
	{ id: "city", header: () => "City", hideable: true, cell: (row) => row.city, csv: (row) => row.city },
	{
		id: "age",
		header: () => "Age",
		sort: "age",
		hideable: true,
		cellClassName: "tabular-nums",
		cell: (row) => row.age,
		csv: (row) => row.age,
	},
];

const many: Person[] = Array.from({ length: 24 }, (_, index) => ({
	id: String(index + 1),
	name: `Person ${index + 1}`,
	city: ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar"][index % 4] ?? "",
	age: 20 + ((index * 7) % 40),
}));

const onBulkDelete = fn();
const onEdit = fn();
const onPromote = fn();

/** Reads `?sort=` from the story router's URL, like a real route's validateSearch would. */
function PeopleTable({ rows = people }: { rows?: Person[] }) {
	const { sort } = useSearch({ strict: false });
	return (
		<div className="flex flex-col gap-3">
			<DataTable
				tableId="story-people"
				rows={rows}
				columns={columns}
				getRowId={(row) => row.id}
				getRowLabel={(row) => row.name}
				sort={typeof sort === "string" ? sort : undefined}
				bulkActions={({ ids, clear }) => (
					<Button
						variant="destructive"
						size="sm"
						onClick={() => {
							onBulkDelete(ids);
							clear();
						}}
					>
						Delete selected
					</Button>
				)}
				rowActions={(row) => [
					{ id: "edit", label: "Edit", onSelect: () => onEdit(row.id) },
					// Needs a permission the story's visitor doesn't hold: never offered.
					{ id: "promote", label: "Make admin", permission: "users:update", onSelect: () => onPromote(row.id) },
					{ id: "delete", label: "Delete", destructive: true, separated: true, onSelect: () => onBulkDelete([row.id]) },
				]}
				exportName="people"
				savedViews
				empty={<EmptyState variant="no-matches" description="No people match." data-testid="empty" />}
			/>
		</div>
	);
}

const meta = {
	title: "Data/DataTable",
	component: PeopleTable,
	parameters: { app: { route: "/admin/people" } },
} satisfies Meta<typeof PeopleTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Select all -> the bulk bar acts on exactly the selected ids, then clears. */
export const Selection: Story = {
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("checkbox", { name: m.table_select_all() }));
		await expect(canvas.getByTestId("bulk-bar")).toHaveTextContent(m.table_selected({ count: formatNumber(3) }));
		await userEvent.click(canvas.getByRole("checkbox", { name: m.table_select_row({ label: "Ram" }) }));
		await userEvent.click(canvas.getByRole("button", { name: "Delete selected" }));
		await expect(onBulkDelete).toHaveBeenCalledWith(["1", "3"]);
		await expect(canvas.queryByTestId("bulk-bar")).toBeNull();
	},
};

/** Sorting is a link that changes ?sort= (ascending first, then descending). */
export const Sorting: Story = {
	play: async ({ canvas, userEvent }) => {
		const header = () => canvas.getByRole("columnheader", { name: /Name/ });
		await expect(header()).toHaveAttribute("aria-sort", "none");
		await userEvent.click(canvas.getByRole("link", { name: /Name/ }));
		await waitFor(() => expect(header()).toHaveAttribute("aria-sort", "ascending"));
		await userEvent.click(canvas.getByRole("link", { name: /Name/ }));
		await waitFor(() => expect(header()).toHaveAttribute("aria-sort", "descending"));
	},
};

/** The "…" menu lists the actions this user may run: "Make admin" needs users:update, so it isn't there. */
export const RowActions: Story = {
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.table_row_actions({ label: "Gita" }) }));
		const menu = within(canvasElement.ownerDocument.body);
		await expect(menu.queryByRole("menuitem", { name: "Make admin" })).toBeNull();
		await userEvent.click(await menu.findByRole("menuitem", { name: "Edit" }));
		await expect(onEdit).toHaveBeenCalledWith("3");
	},
};

/** Right-clicking a row opens the same actions. */
export const ContextMenu: Story = {
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.pointer({ keys: "[MouseRight]", target: canvas.getByRole("cell", { name: "Sita" }) });
		const menu = within(canvasElement.ownerDocument.body);
		await userEvent.click(await menu.findByRole("menuitem", { name: "Edit" }));
		await expect(onEdit).toHaveBeenCalledWith("1");
	},
};

/** The toolbar's Columns menu hides a column (saved per table in the preferences cookie). */
export const ColumnsMenu: Story = {
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.table_columns() }));
		const menu = within(canvasElement.ownerDocument.body);
		await userEvent.click(await menu.findByRole("menuitemcheckbox", { name: "City" }));
		await waitFor(() => expect(canvas.queryByRole("columnheader", { name: "City" })).toBeNull());
		await userEvent.keyboard("{Escape}");
	},
};

/** Saved views: the current search string under a name, kept in this browser. */
export const SavedViews: Story = {
	parameters: { app: { route: "/admin/people?sort=-age" } },
	play: async ({ canvas, userEvent, canvasElement }) => {
		window.localStorage.removeItem("views:story-people");
		await userEvent.click(canvas.getByTestId("saved-views"));
		const popover = within(canvasElement.ownerDocument.body);
		await userEvent.type(await popover.findByLabelText(m.table_view_name()), "Oldest first");
		await userEvent.click(popover.getByRole("button", { name: m.table_view_save() }));
		await expect(await popover.findByRole("button", { name: "Oldest first" })).toHaveAttribute("aria-current", "true");
		await userEvent.keyboard("{Escape}");
		window.localStorage.removeItem("views:story-people");
	},
};

/** Long pages scroll inside the frame under a sticky header; phones keep the first column pinned. */
export const LongPage: Story = { args: { rows: many } };

/** Hidden columns come from the saved table preferences (server-rendered the same way). */
export const HiddenColumn: Story = {
	parameters: {
		app: { route: "/admin/people", preferences: { tables: { "story-people": { hiddenColumns: ["city"] } } } },
	},
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("columnheader", { name: "City" })).toBeNull();
	},
};

export const Empty: Story = { args: { rows: [] } };

export const Loading: Story = { render: () => <DataTableSkeleton columns={4} rows={5} /> };

export const PaginationAdmin: Story = {
	parameters: { app: { route: "/admin/people?page=2" } },
	render: () => (
		<Pagination
			page={2}
			pageCount={5}
			total={93}
			pageSize={{ value: 20, options: [10, 20, 50, 100], onChange: fn() }}
		/>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: m.pagination_previous() })).toHaveAttribute("rel", "prev");
		await expect(canvas.getByRole("link", { name: m.pagination_next() })).toHaveAttribute(
			"href",
			expect.stringMatching(/\/admin\/people\?page=3$/),
		);
	},
};

/** First page: "Previous" is plain text, not a dead link. */
export const PaginationPublicFirstPage: Story = {
	render: () => <Pagination page={1} pageCount={3} layout="center" hideWhenSingle />,
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("link", { name: m.pagination_previous() })).toBeNull();
		await expect(canvas.getByText(m.pagination_previous())).toHaveAttribute("aria-disabled", "true");
	},
};
