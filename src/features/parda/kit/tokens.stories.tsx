import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import { withParda } from "../../../../.storybook/mocks/parda";

/** Parda's design system, "Masking" (src/styles/parda.css, decision 0232): the tokens in the theme and locale of the run. */
const meta = {
	title: "Parda/Tokens",
	decorators: [withParda],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SWATCHES = [
	["Mask", "bg-pd-mask"],
	["Ground", "bg-pd-ground"],
	["Second ground", "bg-pd-ground-2"],
	["Ink", "bg-pd-ink"],
	["Muted", "bg-pd-muted"],
	["Action", "bg-pd-action"],
	["Subtitle", "bg-pd-subtitle"],
] as const;

export const Colours: Story = {
	render: () => (
		<div className="min-h-dvh bg-pd-ground p-6 text-pd-ink">
			<ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{SWATCHES.map(([name, swatch]) => (
					<li key={name}>
						<div className={`h-20 ${swatch}`} />
						<p className="mt-2 text-sm">{name}</p>
					</li>
				))}
			</ul>
			<div className="mt-8 flex flex-wrap gap-2">
				<Button>Play</Button>
				<Button variant="secondary">My list</Button>
				<Button variant="outline">Trailer</Button>
			</div>
		</div>
	),
	// The real cascade: the section's tokens outrank the visitor's accent and radius, in both themes.
	play: async () => {
		const style = getComputedStyle(document.documentElement);
		await expect(style.getPropertyValue("--radius").trim()).toBe("0rem");
		await expect(style.getPropertyValue("--primary")).toBe(style.getPropertyValue("--pd-action"));
		await expect(style.getPropertyValue("--primary-foreground")).toBe(style.getPropertyValue("--pd-on-action"));
		await expect(style.getPropertyValue("--background")).toBe(style.getPropertyValue("--pd-ground"));
	},
};

export const Type: Story = {
	render: () => (
		<div className="min-h-dvh bg-pd-ground p-6 text-pd-ink">
			<h1 className="pd-display text-pd-title">The Dark Knight</h1>
			<p lang="ne" className="pd-display mt-4 text-pd-title">
				आजको छनोट
			</p>
			<h2 className="pd-display mt-8 text-pd-head">Continue watching</h2>
			<p lang="ne" className="pd-display mt-2 text-pd-head">
				हेर्न जारी राख्नुहोस्
			</p>
			<p className="mt-6 max-w-prose text-pd-muted">
				Text is Inter and Noto Sans Devanagari, the app's faces. Anek Devanagari sets display type only.
			</p>
		</div>
	),
};

/** The worst case: a white picture. Text set low on the scrim still reads at 4.5:1 (tests/unit/parda-tokens.test.ts). */
export const Masks: Story = {
	render: () => (
		<div className="min-h-dvh bg-pd-ground text-pd-ink">
			<div className="flex h-15 items-center bg-pd-mask px-6">
				<span className="pd-display text-2xl">Parda</span>
			</div>
			<div className="relative aspect-[2.39] bg-white">
				<div className="pd-scrim absolute inset-0" />
				<p className="absolute inset-x-4 bottom-4 text-center text-pd-sub text-pd-subtitle">
					Welcome to a world without rules.
				</p>
				<div className="absolute inset-x-0 bottom-0 h-1 bg-pd-track">
					<div className="h-full w-1/3 bg-pd-progress" />
				</div>
			</div>
			<div className="bg-pd-mask px-6 py-6">
				<p className="pd-display text-pd-title">The Dark Knight</p>
				<p className="mt-1 text-pd-muted">2008 · 2h 32m · PG-13</p>
			</div>
		</div>
	),
};
