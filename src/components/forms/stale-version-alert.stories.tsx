import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { m } from "@/paraglide/messages";
import { StaleVersionAlert } from "./stale-version-alert";

/** Shown above a form whose save lost to someone else's (a stale CONFLICT). */
const meta = {
	title: "Forms/Stale version alert",
	component: StaleVersionAlert,
	args: { onReload: fn(async () => {}) },
} satisfies Meta<typeof StaleVersionAlert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** "Reload" calls back (the form then resets to the latest version). */
export const Reload: Story = {
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByRole("alert")).toHaveTextContent(m.form_stale_title());
		await userEvent.click(canvas.getByRole("button", { name: m.form_stale_reload() }));
		await expect(args.onReload).toHaveBeenCalledOnce();
	},
};
