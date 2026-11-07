import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { m } from "@/paraglide/messages";
import { demo, withPortfolioCanvas } from "../story-helpers";
import { ContactSection } from "./contact-section";
import { HeroSection } from "./hero-section";
import { ImpactSection } from "./impact-section";
import { IntroSection } from "./intro-section";
import { JournalSection } from "./journal-section";
import { ProcessSection } from "./process-section";
import { SelectedWorkSection } from "./selected-work-section";
import { SkillsSection } from "./skills-section";
import { VoicesSection } from "./voices-section";

/** The sections of the portfolio home page, on demo data, at dawn in Kathmandu (story-helpers' STORY_NOW). */
const meta = {
	title: "Portfolio/Sections",
	decorators: [withPortfolioCanvas],
	parameters: { layout: "fullscreen", app: { route: "/" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Hero: Story = {
	render: () => <HeroSection profile={demo().profile} />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(demo().profile.name);
		await expect(canvas.getByRole("link", { name: m.portfolio_hero_contact() })).toBeVisible();
	},
};

/** With a résumé in the profile (the demo has none): the PDF link stands beside "Get in touch". */
export const HeroWithResume: Story = {
	render: () => <HeroSection profile={{ ...demo().profile, resume: "/resume.pdf" }} />,
	play: async ({ canvas }) => {
		const resume = canvas.getByRole("link", { name: m.portfolio_hero_resume() });
		await expect(resume).toBeVisible();
		await expect(resume).toHaveAttribute("type", "application/pdf");
	},
};

export const Intro: Story = { render: () => <IntroSection profile={demo().profile} /> };

export const SelectedWork: Story = {
	render: () => {
		const { summaries } = demo();
		return <SelectedWorkSection projects={summaries.filter((project) => project.featured)} total={summaries.length} />;
	},
	play: async ({ canvas }) => {
		// One stop per project: its name is the link (the preview beside the list is a picture).
		await expect(canvas.getByRole("link", { name: /Ledgerline/ })).toBeVisible();
	},
};

export const Skills: Story = {
	render: () => {
		const { capabilities, profile } = demo();
		return <SkillsSection skills={capabilities} toolbox={profile.toolbox} />;
	},
};

export const Process: Story = { render: () => <ProcessSection steps={demo().processSteps} /> };

export const Impact: Story = { render: () => <ImpactSection metrics={demo().profile.impact} /> };

export const Voices: Story = { render: () => <VoicesSection testimonials={demo().testimonials} /> };

export const Journal: Story = { render: () => <JournalSection posts={demo().posts.slice(0, 4)} /> };

export const Contact: Story = {
	render: () => <ContactSection profile={demo().profile} />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("heading", { name: m.portfolio_finale_heading() })).toBeVisible();
		await expect(canvas.getByRole("link", { name: demo().profile.email })).toBeVisible();
	},
};
