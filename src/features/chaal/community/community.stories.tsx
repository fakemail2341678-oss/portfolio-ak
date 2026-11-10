import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, mocked, userEvent, waitFor } from "storybook/test";
import { getChaalArena } from "@/functions/chaal/tournaments";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { sampleUser } from "../../../../.storybook/mocks/data";
import { chapters, studyPgn } from "../../../../.storybook/mocks/functions/chaal/studies";
import { teamPage } from "../../../../.storybook/mocks/functions/chaal/teams";
import { arenaFinished, arenaPlayed, tournaments } from "../../../../.storybook/mocks/functions/chaal/tournaments";
import { ArenaView, SwissView } from "../events/tournament-page";
import { ArenaRow } from "../events/tournaments-page";
import { ChapterViewer } from "../studies/study-page";
import { TeamView } from "../teams/team-page";

/**
 * Community (Task 83): Lichess's arenas, an arena being played (its top game and standings)
 * and finished (its podium and numbers), a Swiss tournament, a team, and a study's chapter in
 * the viewer. Play functions find things by test id, never by English text (the second pass
 * is Nepali).
 */

const meta = {
	title: "Chaal/Community",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<main className="min-h-dvh bg-ch-ground p-6 text-ch-ink">
		<div className="mx-auto max-w-5xl">{children}</div>
	</main>
);

export const Arenas: Story = {
	render: () => (
		<Ground>
			<ul className="flex max-w-3xl flex-col">
				{[...tournaments.started, ...tournaments.created, ...tournaments.finished].map((arena) => (
					<ArenaRow key={arena.id} arena={arena} />
				))}
			</ul>
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-arena-row]")).toHaveLength(4);
	},
};

export const ArenaBeingPlayed: Story = {
	// Signed in, so the stories' connection is asked for (without a session it never is).
	parameters: { app: { session: sampleUser } },
	beforeEach: () => {
		mocked(getChaalArena).mockResolvedValue(arenaPlayed);
	},
	render: () => (
		<Ground>
			<ArenaView id="blitzNow" page={1} />
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll("[data-testid=chaal-standing]")).toHaveLength(
				arenaPlayed.arena.standing.players.length,
			),
		);
		await expect(canvasElement.querySelector("[data-testid=chaal-tournament-top-game]")).not.toBeNull();
		// Connected (the stories' player): joining, with "pair me ASAP" while it's played. The form
		// waits for the connection's and the status's queries, which can settle after the standings.
		await waitFor(() => expect(canvasElement.querySelector("[data-testid=chaal-tournament-join-form]")).not.toBeNull());
		await expect(canvasElement.querySelector("[data-testid=chaal-tournament-asap]")).not.toBeNull();
	},
};

export const ArenaFinished: Story = {
	beforeEach: () => {
		mocked(getChaalArena).mockResolvedValue(arenaFinished);
	},
	render: () => (
		<Ground>
			<ArenaView id="blitzDon" page={1} />
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(canvasElement.querySelector("[data-testid=chaal-tournament-podium]")).not.toBeNull());
		await expect(canvasElement.querySelector("[data-testid=chaal-tournament-entry]")).toBeNull();
	},
};

export const Swiss: Story = {
	render: () => (
		<Ground>
			<SwissView id="swissNp1" />
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(canvasElement.querySelectorAll("[data-testid=chaal-standing]")).toHaveLength(6));
	},
};

export const Team: Story = {
	render: () => (
		<Ground>
			<TeamView page={teamPage} />
		</Ground>
	),
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector("[data-testid=chaal-team-description]")?.textContent).toContain(
			"Players from all over Nepal.",
		);
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-team-members] li")).toHaveLength(3);
		await expect(canvasElement.querySelectorAll("[data-testid=chaal-swiss-row]")).toHaveLength(1);
	},
};

export const StudyChapter: Story = {
	render: () => {
		const [chapter] = chapters;
		if (!chapter) throw new Error("no chapter");
		return (
			<Ground>
				<ChapterViewer chapter={chapter} pgn={studyPgn} />
			</Ground>
		);
	},
	play: async ({ canvasElement }) => {
		// The start's comment, then a move further on.
		const comment = () => canvasElement.querySelector("[data-testid=chaal-study-comment]")?.textContent ?? "";
		await expect(comment()).not.toBe("");
		const buttons = canvasElement.querySelectorAll<HTMLButtonElement>("[role=toolbar] button");
		const forward = buttons[2];
		if (!forward) throw new Error("no controls");
		await userEvent.click(forward);
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-testid=chaal-study-analyse]")?.getAttribute("href")).toContain(
				"moves=e2e4",
			),
		);
	},
};
