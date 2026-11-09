// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { play } from "@/features/chaal/chess/rules";
import { liveGameOf, shownMoves } from "@/features/chaal/game/live-game";
import { type LiveCalls, useLiveGame } from "@/features/chaal/game/use-live-game";
import type { ChaalGameFull, ChaalGameState } from "@/features/chaal/live/events";
import type { KeepOptions } from "@/features/chaal/live/reader";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * A game on Lichess in the page (PLAN Task 77, decision 0266): the player's move shows at
 * once and goes back when Lichess refuses it, one premove is played when the turn comes,
 * the stream's lines move the game on (a reconnect restates it), and the stream stops when
 * the game is over.
 */

const STATE = (overrides: Partial<ChaalGameState> = {}): ChaalGameState => ({
	moves: [],
	wtime: 600_000,
	btime: 600_000,
	winc: 0,
	binc: 0,
	status: "started",
	winner: null,
	wdraw: false,
	bdraw: false,
	wtakeback: false,
	btakeback: false,
	expiration: null,
	...overrides,
});

const FULL: ChaalGameFull = {
	id: "game1234",
	rated: false,
	speed: "rapid",
	variant: "standard",
	clock: { initial: 600_000, increment: 0 },
	daysPerTurn: null,
	initialFen: null,
	white: { id: "me", name: "Me", title: null, rating: 1500, provisional: false, aiLevel: null, ratingDiff: null },
	black: { id: "them", name: "Them", title: null, rating: 1500, provisional: false, aiLevel: null, ratingDiff: null },
	state: STATE(),
	tournamentId: null,
	createdAt: 0,
};

/** A stream the test drives: what the hook asked for, and a way to send it lines and statuses. */
function fakeStream() {
	const opened: Array<{ url: string; options: KeepOptions; stopped: boolean }> = [];
	const stream = (url: string, options: KeepOptions) => {
		const entry = { url, options, stopped: false };
		opened.push(entry);
		return {
			stop: () => {
				entry.stopped = true;
			},
		};
	};
	const current = () => opened.at(-1);
	return { stream, opened, push: (value: unknown) => act(() => current()?.options.onLine(value)), current };
}

const calls = (): LiveCalls & { move: ReturnType<typeof vi.fn> } => ({
	move: vi.fn(async () => {}),
	act: vi.fn(async () => {}),
	chat: vi.fn(async () => {}),
});

beforeEach(() => overwriteGetLocale(() => "en"));
afterEach(() => vi.restoreAllMocks());

describe("a game on Lichess", () => {
	it("shows the player's move at once, keeps it when Lichess has it, and takes it back when Lichess refuses one", async () => {
		const fake = fakeStream();
		const api = calls();
		const { result } = renderHook(() =>
			useLiveGame({ initial: liveGameOf(FULL, "white", 0), calls: api, stream: fake.stream }),
		);
		expect(fake.current()?.url).toBe("/api/chaal/stream/game/game1234");
		act(() => result.current.move(play(result.current.game.startFen, "e2e4") ?? never()));
		expect(shownMoves(result.current.game).map((move) => move.san)).toEqual(["e4"]);
		expect(api.move).toHaveBeenCalledWith("game1234", "e2e4");
		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4"] }) });
		expect(result.current.game.pending).toBeNull();
		expect(result.current.game.moves).toHaveLength(1);

		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4", "e7e5"] }) });
		api.move.mockRejectedValueOnce(Object.assign(new Error("illegal"), { code: "BAD_REQUEST" }));
		await act(async () => {
			result.current.move(play(shownMoves(result.current.game).at(-1)?.fen ?? "", "g1f3") ?? never());
		});
		expect(result.current.game.pending).toBeNull();
		expect(shownMoves(result.current.game)).toHaveLength(2);
	});

	it("a premove is played when the turn comes, if it's legal then", async () => {
		const fake = fakeStream();
		const api = calls();
		const { result } = renderHook(() =>
			useLiveGame({ initial: liveGameOf(FULL, "black", 0), calls: api, stream: fake.stream }),
		);
		act(() => result.current.setPremove({ from: "e7", to: "e5" }));
		expect(api.move).not.toHaveBeenCalled();
		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4"] }) });
		expect(api.move).toHaveBeenCalledWith("game1234", "e7e5");
		expect(result.current.premove).toBeNull();
		// One that isn't legal when the turn comes (the pawn on e5 blocked by e4) is dropped.
		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4", "e7e5"] }) });
		act(() => result.current.setPremove({ from: "e5", to: "e4" }));
		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4", "e7e5", "g1f3"] }) });
		expect(api.move).toHaveBeenCalledTimes(1);
		expect(result.current.premove).toBeNull();
	});

	it("a reconnect restates the game; the link's state follows the stream, and it stops when the game is over", () => {
		const fake = fakeStream();
		const { result } = renderHook(() =>
			useLiveGame({ initial: liveGameOf(FULL, "white", 0), calls: calls(), stream: fake.stream }),
		);
		act(() => fake.current()?.options.onStatus?.({ state: "open" }));
		expect(result.current.link).toBe("open");
		act(() => fake.current()?.options.onStatus?.({ state: "waiting", retryInMs: 1_000 }));
		expect(result.current.link).toBe("offline");
		expect(result.current.downSince).not.toBeNull();
		fake.push({ type: "gameFull", game: { ...FULL, state: STATE({ moves: ["e2e4", "c7c5"] }) } });
		act(() => fake.current()?.options.onStatus?.({ state: "open" }));
		expect(result.current.game.moves.map((move) => move.san)).toEqual(["e4", "c5"]);
		expect(result.current.downSince).toBeNull();
		fake.push({ type: "gameState", state: STATE({ moves: ["e2e4", "c7c5"], status: "resign", winner: "white" }) });
		expect(fake.opened[0]?.stopped).toBe(true);
	});

	it("actions and chat go to Lichess; a refused one says so and answers false", async () => {
		const fake = fakeStream();
		const api = calls();
		const { result } = renderHook(() =>
			useLiveGame({ initial: liveGameOf(FULL, "white", 0), calls: api, stream: fake.stream }),
		);
		await act(async () => {
			expect(await result.current.act("draw-offer")).toBe(true);
		});
		expect(api.act).toHaveBeenCalledWith("game1234", "draw-offer");
		vi.mocked(api.chat).mockRejectedValueOnce(new Error("no"));
		await act(async () => {
			expect(await result.current.sendChat("hi")).toBe(false);
		});
	});
});

function never(): never {
	throw new Error("not a legal move");
}
