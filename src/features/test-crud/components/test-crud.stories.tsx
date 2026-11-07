import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSearch } from "@tanstack/react-router";
import { expect, waitFor, within } from "storybook/test";
import { DataTable } from "@/components/data-table";
import { createTestCrud } from "@/functions/test-crud";
import { m } from "@/paraglide/messages";
import { sampleDetail, sampleItems, samplePublicCard } from "../../../../.storybook/mocks/data";
import { testCrudColumns } from "../columns";
import { TEST_CRUD_TABLE_ID } from "../schema";
import { TestCrudEditDialog } from "./edit-dialog";
import { PublicCard, PublicCardSkeleton } from "./public-card";
import { TestCrudQuickView } from "./quick-view";
import { TestCrudForm } from "./test-crud-form";

const meta = { title: "Test CRUD", component: TestCrudForm } satisfies Meta<typeof TestCrudForm>;
export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Public card
// ---------------------------------------------------------------------------

export const Card: Story = {
	render: () => (
		<ul className="grid max-w-3xl gap-6 sm:grid-cols-2">
			<li className="flex">
				<PublicCard item={samplePublicCard} />
			</li>
			<li className="flex">
				<PublicCard item={{ ...samplePublicCard, slug: "no-image", title: "Dhaka Topi", image: null, tags: [] }} />
			</li>
		</ul>
	),
};

/** With the "Quick view" button (a masked link: its href is the item's own page). */
export const CardWithQuickView: Story = {
	parameters: { app: { route: "/dev/test-crud" } },
	render: () => (
		<div className="max-w-sm">
			<PublicCard item={samplePublicCard} quickView />
		</div>
	),
	play: async ({ canvas }) => {
		const link = canvas.getByRole("link", { name: m.test_crud_quick_view_of({ title: samplePublicCard.title }) });
		await expect(link.getAttribute("href")?.endsWith(`/dev/test-crud/${samplePublicCard.slug}`)).toBe(true);
	},
};

/** The quick-view dialog over the grid (?view=<slug>). */
export const QuickView: Story = {
	parameters: { app: { route: `/dev/test-crud?view=${samplePublicCard.slug}` } },
	render: () => <TestCrudQuickView slug={samplePublicCard.slug} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(await dialog.findByRole("heading", { name: samplePublicCard.title })).toBeVisible();
		await expect(dialog.getByRole("link", { name: m.test_crud_open_full_page() })).toBeVisible();
	},
};

export const CardSkeleton: Story = {
	render: () => (
		<div className="max-w-sm">
			<PublicCardSkeleton />
		</div>
	),
};

// ---------------------------------------------------------------------------
// Admin table
// ---------------------------------------------------------------------------

/** The admin list's real columns in the shared DataTable; sort comes from the URL like on the page. */
function TableDemo() {
	const { sort } = useSearch({ strict: false });
	return (
		<DataTable
			tableId={TEST_CRUD_TABLE_ID}
			rows={sampleItems}
			columns={testCrudColumns}
			getRowId={(row) => row.id}
			getRowLabel={(row) => row.title}
			sort={typeof sort === "string" ? sort : "-updated"}
			bulkActions={() => null}
		/>
	);
}

export const Table: Story = {
	parameters: { app: { route: "/admin/test-crud" } },
	render: () => <TableDemo />,
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("checkbox", { name: m.table_select_all() }));
		for (const item of sampleItems) {
			await expect(canvas.getByRole("checkbox", { name: m.table_select_row({ label: item.title }) })).toBeChecked();
		}
		await userEvent.click(canvas.getByRole("link", { name: m.test_crud_col_title() }));
		await waitFor(() =>
			expect(canvas.getByRole("columnheader", { name: new RegExp(m.test_crud_col_title()) })).toHaveAttribute(
				"aria-sort",
				"ascending",
			),
		);
	},
};

/** Only the status column left visible (saved preference). */
export const TableWithHiddenColumns: Story = {
	parameters: {
		app: {
			route: "/admin/test-crud",
			preferences: { tables: { [TEST_CRUD_TABLE_ID]: { hiddenColumns: ["image", "price", "tags", "updated"] } } },
		},
	},
	render: () => <TableDemo />,
};

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

/** The admin edit form in a dialog over the list (?edit=<id>, shown as /admin/test-crud/<id>). */
export const EditDialog: Story = {
	parameters: { app: { route: `/admin/test-crud?edit=${sampleDetail.id}` } },
	render: () => <TestCrudEditDialog id={sampleDetail.id} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(await dialog.findByRole("textbox", { name: m.test_crud_field_title() })).toHaveValue(
			sampleDetail.title,
		);
		await expect(dialog.getByRole("button", { name: m.common_cancel() })).toBeVisible();
	},
};

export const NewItem: Story = { parameters: { app: { route: "/admin/test-crud/new" } } };

export const EditItem: Story = {
	args: { item: sampleDetail },
	parameters: { app: { route: `/admin/test-crud/${sampleDetail.id}` } },
};

/** Empty submit: every required field reports, the summary takes focus, nothing is saved. */
export const NewItemValidation: Story = {
	parameters: { app: { route: "/admin/test-crud/new" } },
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.crud_create() }));
		const summary = await canvas.findByTestId("form-error-summary");
		await expect(summary).toHaveFocus();
		await expect(canvas.getByRole("textbox", { name: m.test_crud_field_title() })).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		await expect(createTestCrud).not.toHaveBeenCalled();
	},
};

/** Fill the form like an admin: the slug follows the title and one request is sent. */
export const CreatesItem: Story = {
	parameters: { app: { route: "/admin/test-crud/new" } },
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByRole("textbox", { name: m.test_crud_field_title() }), "Momo Kitchen Deluxe");
		await expect(canvas.getByLabelText(m.test_crud_field_slug())).toHaveValue("momo-kitchen-deluxe");
		await userEvent.type(canvas.getByLabelText(new RegExp(`^${m.test_crud_field_summary()}`)), "Dumplings.");
		await userEvent.click(canvas.getByRole("radio", { name: m.test_crud_status_published() }));
		const price = canvas.getByLabelText(m.test_crud_field_price());
		await userEvent.clear(price);
		await userEvent.type(price, "1250.5");
		await userEvent.type(canvas.getByLabelText(new RegExp(`^${m.test_crud_field_tags()}`)), "food{Enter}");
		await userEvent.click(canvas.getByRole("button", { name: m.crud_create() }));

		// One JSON request: the fields, and images as attachment ids (none here). The slug's
		// server check runs first (debounced), so this can take a moment.
		await waitFor(
			() =>
				expect(createTestCrud).toHaveBeenCalledWith({
					data: expect.objectContaining({
						title: "Momo Kitchen Deluxe",
						slug: "momo-kitchen-deluxe",
						summary: "Dumplings.",
						status: "published",
						price: 1250.5,
						tags: ["food"],
						images: [],
					}),
				}),
			{ timeout: 3000 },
		);
	},
};
