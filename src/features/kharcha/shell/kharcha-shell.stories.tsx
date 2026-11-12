import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { m } from "@/paraglide/messages";
import { getKharchaMe } from "../../../../.storybook/mocks/functions/kharcha/me";
import { sampleKharchaGuest, sampleKharchaMe, sampleKharchaSession } from "../../../../.storybook/mocks/kharcha";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import { KharchaHome } from "../home/kharcha-home";
import { KharchaShell } from "./kharcha-shell";

/** Kharcha's frame around Home, as the `_shell` layout renders it (decision 0282). */
function ShellWithHome() {
	return (
		<KharchaShell>
			<KharchaHome />
		</KharchaShell>
	);
}

const meta = {
	title: "Kharcha/Shell",
	component: ShellWithHome,
	decorators: [withKharcha],
	parameters: {
		layout: "fullscreen",
		app: { session: sampleKharchaSession, route: "/app/kharcha/home" },
	},
	beforeEach: () => {
		getKharchaMe.mockResolvedValue(sampleKharchaMe);
	},
} satisfies Meta<typeof ShellWithHome>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A laptop: the red rail (Home, search, the caller's plate), Home's header with search and
 * New, the balances first ("split with people"), this month against last, recent lines.
 */
export const Desktop: Story = {
	play: async ({ canvas }) => {
		const rail = await canvas.findByRole("navigation", { name: m.kharcha_nav_label() });
		await expect(within(rail).getByRole("link", { name: m.kharcha_nav_home() })).toBeVisible();
		await expect(await canvas.findByTestId("kharcha-home-owed")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-home-recent")).toHaveTextContent("Momo at Thamel");
		await expect(canvas.queryByTestId("guest-banner")).toBeNull();
	},
};

/** The + menu: what can be started from anywhere (Task 88: a friend, a group). */
export const CreateMenu: Story = {
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(await canvas.findByTestId("kharcha-new"));
		const body = within(canvasElement.ownerDocument.body);
		const menu = await body.findByTestId("kharcha-create-menu");
		await expect(within(menu).getByText(m.kharcha_create_friend())).toBeVisible();
		await userEvent.keyboard("{Escape}");
	},
};

/** A guest: the banner offering sign-up; on the first visit onboarding sits at the top of Home. */
export const GuestFirstVisit: Story = {
	parameters: { app: { session: sampleKharchaGuest, route: "/app/kharcha/home" } },
	beforeEach: () => {
		getKharchaMe.mockResolvedValue({
			...sampleKharchaMe,
			isGuest: true,
			profile: { ...sampleKharchaMe.profile, onboarded: false, start: "track" },
		});
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("guest-banner")).toBeVisible();
		const card = await canvas.findByTestId("kharcha-onboarding");
		await expect(within(card).getByRole("heading", { name: m.kharcha_onboarding_title() })).toBeVisible();
	},
};

/** On a phone: the red top bar, the bottom tabs and the floating +. */
export const Phone: Story = {
	globals: { viewport: { value: "mobile1", isRotated: false } },
	play: async ({ canvas }) => {
		await waitFor(() => expect(canvas.getByTestId("kharcha-bar")).toBeVisible());
		await expect(canvas.getByTestId("kharcha-tabs")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-fab")).toBeVisible();
		await expect(canvas.getByTestId("kharcha-rail")).not.toBeVisible();
	},
};
