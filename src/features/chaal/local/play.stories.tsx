import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, waitFor } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { type PlayedMove, play } from "../chess/rules";
import type { Engine } from "../engine/engine";
import { addLocalMove, endLocalGame, fenOf, newLocalGame } from "./game";
import { LocalGameBoard } from "./local-game-page";
import { ChaalPlayHub } from "./play-hub";
import type { LocalGame } from "./types";

/**
 * Playing in the browser (Task 76): the hub's two ways to play and the history, a game
 * against the computer, one over the board face to face with clocks, and a finished game
 * with its actions. Play functions find things by test id or role, never by English text
 * (the second pass is Nepali).
 */

const AT = new Date("2026-11-08T09:00:00.000Z");

const playLine = (game: LocalGame, line: string[], clocks: LocalGame["clocks"] = null) =>
	line.reduce((current, uci) => addLocalMove(current, play(fenOf(current), uci) as PlayedMove, clocks, AT), game);

/** A computer that answers at once with the first legal reply it's given, or none. */
const computer = (): Engine => ({
	ready: Promise.resolve(),
	analyse: async () => ({ bestMove: null, stopped: true }),
	bestMove: async () => ({ bestMove: "g8f6", stopped: false }),
	stop: () => {},
	quit: () => {},
});

const meta = {
	title: "Chaal/Play",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<div className="min-h-dvh bg-ch-ground text-ch-ink">{children}</div>
);

export const Hub: Story = {
	render: () => (
		<Ground>
			<ChaalPlayHub />
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		const level = canvas.getByTestId("chaal-play-level");
		const eight = level.querySelector<HTMLInputElement>('input[value="8"]');
		if (!eight) throw new Error("no level 8");
		await userEvent.click(eight.closest("label") ?? eight);
		await expect(eight).toBeChecked();
		await expect(canvas.getByTestId("chaal-history")).toBeVisible();
	},
};

export const AgainstTheComputer: Story = {
	render: () => (
		<Ground>
			<LocalGameBoard
				initial={playLine(
					newLocalGame(
						{ mode: "engine", level: 4, color: "white", clock: null },
						"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
						AT,
					),
					["e2e4", "e7e5", "g1f3", "b8c6"],
				)}
				signedIn={false}
				createEngine={computer}
			/>
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByTestId("chaal-local-takeback")).toBeEnabled();
		await expect(canvas.getAllByTestId("chaal-player")).toHaveLength(2);
	},
};

export const FaceToFaceWithClocks: Story = {
	render: () => (
		<Ground>
			<LocalGameBoard
				initial={playLine(
					newLocalGame(
						{ mode: "board", clock: { initial: 600, increment: 5 }, layout: "tablet" },
						"1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
						AT,
					),
					["d2d4", "d7d5", "c2c4"],
					{ white: 583_000, black: 596_400 },
				)}
				signedIn={false}
			/>
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		// Opened again, the clocks wait for Continue.
		await userEvent.click(canvas.getByTestId("chaal-local-resume"));
		await waitFor(() => expect(canvas.getByTestId("chaal-local-pause")).toBeEnabled());
	},
};

export const Finished: Story = {
	render: () => (
		<Ground>
			<LocalGameBoard
				initial={endLocalGame(
					playLine(
						newLocalGame(
							{ mode: "engine", level: 2, color: "black", clock: null },
							"2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
							AT,
						),
						["f2f3", "e7e5", "g2g4"],
					),
					"0-1",
					"resign",
					AT,
				)}
				signedIn={false}
				createEngine={computer}
			/>
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByTestId("chaal-result")).toBeVisible();
		await expect(canvas.getByTestId("chaal-local-analyse")).toBeVisible();
	},
};
