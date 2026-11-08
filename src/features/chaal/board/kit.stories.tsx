import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { expect, waitFor } from "storybook/test";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { readPgn } from "../chess/pgn";
import { createTree, lineFrom, mainline, nodeOf, stepFrom } from "../chess/tree";
import { Board } from "./board";
import { Clock } from "./clock";
import { EvalBar } from "./eval-bar";
import { EvalGraph } from "./eval-graph";
import { GameControls } from "./game-controls";
import { Material } from "./material";
import { MoveList } from "./move-list";
import { OpeningName } from "./opening-name";
import { PlayerStrip } from "./player-strip";
import { ResultBanner } from "./result-banner";

/**
 * The rest of the board kit (Task 74): the move list, players and clocks, the eval, the
 * controls and the result, alone and together as the comps' game screen.
 */

const GAME = (() => {
	const read = readPgn(`[White "Sherpa_77"]
[Black "amrit_k"]

1. e4 { [%eval 0.3] } e5 { [%eval 0.25] } 2. Nf3 { [%eval 0.3] } Nc6 { [%eval 0.3] }
(2... d6 { [%eval 0.5] } 3. d4 (3. Bc4 Be7) 3... exd4 $6) 3. Bc4 { [%eval 0.25] } Bc5 { [%eval 0.3] }
4. c3 { [%eval 0.2] } Nf6 { [%eval 0.25] } 5. d4 { [%eval 0.1] } exd4 { [%eval 0.2] }
6. cxd4 { [%eval 0.15] } Bb4+ $5 { Sharper than it looks. [%eval 0.2] } 7. Bd2 { [%eval 0.1] }
Bxd2+ { [%eval 0.15] } 8. Nbxd2 { [%eval 0.1] } d5 $2 { [%eval 0.9] } *`);
	if (!read.ok) throw new Error(read.reason);
	return read.game.tree;
})();

const LAST = lineFrom(GAME, GAME.root).at(-1)?.id ?? GAME.root;

function Frame({ children, width = "max-w-md" }: { children: ReactNode; width?: string }) {
	return (
		<div className="min-h-dvh bg-ch-ground p-4 text-ch-ink sm:p-6">
			<div className={`mx-auto ${width}`}>{children}</div>
		</div>
	);
}

