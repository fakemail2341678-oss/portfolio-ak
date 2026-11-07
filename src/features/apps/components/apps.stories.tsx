import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { UpgradePage } from "@/features/auth/components/upgrade-page";
import { m } from "@/paraglide/messages";
import { AppsGallery } from "./apps-gallery";

const meta = {
	title: "Apps/Platform",
	component: AppsGallery,
} satisfies Meta<typeof AppsGallery>;
export default meta;
type Story = StoryObj<typeof meta>;

/** /apps: every showcase app, with the guest-session note. */
export const Gallery: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: new RegExp(m.notes_name()) })).toHaveAttribute(
			"href",
			expect.stringContaining("/apps/notes"),
		);
	},
};

/** /upgrade: where a guest lands from an account page. */
export const Upgrade: Story = {
	render: () => (
		<div className="max-w-sm">
			<UpgradePage search={{ redirect: "/account" }} />
		</div>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { name: m.guest_upgrade_title() })).toBeVisible();
		await expect(canvas.getByTestId("upgrade-register")).toHaveAttribute("href", expect.stringContaining("redirect"));
	},
};
