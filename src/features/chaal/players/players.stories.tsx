import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { leaderboard, playerGames, replay } from "../../../../.storybook/mocks/functions/chaal/players";
import { ReplayBoard } from "../game/replay-page";
import { GameRow } from "./game-row";
import { Leaderboard } from "./players-page";

/**
 * Players and games (Task 81): a leaderboard, a player's games as rows, and a finished
 * game's replay with Lichess's analysis (the eval graph, each side's summary, the
 * judgements beside the moves) or without it. Play functions find things by test id, never
 * by English text (the second pass is Nepali).
 */

const meta = {
	title: "Chaal/Players",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<main className="min-h-dvh bg-ch-ground p-6 text-ch-ink">{children}</main>
);

export const LeaderboardTable: Story = {
	render: () => (
		<Ground>
			<Leaderboard board={leaderboard} />
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-leaderboard] tbody tr")).toHaveLength(3);
	},
};

export const GameRows: Story = {
	render: () => (
		<Ground>
			<ul className="ch-rule flex max-w-xl flex-col">
				{playerGames.games.map((game) => (
					<GameRow key={game.id} game={game} perspective="kathmandu_knight" />
				))}
			</ul>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-game-row]")).toHaveLength(3);
	},
};

export const ReplayAnalysed: Story = {
	render: () => <ReplayBoard game={replay} />,
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("[data-testid=chaal-replay-summary]")).not.toBeNull();
		// It opens at the end: the mate is on the board; the first step goes back to the start.
		await waitFor(() => expect(canvasElement.querySelector('[data-at="f7"][data-piece="wQ"]')).not.toBeNull());
		// The toolbar's first button goes to the start.
		const first = canvasElement.querySelector<HTMLButtonElement>("[role=toolbar] button");
		if (!first) throw new Error("no controls");
		await userEvent.click(first);
		await waitFor(() => expect(canvasElement.querySelector('[data-at="d1"][data-piece="wQ"]')).not.toBeNull());
	},
};

export const ReplayNotAnalysed: Story = {
	render: () => (
		<ReplayBoard
			game={{
				...replay,
				analysis: null,
				white: { ...replay.white, analysis: null },
				black: { ...replay.black, analysis: null },
			}}
		/>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("[data-testid=chaal-replay-not-analysed]")).not.toBeNull();
	},
};
