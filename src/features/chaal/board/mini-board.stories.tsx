import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { CHAAL_BOARD_THEMES } from "../look/board-themes";
import { MiniBoard } from "./mini-board";

/** The static diagram (Task 73, decision 0259): drawn on the server, in each board theme, with the last move ringed. */
const meta = {
	title: "Chaal/MiniBoard",
	component: MiniBoard,
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
	args: {
		fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
		marks: ["f1", "b5"],
		label: "Ruy Lopez, after 3.Bb5",
	},
} satisfies Meta<typeof MiniBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Diagram: Story = {
	render: (args) => (
		<div className="min-h-dvh bg-ch-ground p-6 text-ch-ink">
			<div className="max-w-sm">
				<MiniBoard {...args} />
			</div>
		</div>
	),
	play: async ({ canvas }) => {
		const board = canvas.getByRole("img", { name: "Ruy Lopez, after 3.Bb5" });
		await expect(board.querySelectorAll("img")).toHaveLength(32);
	},
};

export const Themes: Story = {
	render: (args) => (
		<div className="grid min-h-dvh grid-cols-1 gap-6 bg-ch-ground p-6 text-ch-ink sm:grid-cols-3">
			{CHAAL_BOARD_THEMES.map((theme) => (
				<MiniBoard key={theme} {...args} theme={theme} label={`${args.label} (${theme})`} />
			))}
		</div>
	),
};

export const FromBlack: Story = {
	args: { orientation: "black", coordinates: true },
	render: Diagram.render,
};
