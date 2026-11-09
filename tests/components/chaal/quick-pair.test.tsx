// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { START_FEN } from "@/features/chaal/chess/rules";
import type { ChaalEventGame } from "@/features/chaal/live/events";
import type { KeepOptions } from "@/features/chaal/live/reader";
import { createLiveStore, IDLE } from "@/features/chaal/live/store";
import { SEEK_STREAM, useSeek } from "@/features/chaal/play/use-seek";

/**
 * Quick pairing in the page (PLAN Task 78, decision 0267): a seek on a clock is held open
 * by its stream and the new game opens when the event store has it; cancelling stops the
 * stream; a correspondence seek is a call; a refusal is said.
 */

const game = (id: string): ChaalEventGame => ({
	id,
	color: "white",
	fen: START_FEN,
	lastMove: "",
	source: "lobby",
	status: "started",
	variant: "standard",
	speed: "rapid",
	rated: false,
	hasMoved: false,
	isMyTurn: true,
	secondsLeft: 600,
	opponent: { id: "them", name: "Them", title: null, rating: null, aiLevel: null },
	winner: null,
	ratingDiff: null,
	boardCompatible: true,
	tournamentId: null,
});

const RAPID = { kind: "clock", clock: { initial: 600, increment: 5 } } as const;

function setup() {
	const store = createLiveStore({ ...IDLE, status: "open", settled: true, games: [game("oldGame1")] });
	const streams: Array<{ url: string; options: KeepOptions; stopped: boolean }> = [];
	const stream = (url: string, options: KeepOptions) => {
		const entry = { url, options, stopped: false };
		streams.push(entry);
		return {
			stop: () => {
				entry.stopped = true;
			},
		};
	};
	const onGame = vi.fn();
	const seekDays = vi.fn(async () => ({ id: "seek1234" }));
	const hook = renderHook(() => useSeek({ onGame, seekDays, stream, store, now: () => 1_000 }));
	return { store, streams, onGame, seekDays, hook };
}

describe("quick pairing", () => {
	it("a clock's seek posts its input to the seek stream and opens the new game when it arrives", async () => {
		const { store, streams, onGame, hook } = setup();
		await act(() => hook.result.current.start({ pace: RAPID, rated: false, range: "any" }));
		expect(hook.result.current.seek).toEqual({ state: "seeking", key: "600+5", since: 1_000 });
		expect(streams[0]?.url).toBe(SEEK_STREAM);
		expect(JSON.parse(String(streams[0]?.options.init?.body))).toEqual({ pace: RAPID, rated: false, range: "any" });
		act(() => store.set((state) => ({ ...state, games: [...state.games, game("newGame1")] })));
		expect(onGame).toHaveBeenCalledWith("newGame1");
		expect(streams[0]?.stopped).toBe(true);
		expect(hook.result.current.seek).toEqual({ state: "idle" });
	});

	it("cancelling stops the stream; a refusal is said; a correspondence seek is a call", async () => {
		const { streams, seekDays, hook } = setup();
		await act(() => hook.result.current.start({ pace: RAPID, rated: false, range: "any" }));
		act(() => hook.result.current.cancel());
		expect(streams[0]?.stopped).toBe(true);
		await act(() => hook.result.current.start({ pace: RAPID, rated: true, range: "any" }));
		act(() => streams[1]?.options.onStatus?.({ state: "refused", status: 403, error: "FORBIDDEN", reason: null }));
		expect(hook.result.current.seek).toMatchObject({ state: "failed", status: 403 });
		await act(() => hook.result.current.start({ pace: { kind: "days", days: 3 }, rated: false, range: "any" }));
		expect(seekDays).toHaveBeenCalledTimes(1);
		expect(hook.result.current.seek).toEqual({ state: "posted", key: "d3" });
	});
});
