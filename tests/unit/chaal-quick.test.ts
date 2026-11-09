import { afterEach, describe, expect, it, vi } from "vitest";
import { START_FEN } from "@/features/chaal/chess/rules";
import { canBerserk, liveGameOf } from "@/features/chaal/game/live-game";
import type { ChaalEvent, ChaalEventGame, ChaalGameFull } from "@/features/chaal/live/events";
import { type ChannelLike, PLAYING_EVERY_MS, startLiveEvents } from "@/features/chaal/live/events-client";
import { newNotices } from "@/features/chaal/live/notices";
import type { KeepOptions } from "@/features/chaal/live/reader";
import {
	applyEvent,
	applyPlaying,
	createLiveStore,
	IDLE,
	incomingChallenges,
	type LiveState,
	markStale,
	myTurnGames,
	orderGames,
	secondsLeftOf,
	settle,
} from "@/features/chaal/live/store";
import { QUICK_PAIRS, ratingRangeOf, seekLegal } from "@/features/chaal/play/controls";
import { seekInput } from "@/features/chaal/play/schema";
import { PLAY_PAGE } from "@/features/chaal/shell/zen";

/**
 * Online play II in the browser (PLAN Task 78, decision 0267): what may be sought, the
 * rating range, the games in progress in the event store (their order, time left, the
 * player's move), what's worth a notice, the tab leader reading the games in progress and
 * sharing them, berserk, and the pages zen applies to.
 */

const game = (id: string, overrides: Partial<ChaalEventGame> = {}): ChaalEventGame => ({
	id,
	color: "white",
	fen: START_FEN,
	lastMove: "",
	source: "lobby",
	status: "started",
	variant: "standard",
	speed: "correspondence",
	rated: false,
	hasMoved: true,
	isMyTurn: false,
	secondsLeft: 259_200,
	opponent: { id: "them", name: "Them", title: null, rating: null, aiLevel: null },
	winner: null,
	ratingDiff: null,
	boardCompatible: true,
	tournamentId: null,
	...overrides,
});

const challenge = (id: string, from = "them"): ChaalEvent => ({
	type: "challenge",
	challenge: {
		id,
		status: "created",
		challenger: { id: from, name: from, title: null, rating: null, aiLevel: null },
		destUser: { id: from === "me" ? "them" : "me", name: "x", title: null, rating: null, aiLevel: null },
		variant: "standard",
		rated: false,
		speed: "correspondence",
		timeControl: { type: "correspondence", limit: null, increment: null, daysPerTurn: 3 },
		color: "random",
		finalColor: null,
		declineReasonKey: null,
	},
});

const settled = (state: Partial<LiveState> = {}): LiveState => ({ ...IDLE, status: "open", settled: true, ...state });

describe("what quick pairing may seek", () => {
	it("rapid or slower, whole minutes up to 180, increments up to 180 s; every tile is one", () => {
		expect(seekLegal({ initial: 600, increment: 0 })).toBe(true);
		expect(seekLegal({ initial: 10_800, increment: 180 })).toBe(true);
		// Blitz, part minutes, past the limits, nothing at all.
		expect(seekLegal({ initial: 300, increment: 3 })).toBe(false);
		expect(seekLegal({ initial: 630, increment: 0 })).toBe(false);
		expect(seekLegal({ initial: 10_860, increment: 0 })).toBe(false);
		expect(seekLegal({ initial: 600, increment: 181 })).toBe(false);
		expect(seekLegal({ initial: 0, increment: 0 })).toBe(false);
		for (const pace of QUICK_PAIRS)
			expect(seekInput.safeParse({ pace, rated: false, range: "any" }).success).toBe(true);
		expect(
			seekInput.safeParse({
				pace: { kind: "clock", clock: { initial: 180, increment: 2 } },
				rated: false,
				range: "any",
			}).success,
		).toBe(false);
		expect(seekInput.safeParse({ pace: QUICK_PAIRS[0], rated: false, range: "50" }).success).toBe(false);
	});

	it("a rating range around the player's rating, never below 400; any or no rating means anyone", () => {
		expect(ratingRangeOf("200", 1500)).toBe("1300-1700");
		expect(ratingRangeOf("400", 600)).toBe("400-1000");
		expect(ratingRangeOf("any", 1500)).toBeNull();
		expect(ratingRangeOf("100", null)).toBeNull();
	});
});

