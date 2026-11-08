// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "@/features/chaal/board/clock";
import { EvalBar } from "@/features/chaal/board/eval-bar";
import { EvalGraph } from "@/features/chaal/board/eval-graph";
import { GameControls, type Step, useBoardKeys } from "@/features/chaal/board/game-controls";
import { Material } from "@/features/chaal/board/material";
import { MoveInput } from "@/features/chaal/board/move-input";
import { MoveList } from "@/features/chaal/board/move-list";
import { PlayerStrip } from "@/features/chaal/board/player-strip";
import { ResultBanner } from "@/features/chaal/board/result-banner";
import { readPgn } from "@/features/chaal/chess/pgn";
import { START_FEN } from "@/features/chaal/chess/rules";
import { mainline } from "@/features/chaal/chess/tree";
import { overwriteGetLocale } from "@/paraglide/runtime";

/** The rest of Chaal's board kit (Task 74): typing moves, the move list, clocks, controls, evals, material, results. */

beforeEach(() => overwriteGetLocale(() => "en"));

const treeOf = (pgn: string) => {
	const read = readPgn(pgn);
	if (!read.ok) throw new Error(read.reason);
	return read.game.tree;
};

describe("MoveInput", () => {
	it("plays a typed move, says why one isn't legal, and offers the legal ones", async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		render(<MoveInput fen={START_FEN} onMove={onMove} />);
		const field = screen.getByRole("textbox", { name: "Type a move" });
		await user.type(field, "nf3{Enter}");
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "Nf3" }));
		expect(field).toHaveValue("");

		await user.type(field, "e5{Enter}");
		expect(screen.getByRole("alert")).toHaveTextContent("e5 isn't a legal move here");
		expect(field).toHaveAttribute("aria-invalid", "true");

		await user.clear(field);
		await user.type(field, "n");
		const offered = within(screen.getByRole("list", { name: "Legal moves" })).getAllByRole("button");
		expect(offered.map((button) => button.textContent)).toEqual(["♘a3", "♘c3", "♘f3", "♘h3"]);
		await user.click(screen.getByRole("button", { name: "♘c3" }));
		expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ san: "Nc3" }));
	});

	it("is focused by /", async () => {
		const user = userEvent.setup();
		render(<MoveInput fen={START_FEN} onMove={() => {}} />);
		await user.keyboard("/");
		expect(screen.getByRole("textbox", { name: "Type a move" })).toHaveFocus();
	});
});

describe("MoveList", () => {
	const tree = treeOf("1. e4 e5 (1... c5 { the Sicilian } 2. Nf3) 2. Nf3 $1 Nc6 *");
	const [e4, e5, nf3] = mainline(tree);

	it("shows the main line with its variations in a tree, and picks a move", () => {
		const onSelect = vi.fn();
		render(<MoveList tree={tree} current={nf3?.id as string} onSelect={onSelect} layout="tree" />);
		const shown = screen.getByRole("button", { current: true });
		expect(shown).toHaveAccessibleName("♘f3!");
		expect(shown).toHaveTextContent("♘f3!");
		expect(shown).toHaveAttribute("tabindex", "0");
		expect(screen.getByText("the Sicilian")).toBeInTheDocument();
		// The variation's first move carries its number; a move is named as it's shown (label in name).
		fireEvent.click(screen.getByRole("button", { name: "1…c5" }));
		expect(onSelect).toHaveBeenCalledWith(expect.any(String));
		fireEvent.click(screen.getByRole("button", { name: "e5" }));
		expect(onSelect).toHaveBeenLastCalledWith(e5?.id);
	});

	it("shows only the main line in a table or a strip", () => {
		const { unmount } = render(<MoveList tree={tree} current={e4?.id as string} onSelect={() => {}} />);
		expect(screen.getAllByRole("button")).toHaveLength(4);
		expect(screen.queryByText("the Sicilian")).toBeNull();
		unmount();
		render(<MoveList tree={tree} current={e4?.id as string} onSelect={() => {}} layout="strip" notation="letters" />);
		expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["1.e4", "e5", "2.Nf3!", "Nc6"]);
	});

	it("says when there are no moves", () => {
		render(<MoveList tree={treeOf("*")} current="0" onSelect={() => {}} />);
		expect(screen.getByText("No moves yet")).toBeInTheDocument();
	});
});

