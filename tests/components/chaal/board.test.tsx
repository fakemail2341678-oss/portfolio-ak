// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Board, type BoardProps } from "@/features/chaal/board/board";
import type { Square } from "@/features/chaal/board/fen";
import { cellOf, type Orientation } from "@/features/chaal/board/geometry";
import { type PlayedMove, START_FEN } from "@/features/chaal/chess/rules";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * Chaal's board (Task 74, decision 0262): click-click, drag, the keyboard grid, promotion,
 * illegal moves, premoves, shapes and what it says. The board is 400 px square here, so a
 * square is 50 px.
 */

const SIZE = 400;

beforeEach(() => {
	overwriteGetLocale(() => "en");
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		left: 0,
		top: 0,
		width: SIZE,
		height: SIZE,
		right: SIZE,
		bottom: SIZE,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	});
});

/** A board that plays what it's given back, as a page does. */
function Harness({ onMove, ...props }: Partial<BoardProps> & { onMove?: (move: PlayedMove) => void }) {
	const [state, setState] = useState<{ fen: string; last: PlayedMove | null }>({
		fen: props.fen ?? START_FEN,
		last: null,
	});
	return (
		<Board
			movable="both"
			{...props}
			fen={state.fen}
			lastMove={state.last}
			onMove={(move) => {
				onMove?.(move);
				setState({ fen: move.fen, last: move });
			}}
		/>
	);
}

const grid = () => screen.getByRole("grid", { name: "Chessboard" });
const said = () => screen.getByTestId("chaal-board-said").textContent;

function point(square: Square, orientation: Orientation = "white") {
	const { col, row } = cellOf(square, orientation);
	return { clientX: col * 50 + 25, clientY: row * 50 + 25 };
}

function click(square: Square, orientation: Orientation = "white") {
	fireEvent.pointerDown(grid(), { ...point(square, orientation), button: 0, pointerId: 1 });
	fireEvent.pointerUp(grid(), { ...point(square, orientation), button: 0, pointerId: 1 });
}

const pieceAt = (square: Square) => document.querySelector(`[data-at="${square}"]`)?.getAttribute("data-piece") ?? null;
const marks = (kind: string) => document.querySelectorAll(`[data-mark="${kind}"]`).length;