describe("the games in progress in the event store", () => {
	it("the list's fresher turns and times update the games; a finished one in it is skipped", () => {
		let state = applyEvent(settled(), { type: "gameStart", game: game("corr1111") }, 1_000);
		expect(state.readAt.corr1111).toBe(1_000);
		state = applyPlaying(
			state,
			[game("corr1111", { isMyTurn: true, secondsLeft: 100_000 }), game("done1111", { status: "mate" })],
			5_000,
		);
		expect(state.games).toEqual([expect.objectContaining({ id: "corr1111", isMyTurn: true, secondsLeft: 100_000 })]);
		expect(state.readAt.corr1111).toBe(5_000);
		state = applyEvent(state, { type: "gameFinish", game: game("corr1111") }, 6_000);
		expect(state.readAt).toEqual({});
	});

	it("my games: the player's move first, then the least time left; the time counts down from when it was read", () => {
		const state = settled({
			games: [
				game("theirs11", { secondsLeft: 50 }),
				game("mineslow", { isMyTurn: true, secondsLeft: 200_000 }),
				game("minefast", { isMyTurn: true, secondsLeft: 3_000 }),
			],
			readAt: { minefast: 0, mineslow: 0, theirs11: 0 },
		});
		expect(orderGames(state, 0).map((entry) => entry.id)).toEqual(["minefast", "mineslow", "theirs11"]);
		expect(myTurnGames(state, 0).map((entry) => entry.id)).toEqual(["minefast", "mineslow"]);
		const fast = state.games[2];
		if (!fast) throw new Error("no game");
		expect(secondsLeftOf(fast, 0, 10_000)).toBe(2_990);
		// The opponent's time isn't the player's to count down.
		const theirs = state.games[0];
		if (!theirs) throw new Error("no game");
		expect(secondsLeftOf(theirs, 0, 10_000)).toBe(50);
	});

	it("settles after each restatement; challenges to the player are theirs to answer, their own aren't", () => {
		let state = markStale(settled());
		expect(state.settled).toBe(false);
		state = settle(state);
		expect(state.settled).toBe(true);
		state = applyEvent(applyEvent(state, challenge("chalIn11")), challenge("chalOut1", "me"));
		expect(incomingChallenges(state, "me").map((entry) => entry.id)).toEqual(["chalIn11"]);
	});
});

describe("notices", () => {
	it("nothing while the stream restates, nor in the first state after it", () => {
		const restating = applyEvent(markStale(settled()), challenge("chal1111"));
		expect(newNotices(markStale(settled()), restating, "me")).toEqual([]);
		expect(newNotices(restating, settle(restating), "me")).toEqual([]);
	});

	it("a challenge to the player, their move in a correspondence game, a correspondence game that started", () => {
		const before = settled({ games: [game("corr1111"), game("rapid111", { speed: "rapid" })] });
		let after = applyEvent(before, challenge("chal1111"));
		after = applyEvent(after, challenge("mine1111", "me"));
		after = applyPlaying(
			after,
			[
				game("corr1111", { isMyTurn: true }),
				game("rapid111", { speed: "rapid", isMyTurn: true }),
				game("corr2222", { hasMoved: false }),
			],
			0,
		);
		expect(newNotices(before, after, "me").map((notice) => notice.kind)).toEqual(["challenge", "turn", "started"]);
		// Nothing changes, nothing is new.
		expect(newNotices(after, { ...after }, "me")).toEqual([]);
	});
});

