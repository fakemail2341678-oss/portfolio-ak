import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, waitFor } from "storybook/test";
import { m } from "@/paraglide/messages";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { puzzleProgress } from "../../../../.storybook/mocks/functions/chaal/puzzle-attempts";
import { dailyPuzzle } from "../../../../.storybook/mocks/functions/chaal/puzzles";
import { progressOf } from "./progress";
import { PuzzleChoicesPanel, PuzzleModes, TrainingChoices } from "./puzzle-choices";
import { PuzzleProgress } from "./puzzle-progress";
import { PuzzlePlace, PuzzleSolver } from "./puzzle-solver";

/**
 * Puzzles (Task 80): the trainer on the recorded daily puzzle (the opponent's move plays,
 * then the player's), with training's choices and the progress panel; a connected player's
 * progress with Lichess's figures; and the board's place while puzzles load. Play functions
 * find things by test id or square, never by English text (the second pass is Nepali).
 */

const meta = {
	title: "Chaal/Puzzles",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<main className="min-h-dvh bg-ch-ground text-ch-ink">{children}</main>
);

const Heading = () => (
	<h1 id="chaal-puzzle-heading" className="ch-display text-ch-title">
		{m.ch_puzzle_daily()}
	</h1>
);

const empty = progressOf([], 0);

const square = (canvasElement: HTMLElement, name: string) => {
	const found = canvasElement.querySelector<HTMLElement>(`[data-square="${name}"]`);
	if (!found) throw new Error(`no square ${name}`);
	return found;
};

export const Daily: Story = {
	render: () => (
		<Ground>
			<PuzzleSolver
				puzzle={dailyPuzzle}
				heading={<Heading />}
				onResult={() => {}}
				next={<span data-testid="chaal-puzzle-next" />}
				extra={
					<>
						<PuzzleChoicesPanel>
							<PuzzleModes current="train" streak />
							<TrainingChoices theme="skewer" difficulty="normal" color={null} />
						</PuzzleChoicesPanel>
						<PuzzleProgress stats={empty} lichess={null} pending={0} canConnect onConnect={() => {}} />
					</>
				}
			/>
		</Ground>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const board = canvas.getByTestId("chaal-puzzle-board");
		// The opponent's move plays itself; then it's the player's turn.
		await waitFor(() => expect(board).toHaveAttribute("data-phase", "play"), { timeout: 3_000 });
		await userEvent.click(square(canvasElement, "f1"));
		await userEvent.click(square(canvasElement, "f4"));
		// The reply (the queen takes on c2) plays itself, and it's the player's turn again.
		await waitFor(() => expect(canvasElement.querySelector('[data-at="c2"]')).not.toBeNull(), { timeout: 3_000 });
		await waitFor(() => expect(board).toHaveAttribute("data-phase", "play"));
	},
};

export const Progress: Story = {
	render: () => (
		<Ground>
			<div className="mx-auto max-w-md p-4">
				<PuzzleProgress
					stats={puzzleProgress.stats}
					lichess={puzzleProgress.lichess}
					pending={puzzleProgress.pending}
					canConnect
					onConnect={() => {}}
				/>
			</div>
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByTestId("chaal-puzzle-lichess")).toBeVisible();
		await expect(canvas.getByTestId("chaal-puzzle-best-streak")).toBeVisible();
		await expect(canvas.getByTestId("chaal-puzzle-replay-pin")).toBeVisible();
	},
};

export const Loading: Story = {
	render: () => (
		<Ground>
			<PuzzlePlace heading={<Heading />} busy />
		</Ground>
	),
};

export const NothingLeft: Story = {
	render: () => (
		<Ground>
			<PuzzlePlace heading={<Heading />} message={m.ch_puzzle_none_left()} />
		</Ground>
	),
};
