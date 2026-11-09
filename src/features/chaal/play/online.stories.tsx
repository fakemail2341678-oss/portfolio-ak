import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, fn, mocked, waitFor, within } from "storybook/test";
import { getChaalStatus } from "@/functions/chaal/status";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { sampleUser } from "../../../../.storybook/mocks/data";
import { DEFAULT_ENGINE_LIMITS } from "../engine/limits";
import { CHAAL_FEATURES, type ChaalFeature } from "../features";
import { LiveGameBoard } from "../game/live-game-page";
import type { ChaalEventGame, ChaalGameState } from "../live/events";
import type { KeepOptions } from "../live/reader";
import { IDLE, liveStore } from "../live/store";
import { DEFAULT_CHAAL_DEFAULTS } from "../settings/preferences";
import { NoticeBell } from "../shell/live-notices";
import { DEFAULT_PLAY_LIMITS } from "./controls";
import { MyGames, OnlinePlay } from "./online-play";
import { QuickPair } from "./quick-pair";
import type { ChaalLiveGame } from "./schema";

/**
 * Online play (Tasks 77 and 78): the hub's online part (connected, not connected, off; the
 * AI, a player, a link; challenges to answer; quick pairing; my games), the bell, and a game
 * on Lichess (your move, the opponent's offers and their leaving, against the AI, berserk,
 * over). Play functions find things by test id
 * or role, never by English text (the second pass is Nepali).
 */

const meta = {
	title: "Chaal/Online",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Ground = ({ children }: { children: ReactNode }) => (
	<div className="min-h-dvh bg-ch-ground px-4 py-6 text-ch-ink sm:px-8">{children}</div>
);

const SIGNED_IN = { app: { session: sampleUser, route: "/app/chaal/play" } };

const calls = () => ({
	move: fn(async () => {}),
	act: fn(async () => {}),
	chat: fn(async () => {}),
	challengeAi: fn(async () => ({ id: "aiGame12" })),
	challengePlayer: fn(async () => {
		throw new Error("not in a story");
	}),
	open: fn(async () => ({ id: "open1234", link: "https://lichess.org/open1234?color=black", color: "white" as const })),
	accept: fn(async (id: string) => ({ id })),
	decline: fn(async () => {}),
	cancel: fn(async () => {}),
	seekDays: fn(async () => ({ id: "seek1234" })),
	playing: fn(async () => ({ games: [] })),
});

export const Setup: Story = {
	parameters: SIGNED_IN,
	render: () => (
		<Ground>
			<OnlinePlay calls={calls()} />
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByTestId("chaal-online-ai")).toBeVisible();
		// The challenge to answer, from the (mocked) list.
		await expect(await canvas.findByTestId("chaal-challenge-in")).toBeVisible();
		const friend = canvas.getByTestId("chaal-online-opponent").querySelector<HTMLInputElement>('input[value="friend"]');
		if (!friend) throw new Error("no friend choice");
		await userEvent.click(friend.closest("label") ?? friend);
		await userEvent.type(canvas.getByTestId("chaal-online-username"), "E2E_Rival");
		const days = canvas.getByTestId("chaal-online-friend-kind").querySelector<HTMLInputElement>('input[value="days"]');
		if (!days) throw new Error("no correspondence choice");
		await userEvent.click(days.closest("label") ?? days);
		await expect(canvas.getByTestId("chaal-online-friend-days")).toBeVisible();
	},
};

export const ALink: Story = {
	parameters: SIGNED_IN,
	render: () => (
		<Ground>
			<OnlinePlay calls={calls()} search={{ with: "link" }} />
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(await canvas.findByTestId("chaal-online-link-start"));
		await expect(await canvas.findByTestId("chaal-online-link-value")).toHaveValue(
			"https://lichess.org/open1234?color=black",
		);
	},
};

export const NotConnected: Story = {
	render: () => (
		<Ground>
			<OnlinePlay calls={calls()} />
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-online-connect")).toBeVisible();
	},
};

