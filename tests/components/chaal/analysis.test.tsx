// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnginePanel } from "@/features/chaal/analysis/engine-panel";
import { NodeTools } from "@/features/chaal/analysis/node-tools";
import { TablebasePanel } from "@/features/chaal/analysis/tablebase-panel";
import { OpeningName } from "@/features/chaal/board/opening-name";
import { START_FEN } from "@/features/chaal/chess/rules";
import { createTree, nodeOf, playOn } from "@/features/chaal/chess/tree";
import type { Engine, SearchResult } from "@/features/chaal/engine/engine";
import { DEFAULT_ENGINE_LIMITS } from "@/features/chaal/engine/limits";
import type { EngineInfo } from "@/features/chaal/engine/uci";
import { useEngine } from "@/features/chaal/engine/use-engine";
import { setLiveGames, useFairPlay } from "@/features/chaal/live/fair-play";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * The analysis board's parts in the browser (PLAN Task 75): the engine's lifecycle on a
 * page (on demand, held back, paused when hidden, ended on leave), fair play's lock, and
 * the panels: lines, the tablebase, the move tools, the opening's name.
 */

beforeEach(() => overwriteGetLocale(() => "en"));
afterEach(() => setLiveGames([]));

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** An engine that answers what the test tells it to. */
function fakeEngine() {
	const searches: Array<{ fen: string; onInfo: (info: EngineInfo) => void; done: (result: SearchResult) => void }> = [];
	const engine: Engine & { searches: typeof searches; quits: number; stops: number } = {
		searches,
		quits: 0,
		stops: 0,
		ready: Promise.resolve(),
		analyse: (fen, _options, onInfo) =>
			new Promise((done) => {
				searches.push({ fen, onInfo, done });
			}),
		bestMove: async () => ({ bestMove: null, stopped: true }),
		stop: () => {
			engine.stops += 1;
			for (const search of searches.splice(0)) search.done({ bestMove: null, stopped: true });
		},
		quit: () => {
			engine.quits += 1;
		},
	};
	return engine;
}

const info = (depth: number, multipv: number, cp: number, pv: string[]): EngineInfo => ({
	depth,
	seldepth: null,
	multipv,
	score: { cp },
	pv,
	nodes: null,
	nps: null,
	time: null,
});