describe("the tab leader reads the games in progress", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("once the stream settles, after a game starts, and every minute while correspondence goes on; it shares them", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const store = createLiveStore();
		const posted: unknown[] = [];
		const channel: ChannelLike = {
			postMessage: (message) => posted.push(message),
			addEventListener: () => {},
			close: () => {},
		};
		let options: KeepOptions | undefined;
		const playing = vi.fn(async () => ({ games: [game("corr1111", { isMyTurn: true })] }));
		const stop = startLiveEvents({
			store,
			locks: null,
			channel,
			stream: (_url, given) => {
				options = given;
				given.onStatus?.({ state: "open" });
				return { stop: () => {} };
			},
			now: () => 42,
			onLiveGames: () => {},
			playing,
		});
		await vi.waitFor(() => expect(options).toBeDefined());
		options?.onLine({ type: "gameStart", game: game("corr1111") });
		// The restatement is over at Lichess's first keepalive (the server's own comes first).
		options?.onKeepalive?.(1);
		options?.onKeepalive?.(2);
		expect(store.get().settled).toBe(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(playing).toHaveBeenCalledTimes(1);
		expect(store.get().games[0]?.isMyTurn).toBe(true);
		expect(posted).toContainEqual({ kind: "playing", games: [expect.objectContaining({ id: "corr1111" })], at: 42 });
		await vi.advanceTimersByTimeAsync(PLAYING_EVERY_MS);
		expect(playing).toHaveBeenCalledTimes(2);
		// A game starting asks again soon after.
		options?.onLine({ type: "gameStart", game: game("corr2222", { hasMoved: false }) });
		await vi.advanceTimersByTimeAsync(1_500);
		expect(playing).toHaveBeenCalledTimes(3);
		stop();
		await vi.advanceTimersByTimeAsync(PLAYING_EVERY_MS * 2);
		expect(playing).toHaveBeenCalledTimes(3);
	});

	it("doesn't read every minute without a correspondence game", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		let options: KeepOptions | undefined;
		const playing = vi.fn(async () => ({ games: [] }));
		const stop = startLiveEvents({
			store: createLiveStore(),
			locks: null,
			channel: null,
			stream: (_url, given) => {
				options = given;
				given.onStatus?.({ state: "open" });
				return { stop: () => {} };
			},
			now: () => 0,
			onLiveGames: () => {},
			playing,
		});
		await vi.waitFor(() => expect(options).toBeDefined());
		options?.onKeepalive?.(2);
		await vi.advanceTimersByTimeAsync(PLAYING_EVERY_MS * 3);
		expect(playing).toHaveBeenCalledTimes(1);
		stop();
	});
});

describe("berserk and zen", () => {
	const full = (overrides: Partial<ChaalGameFull> = {}): ChaalGameFull => ({
		id: "arena123",
		rated: true,
		speed: "blitz",
		variant: "standard",
		clock: { initial: 300_000, increment: 0 },
		daysPerTurn: null,
		initialFen: null,
		white: { id: "me", name: "Me", title: null, rating: 1500, provisional: false, aiLevel: null, ratingDiff: null },
		black: { id: "them", name: "Them", title: null, rating: 1500, provisional: false, aiLevel: null, ratingDiff: null },
		state: {
			moves: [],
			wtime: 300_000,
			btime: 300_000,
			winc: 0,
			binc: 0,
			status: "started",
			winner: null,
			wdraw: false,
			bdraw: false,
			wtakeback: false,
			btakeback: false,
			expiration: null,
		},
		tournamentId: "tourney1",
		createdAt: 0,
		...overrides,
	});

	it("berserk: an arena game with a clock, before the player's own first move", () => {
		expect(canBerserk(liveGameOf(full(), "white", 0))).toBe(true);
		expect(canBerserk(liveGameOf(full({ tournamentId: null }), "white", 0))).toBe(false);
		const moved = full();
		moved.state = { ...moved.state, moves: ["e2e4"] };
		expect(canBerserk(liveGameOf(moved, "white", 0))).toBe(false);
		// Black hasn't moved yet after 1. e4.
		expect(canBerserk(liveGameOf(moved, "black", 0))).toBe(true);
	});

	it("zen applies on a game's page in either language, and nowhere else", () => {
		expect(PLAY_PAGE.test("/app/chaal/game/abcdEFGH")).toBe(true);
		expect(PLAY_PAGE.test("/ne/app/chaal/local/0b5e2c1a-3f7e-4f7b-9d1a-2c1f0e9d8c7b")).toBe(true);
		expect(PLAY_PAGE.test("/app/chaal/play")).toBe(false);
		expect(PLAY_PAGE.test("/app/chaal/game/abcdEFGH/extra")).toBe(false);
	});
});
