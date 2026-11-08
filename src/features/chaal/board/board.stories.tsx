import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, waitFor } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { type PlayedMove, START_FEN } from "../chess/rules";
import { CHAAL_BOARD_THEMES } from "../look/board-themes";
import { Board, type BoardProps } from "./board";
import { MoveInput } from "./move-input";

/**
 * The board (Task 74, decision 0262) in each of its states. Play functions find squares by
 * `data-square`, so they run the same in English and Nepali.
 */

const RUY_LOPEZ = "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";

/** A board that plays its moves, as a page does. */
function Playable(props: Partial<BoardProps>) {
	const [state, setState] = useState<{ fen: string; last: BoardProps["lastMove"] }>({
		fen: props.fen ?? START_FEN,
		last: props.lastMove ?? null,
	});
	const play = (move: PlayedMove) => setState({ fen: move.fen, last: move });
	return (
		<div className="flex flex-col gap-4">
			<Board movable="both" {...props} fen={state.fen} lastMove={state.last} onMove={play} />
			<MoveInput fen={state.fen} onMove={play} hotkey={false} />
		</div>
	);
}

const square = (root: HTMLElement, name: string) => root.querySelector(`[data-square="${name}"]`) as HTMLElement;

const meta = {
	title: "Chaal/Board",
	component: Board,
	decorators: [
		withChaal,
		(Story) => (
			<div className="min-h-dvh bg-ch-ground p-4 text-ch-ink sm:p-6">
				<div className="mx-auto max-w-[min(100%,36rem)]">
					<Story />
				</div>
			</div>
		),
	],
	parameters: { layout: "fullscreen" },
	args: { fen: START_FEN },
} satisfies Meta<typeof Board>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Click a piece, then where it goes: the legal targets show as dots. */
export const Playing: Story = {
	render: (args) => <Playable {...args} />,
	play: async ({ canvasElement, userEvent }) => {
		await userEvent.click(square(canvasElement, "e2"));
		await waitFor(() => expect(canvasElement.querySelectorAll('[data-mark="dot"]')).toHaveLength(2));
		await userEvent.click(square(canvasElement, "e4"));
		await waitFor(() => expect(canvasElement.querySelector('[data-at="e4"]')).not.toBeNull());
		await userEvent.click(square(canvasElement, "g8"));
	},
};

/** The last move ringed, a capture's ring among the targets. */
export const Captures: Story = {
	args: { fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", lastMove: { uci: "d7d5", san: "d5" } },
	render: (args) => <Playable {...args} />,
	play: async ({ canvasElement, userEvent }) => {
		await userEvent.click(square(canvasElement, "e4"));
		await waitFor(() => expect(canvasElement.querySelectorAll('[data-mark="capture"]')).toHaveLength(1));
	},
};

export const Check: Story = {
	args: {
		fen: "rnbqkbnr/ppppp2p/5p2/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3",
		lastMove: { uci: "d1h5", san: "Qh5#" },
	},
};

/** A pawn on the last rank: which piece it becomes. */
export const Promotion: Story = {
	args: { fen: "8/P6k/8/8/8/8/8/K7 w - - 0 1" },
	render: (args) => <Playable {...args} />,
	play: async ({ canvasElement, userEvent }) => {
		await userEvent.click(square(canvasElement, "a7"));
		await userEvent.click(square(canvasElement, "a8"));
		await waitFor(() => expect(canvasElement.querySelector('[data-testid="chaal-promotion"]')).not.toBeNull());
	},
};

/** The engine's arrow in vermilion, the player's in ink, and a circle. */
export const Shapes: Story = {
	args: {
		fen: RUY_LOPEZ,
		lastMove: { uci: "f1b5", san: "Bb5" },
		shapes: [{ from: "a7", to: "a6" }, { from: "g8", to: "f6", brush: "ink" }, { from: "e5" }],
	},
};

/** A premove waiting for the opponent, from Black's side. */
export const Premove: Story = {
	args: {
		fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
		orientation: "black",
		movable: "black",
		premove: { from: "e7", to: "e5" },
		onPremove: () => {},
	},
};

/** The cursor on the focused board. */
export const Keyboard: Story = {
	args: { movable: "white" },
	play: async ({ canvasElement, userEvent }) => {
		const grid = canvasElement.querySelector('[role="grid"]') as HTMLElement;
		grid.focus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(canvasElement.querySelectorAll('[data-mark="dot"]')).toHaveLength(2));
	},
};

export const Themes: Story = {
	args: { fen: RUY_LOPEZ, lastMove: { uci: "f1b5", san: "Bb5" }, coordinates: false },
	render: (args) => (
		<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
			{CHAAL_BOARD_THEMES.map((theme) => (
				<Board key={theme} {...args} theme={theme} label={theme} />
			))}
		</div>
	),
};