export const Off: Story = {
	parameters: SIGNED_IN,
	beforeEach: () => {
		mocked(getChaalStatus).mockResolvedValue({
			features: Object.fromEntries(CHAAL_FEATURES.map((feature) => [feature, feature !== "play"])) as Record<
				ChaalFeature,
				boolean
			>,
			connect: "on",
			explorerForVisitors: true,
			banner: null,
			engine: DEFAULT_ENGINE_LIMITS,
			play: DEFAULT_PLAY_LIMITS,
			defaults: DEFAULT_CHAAL_DEFAULTS,
			maintenance: null,
		});
	},
	render: () => (
		<Ground>
			<OnlinePlay calls={calls()} />
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-online-off")).toBeVisible();
	},
};

const STATE = (overrides: Partial<ChaalGameState> = {}): ChaalGameState => ({
	moves: ["e2e4", "c7c5", "g1f3", "d7d6"],
	wtime: 512_000,
	btime: 498_000,
	winc: 5_000,
	binc: 5_000,
	status: "started",
	winner: null,
	wdraw: false,
	bdraw: false,
	wtakeback: false,
	btakeback: false,
	expiration: null,
	...overrides,
});

const GAME = (
	state: Partial<ChaalGameState> = {},
	black: Partial<ChaalLiveGame["game"]["black"]> = {},
): ChaalLiveGame => ({
	color: "white",
	game: {
		id: "kUhShhgl",
		rated: true,
		speed: "rapid",
		variant: "standard",
		clock: { initial: 600_000, increment: 5_000 },
		daysPerTurn: null,
		initialFen: null,
		white: {
			id: "e2e_player",
			name: "E2E_Player",
			title: null,
			rating: 1603,
			provisional: false,
			aiLevel: null,
			ratingDiff: null,
		},
		black: {
			id: "e2e_rival",
			name: "E2E_Rival",
			title: "FM",
			rating: 2210,
			provisional: false,
			aiLevel: null,
			ratingDiff: null,
			...black,
		},
		state: STATE(state),
		tournamentId: null,
		createdAt: 0,
	},
});

/** A stream that opens at once and sends what the story gives it. */
const streamOf =
	(...lines: unknown[]) =>
	(_url: string, options: KeepOptions) => {
		options.onStatus?.({ state: "open" });
		for (const line of lines) options.onLine(line);
		return { stop: () => {} };
	};

const board = (initial: ChaalLiveGame, stream = streamOf()) => (
	<div className="min-h-dvh bg-ch-ground text-ch-ink">
		<LiveGameBoard initial={initial} calls={calls()} stream={stream} />
	</div>
);

export const YourMove: Story = {
	parameters: SIGNED_IN,
	render: () => board(GAME()),
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-game-link")).toHaveAttribute("data-link", "open");
		await expect(canvas.getByTestId("chaal-game-resign")).toBeVisible();
		await expect(await canvas.findByTestId("chaal-game-chat")).toBeVisible();
	},
};

export const OffersAndLeaving: Story = {
	parameters: SIGNED_IN,
	render: () => board(GAME({ bdraw: true }), streamOf({ type: "opponentGone", gone: true, claimWinInSeconds: 0 })),
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-game-draw-offer")).toBeVisible();
		await waitFor(() => expect(canvas.getByTestId("chaal-game-claim-victory")).toBeVisible());
	},
};

export const AgainstTheAi: Story = {
	parameters: SIGNED_IN,
	render: () => board({ ...GAME({}, { id: null, name: "", title: null, rating: null, aiLevel: 4 }), color: "white" }),
	play: async ({ canvas }) => {
		// No draw offers and no chat against the AI.
		await expect(await canvas.findByTestId("chaal-game-board")).toBeVisible();
		await expect(canvas.queryByTestId("chaal-game-draw")).toBeNull();
		await expect(canvas.queryByTestId("chaal-game-chat")).toBeNull();
	},
};

export const Over: Story = {
	parameters: SIGNED_IN,
	render: () => {
		const game = GAME({
			moves: ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"],
			status: "mate",
			winner: "white",
		});
		return board({ ...game, game: { ...game.game, white: { ...game.game.white, ratingDiff: 8 } } });
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-result")).toBeVisible();
		await expect(canvas.getByTestId("chaal-game-rating")).toBeVisible();
		await expect(canvas.getByTestId("chaal-game-analyse")).toBeVisible();
	},
};

