import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { m } from "@/paraglide/messages";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { replay } from "../../../../.storybook/mocks/functions/chaal/players";
import { broadcastRound, broadcasts, streamers, tv } from "../../../../.storybook/mocks/functions/chaal/watch";
import { BoardsGrid, FocusedBoard } from "./broadcast-page";
import { BroadcastSection } from "./broadcasts-page";
import { SpectateBoard } from "./spectate-board";
import { StreamerList, TvGrid } from "./tv-page";

/**
 * Watch (Task 82): the TV's channels as diagrams, the streamers live, a broadcast's lists and a
 * round's boards, a board followed, and a game being played followed. Stories never read
 * Lichess's streams (the status mock has no live base): what they show is the first paint.
 * Play functions find things by test id, never by English text (the second pass is Nepali).
 */

const meta = {
	title: "Chaal/Watch",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<main className="min-h-dvh bg-ch-ground p-6 text-ch-ink">{children}</main>
);

export const TvChannels: Story = {
	render: () => (
		<Ground>
			<div className="max-w-5xl">
				<TvGrid games={tv.games} live={null} />
			</div>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-tv-card]")).toHaveLength(tv.games.length);
		// The bullet channel follows Black: its diagram is drawn from Black's side.
		const bullet = canvasElement.querySelector('[data-channel="bullet"] [data-testid=chaal-mini-board]');
		await expect(bullet).not.toBeNull();
	},
};

export const Streamers: Story = {
	render: () => (
		<Ground>
			<div className="max-w-xs">
				<StreamerList streamers={streamers} />
			</div>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		const links = canvasElement.querySelectorAll<HTMLAnchorElement>("[data-testid=chaal-streamer]");
		await expect(links).toHaveLength(2);
		await expect(links[0]?.rel).toBe("nofollow ugc noopener");
	},
};

export const BroadcastLists: Story = {
	render: () => (
		<Ground>
			<div className="flex max-w-3xl flex-col gap-8">
				<BroadcastSection id="story-live" title={m.ch_broadcasts_live()} tours={broadcasts.active} />
				<BroadcastSection id="story-past" title={m.ch_broadcasts_past()} tours={broadcasts.past} />
			</div>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-broadcast-row]")).toHaveLength(4);
	},
};

export const RoundBoards: Story = {
	render: () => (
		<Ground>
			<div className="max-w-5xl">
				<BoardsGrid tourId="himalOpe" roundId="himalR02" boards={broadcastRound.boards} />
			</div>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-broadcast-board]")).toHaveLength(3);
	},
};

export const BoardFollowed: Story = {
	render: () => {
		const [board] = broadcastRound.boards;
		if (!board) throw new Error("no board");
		return (
			<FocusedBoard
				tourId="himalOpe"
				round={broadcastRound}
				board={board}
				streamed={null}
				boards={broadcastRound.boards}
				link="open"
			/>
		);
	},
	play: async ({ canvasElement }) => {
		// The board's PGN arrives from the server: six moves, the latest shown.
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-testid=chaal-broadcast-focus-board]")?.getAttribute("data-ply")).toBe(
				"6",
			),
		);
		const first = canvasElement.querySelector<HTMLButtonElement>("[role=toolbar] button");
		if (!first) throw new Error("no controls");
		await userEvent.click(first);
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-testid=chaal-broadcast-focus-board]")?.getAttribute("data-ply")).toBe(
				"0",
			),
		);
	},
};

export const GameBeingPlayed: Story = {
	render: () => <SpectateBoard game={{ ...replay, ongoing: true, status: "started", winner: null }} />,
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("[data-testid=chaal-spectate-note]")).not.toBeNull();
		await expect(canvasElement.querySelector("[data-testid=chaal-spectate-board]")?.getAttribute("data-ply")).toBe(
			String(replay.moves.length),
		);
	},
};
