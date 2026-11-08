// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type PlayedMove, play } from "@/features/chaal/chess/rules";
import type { Engine, SearchResult } from "@/features/chaal/engine/engine";
import { readBrowserGame } from "@/features/chaal/local/browser";
import { addLocalMove, fenOf, newLocalGame } from "@/features/chaal/local/game";
import type { LocalGame } from "@/features/chaal/local/types";
import { useLocalGame } from "@/features/chaal/local/use-local-game";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * A local game in the browser (PLAN Task 76): the computer answers at its level and waits
 * while fair play locks it, the clocks run from the first move and a flag ends the game, a
 * takeback puts the clocks back, a game opened again starts paused, and every change is
 * kept in this browser without a session.
 */
const ID = "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const AT = new Date("2026-11-09T10:00:00.000Z");
let clock = 0;

beforeEach(() => {
	overwriteGetLocale(() => "en");
	window.localStorage.clear();
	clock = 1_000;
	vi.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Timers only: performance.now stays the test's own clock. */
const fakeTimers = () =>
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask"] });

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

/** A computer that plays what the test gives it, and counts what it's asked. */
function fakeComputer(answers: string[]) {
	const asked: Array<{ fen: string; level: number }> = [];
	const engine: Engine & { asked: typeof asked } = {
		asked,
		ready: Promise.resolve(),
		analyse: async () => ({ bestMove: null, stopped: true }),
		bestMove: async (fen, { level }): Promise<SearchResult> => {
			asked.push({ fen, level });
			return { bestMove: answers.shift() ?? null, stopped: false };
		},
		stop: () => {},
		quit: () => {},
	};
	return engine;
}

const moveOf = (game: LocalGame, uci: string) => play(fenOf(game), uci) as PlayedMove;

describe("a local game", () => {
	it("the computer answers at its level, and the game is kept in this browser", async () => {
		fakeTimers();
		const engine = fakeComputer(["e7e5"]);
		const initial = newLocalGame({ mode: "engine", level: 5, color: "white", clock: null }, ID, AT);
		const { result } = renderHook(() => useLocalGame({ initial, signedIn: false, createEngine: () => engine }), {
			wrapper,
		});
		await act(async () => {
			await vi.runOnlyPendingTimersAsync();
		});
		expect(result.current.movable).toBe("white");
		act(() => result.current.move(moveOf(result.current.game, "e2e4")));
		expect(result.current.movable).toBeNull();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(400);
		});
		expect(engine.asked).toEqual([
			{ fen: fenOf({ ...initial, moves: result.current.game.moves.slice(0, 1) }), level: 5 },
		]);
		expect(result.current.game.moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5"]);
		expect(result.current.movable).toBe("white");
		expect(readBrowserGame(ID)?.pgn).toContain("1. e4 e5");
	});

	it("waits while fair play locks the engine", async () => {
		fakeTimers();
		const engine = fakeComputer(["e2e4"]);
		const initial = newLocalGame({ mode: "engine", level: 1, color: "black", clock: null }, ID, AT);
		const { result, rerender } = renderHook(
			({ locked }) => useLocalGame({ initial, signedIn: false, locked, createEngine: () => engine }),
			{ wrapper, initialProps: { locked: true } },
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1_000);
		});
		expect(engine.asked).toHaveLength(0);
		expect(result.current.computer.status).toBe("waiting");
		rerender({ locked: false });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(400);
		});
		expect(result.current.game.moves.map((move) => move.uci)).toEqual(["e2e4"]);
	});

	it("runs the clocks from the first move, adds the increment, and a flag ends the game", async () => {
		fakeTimers();
		const initial = newLocalGame({ mode: "board", clock: { initial: 5, increment: 2 }, layout: "flip" }, ID, AT);
		const { result } = renderHook(() => useLocalGame({ initial, signedIn: false }), { wrapper });
		expect(result.current.clock?.running).toBeNull();
		clock += 3_000;
		act(() => result.current.move(moveOf(result.current.game, "e2e4")));
		// White's clock didn't run before its first move; it gets its increment.
		expect(result.current.clock).toMatchObject({ white: 7_000, black: 5_000, running: "black" });
		clock += 1_500;
		act(() => result.current.move(moveOf(result.current.game, "e7e5")));
		expect(result.current.clock).toMatchObject({ white: 7_000, black: 5_500, running: "white" });
		// A takeback puts the clocks back to after White's move.
		act(() => result.current.takeBack());
		expect(result.current.game.moves).toHaveLength(1);
		expect(result.current.clock).toMatchObject({ white: 7_000, black: 5_000, running: "black" });
		clock += 6_000;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		expect(result.current.game).toMatchObject({ result: "1-0", reason: "timeout" });
		expect(result.current.clock).toMatchObject({ black: 0, running: null });
		expect(readBrowserGame(ID)?.status).toBe("ended");
	});

	it("a game opened again with a clock starts paused, and Continue starts the side to move", () => {
		const fresh = newLocalGame({ mode: "board", clock: { initial: 60, increment: 0 }, layout: "tablet" }, ID, AT);
		const initial = addLocalMove(fresh, moveOf(fresh, "d2d4"), { white: 55_000, black: 60_000 }, AT);
		const { result } = renderHook(() => useLocalGame({ initial, signedIn: false }), { wrapper });
		expect(result.current.paused).toBe(true);
		expect(result.current.movable).toBeNull();
		act(() => result.current.resume());
		expect(result.current.paused).toBe(false);
		expect(result.current.clock).toMatchObject({ white: 55_000, black: 60_000, running: "black" });
		expect(result.current.movable).toBe("black");
		clock += 10_000;
		act(() => result.current.pause());
		expect(result.current.clock).toMatchObject({ black: 50_000, running: null });
	});

	it("resigns and agrees draws over the board", () => {
		const initial = newLocalGame({ mode: "board", clock: null, layout: "flip" }, ID, AT);
		const { result } = renderHook(() => useLocalGame({ initial, signedIn: false }), { wrapper });
		act(() => result.current.resign("white"));
		expect(result.current.game).toMatchObject({ result: "0-1", reason: "resign" });
		expect(result.current.movable).toBeNull();
		act(() => result.current.agreeDraw());
		expect(result.current.game.reason).toBe("resign");
	});
});