describe("Board", () => {
	it("plays a move by clicking the piece and then its target", () => {
		const onMove = vi.fn();
		render(<Harness onMove={onMove} />);
		click("e2");
		expect(marks("dot")).toBe(2);
		expect(screen.getByRole("gridcell", { name: "e2, White Pawn, picked up" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("gridcell", { name: "e4, can move here" })).toBeInTheDocument();
		click("e4");
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "e4", uci: "e2e4" }));
		expect(pieceAt("e4")).toBe("wP");
		expect(pieceAt("e2")).toBeNull();
		expect(marks("dot")).toBe(0);
		expect(said()).toBe("White: Pawn to e4");
	});

	it("plays a move by dragging, and puts a piece back when it's dropped where it can't go", () => {
		const onMove = vi.fn();
		render(<Harness onMove={onMove} />);
		fireEvent.pointerDown(grid(), { ...point("g1"), button: 0, pointerId: 1 });
		fireEvent.pointerMove(grid(), { ...point("g3"), pointerId: 1 });
		fireEvent.pointerUp(grid(), { ...point("g3"), button: 0, pointerId: 1 });
		expect(onMove).not.toHaveBeenCalled();
		expect(pieceAt("g1")).toBe("wN");
		expect(marks("selected")).toBe(0);

		fireEvent.pointerDown(grid(), { ...point("g1"), button: 0, pointerId: 2 });
		fireEvent.pointerMove(grid(), { ...point("f2"), pointerId: 2 });
		// While dragged, the piece follows the pointer instead of sitting on its square.
		expect(document.querySelector('[data-at="g1"]')?.getAttribute("style")).toContain("px");
		fireEvent.pointerMove(grid(), { ...point("f3"), pointerId: 2 });
		fireEvent.pointerUp(grid(), { ...point("f3"), button: 0, pointerId: 2 });
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "Nf3" }));
		expect(pieceAt("f3")).toBe("wN");
	});

	it("plays from the keyboard: arrows move the cursor, Enter picks up and puts down, Escape puts back", () => {
		const onMove = vi.fn();
		render(<Harness onMove={onMove} />);
		const board = grid();
		board.focus();
		expect(board.getAttribute("aria-activedescendant")).toMatch(/-e2$/);
		fireEvent.keyDown(board, { key: "Enter" });
		expect(said()).toBe("Pawn on e2 picked up");
		fireEvent.keyDown(board, { key: "Escape" });
		expect(said()).toBe("Put back");
		expect(marks("selected")).toBe(0);

		fireEvent.keyDown(board, { key: " " });
		fireEvent.keyDown(board, { key: "ArrowUp" });
		fireEvent.keyDown(board, { key: "ArrowUp" });
		expect(board.getAttribute("aria-activedescendant")).toMatch(/-e4$/);
		fireEvent.keyDown(board, { key: "Enter" });
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "e4" }));
		expect(said()).toBe("White: Pawn to e4");
	});

	it("says so when a move isn't legal, and plays nothing", () => {
		const onMove = vi.fn();
		render(<Harness onMove={onMove} />);
		const board = grid();
		board.focus();
		fireEvent.keyDown(board, { key: "Enter" });
		for (let step = 0; step < 3; step++) fireEvent.keyDown(board, { key: "ArrowUp" });
		fireEvent.keyDown(board, { key: "Enter" });
		expect(said()).toBe("Not a legal move");
		expect(onMove).not.toHaveBeenCalled();
		expect(pieceAt("e2")).toBe("wP");
	});

	it("asks which piece a pawn becomes, and cancels on Escape", () => {
		const onMove = vi.fn();
		render(<Harness fen="8/P6k/8/8/8/8/8/K7 w - - 0 1" onMove={onMove} />);
		click("a7");
		click("a8");
		const picker = screen.getByRole("group", { name: "Promote the pawn to" });
		expect(within(picker).getByRole("button", { name: "Queen" })).toHaveFocus();
		fireEvent.keyDown(picker, { key: "Escape" });
		expect(screen.queryByRole("group", { name: "Promote the pawn to" })).toBeNull();
		expect(said()).toBe("Put back");
		expect(onMove).not.toHaveBeenCalled();

		click("a7");
		click("a8");
		fireEvent.click(
			within(screen.getByRole("group", { name: "Promote the pawn to" })).getByRole("button", { name: "Knight" }),
		);
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "a8=N", promotion: "n" }));
		expect(pieceAt("a8")).toBe("wN");
	});

	it("promotes to a queen at once with auto-queen", () => {
		const onMove = vi.fn();
		render(<Harness fen="8/P6k/8/8/8/8/8/K7 w - - 0 1" autoQueen onMove={onMove} />);
		click("a7");
		click("a8");
		expect(screen.queryByTestId("chaal-promotion")).toBeNull();
		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ san: "a8=Q" }));
	});

	it("moves nothing when nothing is movable, and only the player's side otherwise", () => {
		const { unmount } = render(<Harness movable="none" />);
		click("e2");
		expect(marks("selected")).toBe(0);
		unmount();
		render(<Harness movable="black" />);
		click("e2");
		expect(marks("selected")).toBe(0);
	});

	it("sets a premove while the other side is to move", () => {
		const onPremove = vi.fn();
		const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
		const { rerender } = render(<Board fen={afterE4} movable="white" onPremove={onPremove} />);
		click("g1");
		click("f3");
		expect(onPremove).toHaveBeenCalledWith({ from: "g1", to: "f3" });
		rerender(<Board fen={afterE4} movable="white" onPremove={onPremove} premove={{ from: "g1", to: "f3" }} />);
		expect(marks("premove")).toBe(2);
		expect(screen.getByRole("gridcell", { name: "f3, premove" })).toBeInTheDocument();
		click("h6");
		expect(onPremove).toHaveBeenLastCalledWith(null);
	});

	it("speaks the opponent's move when it arrives, not the position it opened on", () => {
		const { rerender } = render(<Board fen={START_FEN} lastMove={null} />);
		expect(said()).toBe("");
		const afterNf3 = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1";
		rerender(<Board fen={afterNf3} lastMove={{ uci: "g1f3", san: "Nf3" }} />);
		expect(said()).toBe("White: Knight to f3");
		expect(screen.getByRole("gridcell", { name: "f3, White Knight, last move" })).toBeInTheDocument();
	});

	it("marks the king in check and names it", () => {
		render(<Board fen="4k3/8/8/8/8/8/8/4R1K1 b - - 0 1" />);
		expect(marks("check")).toBe(1);
		expect(screen.getByRole("gridcell", { name: "e8, Black King, in check" })).toBeInTheDocument();
	});

	it("draws an arrow with a right-drag, and a left click clears the drawing", () => {
		const onShapesChange = vi.fn();
		const { rerender } = render(<Board fen={START_FEN} onShapesChange={onShapesChange} />);
		fireEvent.pointerDown(grid(), { ...point("e2"), button: 2, pointerId: 1 });
		fireEvent.pointerUp(grid(), { ...point("e4"), button: 2, pointerId: 1 });
		expect(onShapesChange).toHaveBeenCalledWith([{ from: "e2", to: "e4", brush: "ink" }]);
		rerender(
			<Board fen={START_FEN} onShapesChange={onShapesChange} shapes={[{ from: "e2", to: "e4", brush: "ink" }]} />,
		);
		expect(document.querySelectorAll("svg line")).toHaveLength(1);
		click("a3");
		expect(onShapesChange).toHaveBeenLastCalledWith([]);
	});

	it("draws from Black's side when flipped", () => {
		render(<Board fen={START_FEN} orientation="black" />);
		const cells = screen.getAllByRole("gridcell");
		expect(cells[0]).toHaveAttribute("data-square", "h1");
		expect(cells[63]).toHaveAttribute("data-square", "a8");
	});

	it("keeps a moved piece's identity, so it slides rather than reappearing", () => {
		const { rerender } = render(<Board fen={START_FEN} />);
		const knight = document.querySelector('[data-at="g1"]');
		const afterNf3 = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1";
		act(() => rerender(<Board fen={afterNf3} />));
		expect(document.querySelector('[data-at="f3"]')).toBe(knight);
	});
});