const meta = {
	title: "Chaal/Kit",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Moves({ layout }: { layout: "tree" | "table" | "strip" }) {
	const [current, setCurrent] = useState(LAST);
	return (
		<Frame>
			<MoveList tree={GAME} current={current} onSelect={setCurrent} layout={layout} className="max-h-80" />
		</Frame>
	);
}

/** Analysis: variations and comments break into the main line's rows. */
export const MoveTree: Story = {
	render: () => <Moves layout="tree" />,
	play: async ({ canvasElement, userEvent }) => {
		const first = canvasElement.querySelector('[data-node="1"]') as HTMLElement;
		await userEvent.click(first);
		await waitFor(() => expect(first).toHaveAttribute("aria-current", "true"));
	},
};

export const MoveTable: Story = { render: () => <Moves layout="table" /> };

/** A phone's live game: one row that scrolls sideways to the move shown. */
export const MoveStrip: Story = { render: () => <Moves layout="strip" /> };

export const NoMoves: Story = {
	render: () => (
		<Frame>
			<MoveList tree={createTree()} current="0" onSelect={() => {}} />
		</Frame>
	),
};

/** Both players with their clocks: the side to move in ink with the bar, low time inverted, material won. */
export const Players: Story = {
	render: () => {
		const fen = nodeOf(GAME, LAST).fen;
		return (
			<Frame>
				<div className="flex flex-col gap-4">
					<PlayerStrip
						name="Sherpa_77"
						color="black"
						rating={1688}
						title="FM"
						material={<Material fen={fen} color="black" />}
					>
						<Clock ms={495_000} color="black" />
					</PlayerStrip>
					<PlayerStrip
						name="amrit_k"
						color="white"
						rating={1642}
						provisional
						active
						material={<Material fen={fen} color="white" />}
					>
						<Clock ms={462_000} color="white" running since={0} />
					</PlayerStrip>
					<PlayerStrip name="Engine level 4" color="black" active>
						<Clock ms={8_400} color="black" running />
					</PlayerStrip>
				</div>
			</Frame>
		);
	},
};

export const Evaluation: Story = {
	render: () => {
		const line = mainline(GAME);
		return (
			<Frame>
				<div className="flex h-72 gap-4">
					<EvalBar score={{ cp: 35 }} />
					<EvalBar score={{ mate: -3 }} />
					<EvalBar score={{ cp: 120 }} orientation="black" />
					<div className="flex flex-1 flex-col gap-4">
						<EvalBar score={{ cp: -80 }} direction="horizontal" />
						<EvalGraph scores={line.map((node) => node.eval ?? null)} current={8} onSelect={() => {}} />
					</div>
				</div>
			</Frame>
		);
	},
};

/** The opening's name and ECO code, as the explorer gives them (Task 75); its line stays while one arrives. */
export const Opening: Story = {
	render: () => (
		<Frame>
			<div className="flex flex-col gap-2">
				<OpeningName opening={{ eco: "C65", name: "Ruy Lopez: Berlin Defense" }} />
				<OpeningName opening={{ eco: "B90", name: "Sicilian Defense: Najdorf Variation, English Attack" }} />
				<OpeningName opening={null} />
				<OpeningName opening={null} pending />
			</div>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const names = canvasElement.querySelectorAll('[data-testid="chaal-opening"]');
		await expect(names).toHaveLength(4);
		await expect(names[0]?.querySelector("[lang=en]")?.textContent).toBe("Ruy Lopez: Berlin Defense");
	},
};

export const Results: Story = {
	render: () => (
		<Frame>
			<ResultBanner result="1-0" reason="checkmate" />
			<ResultBanner result="1/2-1/2" reason="insufficient" />
			<ResultBanner result="0-1" />
		</Frame>
	),
};

/** The comps' game screen, put together from the kit: board first, the players, the moves, the controls. */
export const GameScreen: Story = { render: () => <GameScreenDemo /> };

function GameScreenDemo() {
	const [current, setCurrent] = useState(LAST);
	const [orientation, setOrientation] = useState<"white" | "black">("white");
	const node = nodeOf(GAME, current);
	const top = orientation === "white" ? "black" : "white";
	return (
		<div className="min-h-dvh bg-ch-ground p-4 text-ch-ink sm:p-6">
			<div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
				<Board
					fen={node.fen}
					orientation={orientation}
					lastMove={node.uci ? { uci: node.uci, san: node.san ?? undefined } : null}
				/>
				<div className="flex flex-col gap-3">
					<PlayerStrip name="Sherpa_77" color={top} rating={1688} material={<Material fen={node.fen} color={top} />}>
						<Clock ms={495_000} color={top} />
					</PlayerStrip>
					<p className="ch-rule flex justify-between pt-2 text-sm">
						<span className="font-semibold">Italian Game: Giuoco Piano</span>
						<span className="text-ch-muted">10+0</span>
					</p>
					<MoveList tree={GAME} current={current} onSelect={setCurrent} className="max-h-72" />
					<GameControls
						onStep={(step) => setCurrent(stepFrom(GAME, current, step))}
						canBack={current !== GAME.root}
						canForward={node.children.length > 0}
						onFlip={() => setOrientation(top)}
						className="ch-rule pt-2"
					/>
					<PlayerStrip
						name="amrit_k"
						color={orientation}
						rating={1642}
						active
						material={<Material fen={node.fen} color={orientation} />}
					>
						<Clock ms={462_000} color={orientation} />
					</PlayerStrip>
				</div>
			</div>
		</div>
	);
}
