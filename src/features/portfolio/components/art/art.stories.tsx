import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { COVER_MOTIFS } from "../../constants";
import { skyAt } from "../../lib/daylight";
import { demo, withPortfolioCanvas } from "../story-helpers";
import { HeroRange } from "./hero-range";
import { MountainFrame } from "./mountain-frame";
import { PanoramaBoard } from "./panorama-board";
import { ProjectMountain } from "./project-mountain";

/**
 * The generated art (lib/terrain): the hero's range under the sky of each
 * phase of the day in Kathmandu, a project mountain for every motif, and the
 * work index's panorama board. All of it is decorative (aria-hidden).
 */
const meta = {
	title: "Portfolio/Art",
	decorators: [withPortfolioCanvas],
	parameters: { layout: "fullscreen", app: { route: "/" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 23 October 2026 in Kathmandu (UTC+5:45), at the given local time. */
const at = (time: string) => skyAt(Date.parse(`2026-10-23T${time}:00+05:45`));

const range = (time: string) => () => <HeroRange seed="AS" sky={at(time)} className="h-[28rem]" />;

export const Dawn: Story = { render: range("06:12") };
export const Day: Story = { render: range("11:00") };
export const Dusk: Story = { render: range("17:20") };
export const Night: Story = { render: range("22:00") };

export const Motifs: Story = {
	parameters: { app: { route: "/work" } },
	render: () => (
		<ul className="hm-container grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
			{COVER_MOTIFS.map((motif) => (
				<li key={motif} className="flex flex-col gap-2">
					<MountainFrame aspect="portrait">
						<ProjectMountain cover={{ motif, glyph: motif.slice(0, 2).toUpperCase(), seed: motif, image: null }} />
					</MountainFrame>
					<p className="hm-meta">{motif}</p>
				</li>
			))}
		</ul>
	),
	play: async ({ canvasElement }) => {
		// Every motif draws its sheets.
		await expect(canvasElement.querySelectorAll(".hm-relief").length).toBe(COVER_MOTIFS.length);
	},
};

export const Panorama: Story = {
	parameters: { app: { route: "/work" } },
	render: () => <PanoramaBoard projects={demo().summaries} />,
};
