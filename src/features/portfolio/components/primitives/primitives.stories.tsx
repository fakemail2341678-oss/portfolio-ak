import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { m } from "@/paraglide/messages";
import { demo, withPortfolioCanvas } from "../story-helpers";
import { ArchivalFigure } from "./archival-picture";
import { FigureLines } from "./figure-lines";
import { FittedEmail } from "./fitted-email";
import { FittedName } from "./fitted-name";
import { ButtonLink, TextLink } from "./links";
import { SectionHeading } from "./section-heading";

/** The portfolio's building blocks in the Himal system. */
const meta = {
	title: "Portfolio/Primitives",
	decorators: [withPortfolioCanvas],
	parameters: { layout: "fullscreen", app: { route: "/" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Display type fitted to its container from the text's own length (no measuring script). */
export const Fitted: Story = {
	render: () => (
		<div className="hm-container flex flex-col gap-10 py-10">
			<div className="@container">
				<FittedName name={demo().profile.name} />
			</div>
			<div className="@container">
				<FittedEmail email={demo().profile.email} />
			</div>
		</div>
	),
};

export const Headings: Story = {
	render: () => (
		<div className="hm-container py-10">
			<SectionHeading id="story-heading" title={m.portfolio_process_heading()} intro={m.portfolio_process_intro()} />
		</div>
	),
};

export const Figures: Story = {
	render: () => (
		<div className="hm-container py-10">
			<FigureLines metrics={demo().profile.impact} />
		</div>
	),
};

export const Links: Story = {
	render: () => (
		<p className="hm-container flex flex-wrap items-center gap-7 py-10">
			<ButtonLink to="/contact">{m.portfolio_hero_contact()}</ButtonLink>
			<TextLink to="/work">{m.portfolio_hero_cta_work()}</TextLink>
		</p>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: m.portfolio_hero_contact() })).toBeVisible();
	},
};

/** The archival pictures in the design's two inks; each field prints them in its own. */
export const Archive: Story = {
	render: () => (
		<div className="hm-container grid gap-8 py-10 md:grid-cols-2">
			<ArchivalFigure picture="jonsongLa" sizes="50vw" />
			<div className="hm-field-rhodo p-6">
				<ArchivalFigure picture="valleyMap" aspect="6 / 5" sizes="50vw" />
			</div>
		</div>
	),
};
