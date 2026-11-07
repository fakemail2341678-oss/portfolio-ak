import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { m } from "@/paraglide/messages";
import { demo, withPortfolioCanvas } from "../story-helpers";
import { PortfolioFooter } from "./portfolio-footer";
import { PortfolioHeader } from "./portfolio-header";
import { PortfolioMenu } from "./portfolio-menu";
import { PortfolioNotFound } from "./portfolio-not-found";
import { PortfolioPending } from "./portfolio-pending";

/** The portfolio's own header, phone menu, footer and 404 (each section brings its own header, decision 0161). */
const meta = {
	title: "Portfolio/Chrome",
	decorators: [withPortfolioCanvas],
	parameters: { layout: "fullscreen", app: { route: "/work" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
	render: () => <PortfolioHeader profile={demo().profile} />,
	play: async ({ canvas }) => {
		// The brand link is named by its visible text.
		await expect(canvas.getByRole("link", { name: new RegExp(demo().profile.name) })).toBeInTheDocument();
	},
};

/** The phone menu (shown below the md breakpoint), opened: a native <details>, so it works before JavaScript. */
export const PhoneMenu: Story = {
	render: () => (
		<div className="hm-container flex h-(--hm-header-h) items-center justify-end">
			<PortfolioMenu />
		</div>
	),
	play: async ({ canvas }) => {
		await userEvent.click(canvas.getByText(m.portfolio_menu_open()));
		await expect(canvas.getByRole("navigation", { name: m.portfolio_nav_label() })).toBeVisible();
	},
};

export const Footer: Story = {
	render: () => <PortfolioFooter profile={demo().profile} />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: demo().profile.email })).toBeVisible();
	},
};

export const NotFound: Story = {
	render: () => <PortfolioNotFound />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { level: 1, name: m.portfolio_not_found_title() })).toBeVisible();
	},
};

/** While a page loads: the range printed again and again, and the status in words (decision 0201). */
export const Pending: Story = {
	render: () => <PortfolioPending />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("status")).toHaveTextContent(m.portfolio_pending());
	},
};