describe("Clock", () => {
	it("counts down from the time it was given, and turns low under ten seconds", () => {
		vi.useFakeTimers();
		try {
			render(<Clock ms={12_000} color="white" running since={performance.now()} />);
			const clock = screen.getByRole("timer");
			expect(clock).toHaveTextContent("0:12");
			act(() => vi.advanceTimersByTime(3_000));
			expect(clock).toHaveTextContent("0:09.0");
			expect(clock).toHaveAttribute("data-low", "true");
			expect(clock).toHaveAccessibleName("White's clock: 9.0 s");
		} finally {
			vi.useRealTimers();
		}
	});

	it("stands still when it isn't running", () => {
		render(<Clock ms={495_000} color="black" />);
		expect(screen.getByRole("timer")).toHaveAccessibleName("Black's clock: 8 min 15 s");
	});
});

function Controls({ onStep, onFlip }: { onStep: (step: Step) => void; onFlip: () => void }) {
	useBoardKeys({ onStep, onFlip });
	return <GameControls onStep={onStep} canBack={false} canForward onFlip={onFlip} />;
}

describe("GameControls", () => {
	it("steps from its buttons and the keyboard, and flips with f", async () => {
		const user = userEvent.setup();
		const onStep = vi.fn();
		const onFlip = vi.fn();
		render(<Controls onStep={onStep} onFlip={onFlip} />);
		expect(screen.getByRole("button", { name: "Previous move" })).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Last move" }));
		expect(onStep).toHaveBeenLastCalledWith("last");
		await user.keyboard("{ArrowLeft}");
		expect(onStep).toHaveBeenLastCalledWith("prev");
		await user.keyboard("{Home}");
		expect(onStep).toHaveBeenLastCalledWith("first");
		await user.keyboard("f");
		expect(onFlip).toHaveBeenCalled();
	});
});

describe("PlayerStrip, Material, the eval and the result", () => {
	it("names the player and their side, links a Lichess profile as other people's content, and shows what they lead by", () => {
		const fen = "4k3/pp6/8/8/8/8/P7/1N2K3 w - - 0 1";
		render(
			<PlayerStrip
				name="Sherpa_77"
				color="white"
				title="FM"
				rating={1688}
				href="https://lichess.org/@/Sherpa_77"
				active
				material={<Material fen={fen} color="white" />}
			/>,
		);
		const link = screen.getByRole("link", { name: "Sherpa_77" });
		expect(link).toHaveAttribute("rel", "nofollow ugc noopener");
		expect(screen.getByText("To move")).toBeInTheDocument();
		expect(screen.getByText("White is 2 up")).toBeInTheDocument();
	});

	it("reads the eval bar and the graph", () => {
		const onSelect = vi.fn();
		render(
			<>
				<EvalBar score={{ cp: 35 }} />
				<EvalGraph scores={[{ cp: 20 }, { cp: 35 }, { mate: 2 }]} current={1} onSelect={onSelect} />
			</>,
		);
		const meter = screen.getByRole("meter", { name: "Evaluation" });
		expect(meter).toHaveAttribute("aria-valuetext", "+0.35");
		const graph = screen.getByRole("slider", { name: "Evaluation through the game" });
		expect(graph).toHaveAttribute("aria-valuetext", "2: +0.35");
		fireEvent.keyDown(graph, { key: "ArrowRight" });
		expect(onSelect).toHaveBeenCalledWith(2);
		fireEvent.keyDown(graph, { key: "Home" });
		expect(onSelect).toHaveBeenLastCalledWith(-1);
	});

	it("announces the result", () => {
		render(<ResultBanner result="0-1" reason="checkmate" />);
		expect(screen.getByRole("status")).toHaveTextContent("Black wins · Checkmate");
	});
});
