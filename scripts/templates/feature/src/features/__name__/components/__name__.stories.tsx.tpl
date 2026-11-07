import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { DataTable } from "@/components/data-table";
import { create__Pascal__ } from "@/functions/__name__";
import { m } from "@/paraglide/messages";
import { sample__Pascal__, sample__Pascal__Rows } from "../../../../.storybook/mocks/functions/__name__";
import { __camel__Columns } from "../columns";
import { __UPPER___TABLE_ID } from "../search";
import { __Pascal__Form } from "./__name__-form";

const meta = { title: "__Title__", component: __Pascal__Form } satisfies Meta<typeof __Pascal__Form>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Table: Story = {
	parameters: { app: { route: "/admin/__name__" } },
	render: () => (
		<DataTable
			tableId={__UPPER___TABLE_ID}
			rows={sample__Pascal__Rows}
			columns={__camel__Columns}
			getRowId={(row) => row.id}
			getRowLabel={(row) => {{#localized}}row.title.en{{/localized}}{{^localized}}row.title{{/localized}}}
			sort="-updated"
			bulkActions={() => null}
		/>
	),
};

export const NewRow: Story = { parameters: { app: { route: "/admin/__name__/new" } } };

export const EditRow: Story = {
	args: { row: sample__Pascal__ },
	parameters: { app: { route: `/admin/__name__/${sample__Pascal__.id}` } },
};

/** Empty submit: the title reports, nothing is saved. */
export const Validation: Story = {
	parameters: { app: { route: "/admin/__name__/new" } },
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: m.crud_create() }));
		await expect(await canvas.findByTestId("form-error-summary")).toHaveFocus();
		await expect(create__Pascal__).not.toHaveBeenCalled();
	},
};

/** A filled form sends one request with the fields. */
export const Creates: Story = {
	parameters: { app: { route: "/admin/__name__/new" } },
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", {
				name: {{#localized}}m.localized_label({ label: m.__snake___field_title(), language: m.language_en() }){{/localized}}{{^localized}}m.__snake___field_title(){{/localized}},
			}),
			"First row",
		);
		await userEvent.click(canvas.getByRole("button", { name: m.crud_create() }));
		await waitFor(
			() =>
				expect(create__Pascal__).toHaveBeenCalledWith({
					data: expect.objectContaining({ title: {{#localized}}{ en: "First row", ne: "" }{{/localized}}{{^localized}}"First row"{{/localized}} }),
				}),
			// With a slug, its server check runs first (debounced).
			{ timeout: 3000 },
		);
	},
};
