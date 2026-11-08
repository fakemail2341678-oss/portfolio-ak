import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { expect, fn, waitFor } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { readPgn } from "../chess/pgn";
import { nodeOf, toggleNag } from "../chess/tree";
import { setLiveGames } from "../live/fair-play";
import type { ChaalExplorerResult } from "../schema";
import { FairPlayBanner } from "../shell/fair-play-banner";
import { EnginePanel } from "./engine-panel";
import { ExplorerPanel } from "./explorer-panel";
import { NodeTools } from "./node-tools";
import type { ExplorerQuery } from "./queries";
import { TablebasePanel } from "./tablebase-panel";

/**
 * The analysis board's panels (Task 75): Stockfish's lines in each state, the opening
 * explorer, the tablebase, the move tools and fair play's banner. Play functions find
 * things by test id or role, never by English text (the second pass is Nepali).
 */

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const GAME = (() => {
	const read = readPgn("1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4) 3. Bb5 a6 *");
	if (!read.ok) throw new Error(read.reason);
	return read.game.tree;
})();

function Frame({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-dvh bg-ch-ground p-4 text-ch-ink sm:p-6">
			<div className="mx-auto flex max-w-md flex-col gap-6">{children}</div>
		</div>
	);
}

const meta = {
	title: "Chaal/Analysis",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const LINES = [
	{ score: { cp: 35 }, moves: ["e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1"] },
	{ score: { cp: 41 }, moves: ["c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6"] },
	{ score: { cp: 52 }, moves: ["e7e6", "d2d4", "d7d5", "b1c3", "g8f6"] },
];

const engineProps = {
	fen: AFTER_E4,
	progress: 0,
	lines: [],
	depth: 0,
	source: null,
	locked: false,
	notation: "figurine" as const,
	onToggle: fn(),
	onPlayLine: fn(),
};

/** Off, downloading, analysing (this device and the cloud), failed, and held by fair play. */
export const Engine: Story = {
	render: () => (
		<Frame>
			<EnginePanel {...engineProps} status="off" />
			<EnginePanel {...engineProps} status="loading" progress={0.45} />
			<EnginePanel {...engineProps} status="running" lines={LINES} depth={21} source="local" />
			<EnginePanel {...engineProps} status="done" lines={LINES} depth={58} source="cloud" compact />
			<EnginePanel {...engineProps} status="failed" />
			<EnginePanel {...engineProps} status="off" locked />
		</Frame>
	),
	play: async ({ canvasElement, userEvent }) => {
		const lines = canvasElement.querySelectorAll('[data-testid="chaal-engine-lines"]');
		await expect(lines).toHaveLength(2);
		const first = lines[0]?.querySelector("button");
		if (!first) throw new Error("no move");
		await userEvent.click(first);
		await expect(engineProps.onPlayLine).toHaveBeenCalledWith(["e7e5"]);
	},
};

const MASTERS: ChaalExplorerResult = {
	ok: true,
	data: {
		database: "masters",
		opening: { eco: "B00", name: "King's Pawn Game" },
		white: 419_328,
		draws: 573_290,
		black: 316_848,
		moves: [
			{ uci: "c7c5", san: "c5", white: 188_770, draws: 257_675, black: 154_647, rating: 2401 },
			{ uci: "e7e5", san: "e5", white: 93_250, draws: 141_110, black: 63_903, rating: 2398 },
			{ uci: "e7e6", san: "e6", white: 46_120, draws: 62_811, black: 37_002, rating: 2390 },
			{ uci: "g7g6", san: "g6", white: 3_120, draws: 2_811, black: 1_002, rating: 2310 },
		],
		games: [
			{
				id: "OVBHNsSW",
				white: { name: "Carlsen, M.", rating: 2864 },
				black: { name: "Caruana, F.", rating: 2832 },
				winner: "white",
				year: 2018,
				uci: "c7c5",
			},
			{
				id: "Xb4Ya1Qz",
				white: { name: "Ding, L.", rating: 2805 },
				black: { name: "Nepomniachtchi, I.", rating: 2795 },
				winner: null,
				year: 2023,
				uci: "e7e5",
			},
		],
		indexing: false,
	},
};

function Explorer({ result }: { result: ChaalExplorerResult | undefined }) {
	const [query, setQuery] = useState<Omit<ExplorerQuery, "fen">>({ database: "masters" });
	return (
		<ExplorerPanel
			query={query}
			onQueryChange={setQuery}
			result={result}
			pending={false}
			error={null}
			notation="figurine"
			locked={false}
			canConnect
			onConnect={fn()}
			onPlay={fn()}
			defaultPlayer="E2E_Player"
		/>
	);
}

/** Masters after 1.e4: moves with their outcomes, the totals, and the best games as links. */
export const ExplorerMasters: Story = {
	render: () => (
		<Frame>
			<Explorer result={MASTERS} />
		</Frame>
	),
	play: async ({ canvasElement, userEvent }) => {
		await expect(canvasElement.querySelectorAll('[data-testid="chaal-explorer-move"]')).toHaveLength(4);
		const lichess = canvasElement.querySelector<HTMLElement>('[data-testid="chaal-explorer-lichess"]');
		if (!lichess) throw new Error("no Lichess tab");
		await userEvent.click(lichess);
		await waitFor(() => expect(canvasElement.querySelector('[data-testid="chaal-explorer-filters"]')).not.toBeNull());
	},
};

/** A visitor without a token (no LICHESS_APP_TOKEN on the server): connect to use it. */
export const ExplorerNeedsToken: Story = {
	render: () => (
		<Frame>
			<Explorer result={{ ok: false, reason: "token" }} />
		</Frame>
	),
};

export const Tablebase: Story = {
	render: () => (
		<Frame>
			<TablebasePanel
				result={{
					result: "win",
					dtz: 1,
					dtm: 17,
					checkmate: false,
					stalemate: false,
					insufficientMaterial: false,
					moves: [
						{ uci: "h7h8q", san: "h8=Q+", result: "win", dtz: 2, dtm: 16 },
						{ uci: "h7h8r", san: "h8=R+", result: "win", dtz: 2, dtm: 18 },
						{ uci: "g7f6", san: "Kf6", result: "draw", dtz: 0, dtm: null },
						{ uci: "g7g8", san: "Kg8", result: "loss", dtz: -3, dtm: -21 },
					],
				}}
				pending={false}
				error={null}
				tooMany={false}
				notation="figurine"
				locked={false}
				onPlay={fn()}
			/>
			<TablebasePanel
				result={undefined}
				pending={false}
				error={null}
				tooMany
				notation="figurine"
				locked={false}
				onPlay={fn()}
			/>
		</Frame>
	),
};

/** Annotating the move shown: symbols toggle, one of each kind at a time. */
function Tools() {
	const [tree, setTree] = useState(GAME);
	// 2...d6, the variation beside 2...Nc6.
	const d6 = Object.values(tree.nodes).find((node) => node.san === "d6") ?? nodeOf(tree, tree.root);
	return (
		<NodeTools
			tree={tree}
			node={d6}
			notation="figurine"
			onToggleNag={(nag) => setTree((previous) => toggleNag(previous, d6.id, nag))}
			onComment={fn()}
			onPromote={fn()}
			onMakeMain={fn()}
			onDelete={fn()}
		/>
	);
}

export const MoveTools: Story = {
	render: () => (
		<Frame>
			<Tools />
		</Frame>
	),
	play: async ({ canvasElement, userEvent }) => {
		const brilliant = canvasElement.querySelector<HTMLElement>('[data-testid="chaal-nag-3"]');
		const dubious = canvasElement.querySelector<HTMLElement>('[data-testid="chaal-nag-6"]');
		if (!brilliant || !dubious) throw new Error("no symbols");
		await userEvent.click(brilliant);
		await expect(brilliant.getAttribute("aria-pressed")).toBe("true");
		await userEvent.click(dubious);
		await expect(brilliant.getAttribute("aria-pressed")).toBe("false");
		await expect(dubious.getAttribute("aria-pressed")).toBe("true");
		// A variation can be promoted.
		await expect(canvasElement.querySelector('[data-testid="chaal-promote"]')).not.toBeNull();
	},
};

/** While a real-time game is in progress (Task 77 sets it), every Chaal page says why the engine is off. */
function LockedBanner() {
	useEffect(() => {
		setLiveGames(["abcd1234"]);
		return () => setLiveGames([]);
	}, []);
	return <FairPlayBanner />;
}

export const FairPlay: Story = {
	render: () => (
		<Frame>
			<LockedBanner />
			<EnginePanel {...engineProps} status="off" locked />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(canvasElement.querySelector('[data-testid="chaal-fair-play"]')).not.toBeNull());
	},
};