describe("the engine on a page", () => {
	it("starts on demand, streams lines for the position, settles, and ends when the page goes", async () => {
		vi.useFakeTimers();
		try {
			const engine = fakeEngine();
			const progress = vi.fn();
			const make = (onProgress: (loaded: number, total: number) => void) => {
				onProgress(5, 10);
				progress();
				return engine;
			};
			const { result, rerender, unmount } = renderHook(
				({ fen }) => useEngine({ fen, limits: DEFAULT_ENGINE_LIMITS, createEngine: make }),
				{ initialProps: { fen: START_FEN } },
			);
			expect(result.current.status).toBe("off");
			expect(progress).not.toHaveBeenCalled();
			await act(async () => result.current.start());
			expect(result.current.status).toBe("running");
			expect(engine.searches[0]?.fen).toBe(START_FEN);
			act(() => {
				engine.searches[0]?.onInfo(info(10, 1, 30, ["e2e4", "e7e5"]));
				engine.searches[0]?.onInfo(info(10, 2, 20, ["d2d4"]));
			});
			await act(async () => vi.advanceTimersByTimeAsync(200));
			expect(result.current.lines.map((line) => line.score)).toEqual([{ cp: 30 }, { cp: 20 }]);
			expect(result.current.depth).toBe(10);
			await act(async () => engine.searches[0]?.done({ bestMove: "e2e4", stopped: false }));
			expect(result.current.status).toBe("done");
			expect(result.current.settled).toEqual({ fen: START_FEN, score: { cp: 30 }, depth: 10 });
			// A new position starts a new search; the old lines aren't shown for it.
			rerender({ fen: AFTER_E4 });
			expect(result.current.lines).toEqual([]);
			expect(engine.searches.at(-1)?.fen).toBe(AFTER_E4);
			unmount();
			expect(engine.quits).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("is held back while skipped (a cloud answer, fair play) and paused while the tab is hidden", async () => {
		const engine = fakeEngine();
		const { result, rerender } = renderHook(
			({ skip }) => useEngine({ fen: START_FEN, limits: DEFAULT_ENGINE_LIMITS, skip, createEngine: () => engine }),
			{ initialProps: { skip: true } },
		);
		await act(async () => result.current.start());
		expect(engine.searches).toHaveLength(0);
		expect(result.current.status).toBe("done");
		rerender({ skip: false });
		expect(engine.searches).toHaveLength(1);
		const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current.status).toBe("paused");
		expect(engine.stops).toBeGreaterThan(0);
		visibility.mockReturnValue("visible");
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(result.current.status).toBe("running");
		act(() => result.current.stop());
		expect(result.current.status).toBe("off");
	});

	it("says it failed when the engine can't start", async () => {
		const engine = { ...fakeEngine(), ready: Promise.reject(new Error("no wasm")) };
		const { result } = renderHook(() =>
			useEngine({ fen: START_FEN, limits: DEFAULT_ENGINE_LIMITS, createEngine: () => engine }),
		);
		await act(async () => result.current.start());
		expect(result.current.status).toBe("failed");
	});
});

describe("fair play", () => {
	it("locks while a real-time game is in progress, and lifts when none is", () => {
		const { result } = renderHook(() => useFairPlay());
		expect(result.current).toEqual({ locked: false, games: 0 });
		act(() => setLiveGames(["abcd1234"]));
		expect(result.current).toEqual({ locked: true, games: 1 });
		act(() => setLiveGames([]));
		expect(result.current.locked).toBe(false);
	});
});

describe("the panels", () => {
	it("the engine's lines play up to the move picked; fair play shows why instead", () => {
		const onPlayLine = vi.fn();
		const props = {
			fen: START_FEN,
			status: "running" as const,
			progress: 1,
			lines: [{ score: { cp: 35 }, moves: ["e2e4", "e7e5", "g1f3"] }],
			depth: 18,
			source: "local" as const,
			locked: false,
			notation: "letters" as const,
			onToggle: vi.fn(),
			onPlayLine,
		};
		const { rerender } = render(<EnginePanel {...props} />);
		expect(screen.getByTestId("chaal-engine-score").textContent).toBe("+0.35");
		expect(screen.getByTestId("chaal-engine-where").textContent).toContain("18");
		fireEvent.click(screen.getByRole("button", { name: /Nf3/ }));
		expect(onPlayLine).toHaveBeenCalledWith(["e2e4", "e7e5", "g1f3"]);
		rerender(<EnginePanel {...props} locked />);
		expect(screen.queryByTestId("chaal-engine-lines")).toBeNull();
		expect(screen.getByRole("switch")).toHaveProperty("disabled", true);
	});

	it("the tablebase lists each move's result, and says when there are too many pieces", () => {
		const onPlay = vi.fn();
		const tablebase = {
			result: "win" as const,
			dtz: 1,
			dtm: 17,
			checkmate: false,
			stalemate: false,
			insufficientMaterial: false,
			moves: [
				{ uci: "h7h8q", san: "h8=Q+", result: "win" as const, dtz: 2, dtm: 16 },
				{ uci: "g7f6", san: "Kf6", result: "draw" as const, dtz: 0, dtm: null },
			],
		};
		const { rerender } = render(
			<TablebasePanel
				result={tablebase}
				pending={false}
				error={null}
				tooMany={false}
				notation="letters"
				locked={false}
				onPlay={onPlay}
			/>,
		);
		expect(screen.getByTestId("chaal-tablebase").textContent).toContain("DTM 17");
		fireEvent.click(screen.getByRole("button", { name: /Kf6/ }));
		expect(onPlay).toHaveBeenCalledWith("g7f6");
		rerender(
			<TablebasePanel
				result={undefined}
				pending={false}
				error={null}
				tooMany
				notation="letters"
				locked={false}
				onPlay={onPlay}
			/>,
		);
		expect(screen.getByText(/seven pieces or fewer/)).toBeTruthy();
	});

	it("the move tools toggle symbols, write a comment and delete", () => {
		const tree = playOn(createTree(), "0", "e4");
		if (!tree) throw new Error("e4");
		const onToggleNag = vi.fn();
		const onComment = vi.fn();
		const onDelete = vi.fn();
		render(
			<NodeTools
				tree={tree.tree}
				node={nodeOf(tree.tree, tree.id)}
				notation="letters"
				onToggleNag={onToggleNag}
				onComment={onComment}
				onPromote={vi.fn()}
				onMakeMain={vi.fn()}
				onDelete={onDelete}
			/>,
		);
		fireEvent.click(screen.getByTestId("chaal-nag-3"));
		expect(onToggleNag).toHaveBeenCalledWith(3);
		// On the main line already: nothing to promote.
		expect(screen.queryByTestId("chaal-promote")).toBeNull();
		fireEvent.click(screen.getByTestId("chaal-comment"));
		fireEvent.change(screen.getByTestId("chaal-comment-text"), { target: { value: "The best start." } });
		fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
		expect(onComment).toHaveBeenCalledWith("The best start.");
		fireEvent.click(screen.getByTestId("chaal-delete-move"));
		expect(onDelete).toHaveBeenCalled();
	});

	it("the opening's name keeps its line, in English", () => {
		const { rerender } = render(<OpeningName opening={{ eco: "C60", name: "Ruy Lopez" }} />);
		expect(screen.getByTestId("chaal-opening").textContent).toBe("C60Ruy Lopez");
		expect(screen.getByText("Ruy Lopez").getAttribute("lang")).toBe("en");
		rerender(<OpeningName opening={null} />);
		expect(screen.getByTestId("chaal-opening").textContent).toBe("Not a named opening");
		rerender(<OpeningName opening={null} pending />);
		expect(screen.getByTestId("chaal-opening").textContent).toBe("");
	});
});