// --- Task 78: quick pairing, my games, the bell, berserk -----------------------------------

const eventGame = (overrides: Partial<ChaalEventGame>): ChaalEventGame => ({
	id: "corr1234",
	color: "white",
	fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
	lastMove: "e7e5",
	source: "lobby",
	status: "started",
	variant: "standard",
	speed: "correspondence",
	rated: true,
	hasMoved: true,
	isMyTurn: true,
	secondsLeft: 200_000,
	opponent: { id: "e2e_rival", name: "E2E_Rival", title: "FM", rating: 2210, aiLevel: null },
	winner: null,
	ratingDiff: null,
	boardCompatible: true,
	tournamentId: null,
	...overrides,
});

/** The event store as an open stream holding these games and an incoming challenge. */
const followed = (games: ChaalEventGame[]) => () => {
	liveStore.set({
		...IDLE,
		status: "open",
		downSince: null,
		settled: true,
		games,
		readAt: Object.fromEntries(games.map((game) => [game.id, Date.now()])),
		challenges: [
			{
				id: "chal5678",
				status: "created",
				challenger: { id: "e2e_rival", name: "E2E_Rival", title: "FM", rating: 2210, aiLevel: null },
				destUser: { id: "e2e_player", name: "E2E_Player", title: null, rating: 1603, aiLevel: null },
				variant: "standard",
				rated: false,
				speed: "correspondence",
				timeControl: { type: "correspondence", limit: null, increment: null, daysPerTurn: 3 },
				color: "random",
				finalColor: null,
				declineReasonKey: null,
			},
		],
	});
	return () => liveStore.set(IDLE);
};

/** A seek stream that opens and stays quiet until stopped. */
const quietStream = (_url: string, options: KeepOptions) => {
	options.onStatus?.({ state: "open" });
	return { stop: () => {} };
};

export const QuickPairing: Story = {
	parameters: SIGNED_IN,
	beforeEach: followed([]),
	render: () => (
		<Ground>
			<QuickPair calls={calls()} rated stream={quietStream} />
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByTestId("chaal-quick-status")).toHaveAttribute("data-state", "ready");
		const tile = canvas.getAllByTestId("chaal-quick-tile").find((button) => button.dataset.pace === "600+5");
		if (!tile) throw new Error("no 10+5 tile");
		await userEvent.click(tile);
		await expect(canvas.getByTestId("chaal-quick-status")).toHaveAttribute("data-state", "seeking");
		await expect(tile).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(canvas.getByTestId("chaal-quick-cancel"));
		await expect(canvas.getByTestId("chaal-quick-status")).toHaveAttribute("data-state", "ready");
	},
};

export const MyGamesAndTheBell: Story = {
	parameters: SIGNED_IN,
	beforeEach: followed([
		eventGame({ id: "theirs12", isMyTurn: false, secondsLeft: 400_000 }),
		eventGame({ id: "mine1234", isMyTurn: true, secondsLeft: 90_000 }),
		eventGame({ id: "rapid123", speed: "rapid", isMyTurn: false, secondsLeft: 420, source: "friend" }),
	]),
	render: () => (
		<Ground>
			<div className="flex justify-end">
				<NoticeBell />
			</div>
			<MyGames />
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		const rows = await canvas.findAllByTestId("chaal-online-game");
		await expect(rows[0]).toHaveAttribute("data-my-turn", "true");
		const bell = await canvas.findByTestId("chaal-bell");
		await expect(bell).toHaveAttribute("data-count", "2");
		await userEvent.click(bell);
		await expect(await within(document.body).findByTestId("chaal-bell-panel")).toBeVisible();
	},
};

export const Berserk: Story = {
	parameters: SIGNED_IN,
	render: () => {
		const game = GAME({ moves: [], wtime: 300_000, btime: 300_000 });
		return board({
			...game,
			game: { ...game.game, tournamentId: "arena123", clock: { initial: 300_000, increment: 0 } },
		});
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByTestId("chaal-game-berserk")).toBeVisible();
	},
};
