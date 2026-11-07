import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { StatusOf } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import { LINK_STATE } from "../labels";
import { LINK_STATES, type LinkItem } from "../types";
import LinkDialog from "./link-dialog";

const LINK: LinkItem = {
	id: "00000000-0000-4000-8000-000000000001",
	slug: "kathmandu-map",
	target: "https://www.openstreetmap.org/#map=12/27.7172/85.3240",
	title: "Map of Kathmandu",
	active: true,
	expiresAt: null,
	blocked: false,
	state: "live",
	clicks: 46,
	createdAt: "2026-10-01T06:00:00.000Z",
};

const meta = {
	title: "Apps/Links",
	component: LinkDialog,
	args: { onSubmit: fn(async () => {}), onClose: fn() },
} satisfies Meta<typeof LinkDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new link: where it goes, an optional short name, a title and a last day. */
export const NewLink: Story = {
	play: async ({ args }) => {
		const dialog = within(document.body).getByTestId("links-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.links_field_target()), "https://example.com/page");
		await userEvent.type(within(dialog).getByLabelText(new RegExp(m.links_field_slug())), "my-page");
		await userEvent.click(within(dialog).getByRole("button", { name: m.crud_create() }));
		await expect(args.onSubmit).toHaveBeenCalledWith({
			target: "https://example.com/page",
			slug: "my-page",
			title: "",
			expiresAt: null,
		});
	},
};

/** The rules on the form: a reserved short name and a target that isn't a web address. */
export const Invalid: Story = {
	play: async ({ args }) => {
		const dialog = within(document.body).getByTestId("links-dialog");
		await userEvent.type(within(dialog).getByLabelText(m.links_field_target()), "ftp://example.com");
		await userEvent.type(within(dialog).getByLabelText(new RegExp(m.links_field_slug())), "admin");
		await userEvent.click(within(dialog).getByRole("button", { name: m.crud_create() }));
		await expect(await within(dialog).findByText(m.links_error_target_url())).toBeVisible();
		await expect(within(dialog).getByText(m.links_error_slug_reserved())).toBeVisible();
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

/** Editing: the short name can't change, so it isn't in the form. */
export const EditLink: Story = {
	args: { link: LINK },
	play: async () => {
		const dialog = within(document.body).getByTestId("links-dialog");
		await expect(within(dialog).getByLabelText(m.links_field_target())).toHaveValue(LINK.target);
		await expect(within(dialog).queryByLabelText(new RegExp(m.links_field_slug()))).toBeNull();
	},
};

/** Every state a link can be in, each with its word (never colour alone). */
export const States: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			{LINK_STATES.map((state) => (
				<StatusOf key={state} status={state} map={LINK_STATE} />
			))}
		</div>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByText(m.links_state_guest())).toBeVisible();
	},
};
