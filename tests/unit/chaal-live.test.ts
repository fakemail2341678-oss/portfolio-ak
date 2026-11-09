import { describe, expect, it, vi } from "vitest";
import { START_FEN } from "@/features/chaal/chess/rules";
import {
	applyLine,
	canAbort,
	canTakeBack,
	clockOf,
	endingOf,
	fenOf,
	type LiveGame,
	liveGameOf,
	myTurn,
	offersOf,
	replay,
	rollback,
	shownMoves,
	withPending,
} from "@/features/chaal/game/live-game";
import type { ChaalEvent, ChaalEventGame, ChaalGameFull, ChaalGameState } from "@/features/chaal/live/events";
import { type ChannelLike, type LockManagerLike, startLiveEvents } from "@/features/chaal/live/events-client";
import { type KeepOptions, keepStreaming, readStream } from "@/features/chaal/live/reader";
import { applyEvent, createLiveStore, IDLE, markStale, realTimeGames, settle } from "@/features/chaal/live/store";
import { boardLegal, clockAccepted, paceOfKey, readPlayLimits } from "@/features/chaal/play/controls";
import { challengePlayerInput, lichessUsername } from "@/features/chaal/play/schema";
import {
	aiGameAnswer,
	challengeListAnswer,
	chatHistoryAnswer,
	mapChallengeLine,
	mapGameLine,
} from "@/server/chaal/lichess/schemas";

/**
 * Online play in the browser and its mapping (PLAN Task 77, decision 0266): a game's lines
 * as Lichess sends them, the live game's model (replay, the pending move, clocks, offers,
 * endings), the Board-legal controls, the event store and its restatement, the stream
 * reader with its reconnects and backoff, and the tab leader with two tabs.
 */

const STATE = (overrides: Partial<ChaalGameState> = {}): ChaalGameState => ({
	moves: [],
	wtime: 600_000,
	btime: 600_000,
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

const FULL = (state: Partial<ChaalGameState> = {}): ChaalGameFull => ({
	id: "abcdEFGH",
	rated: true,
	speed: "rapid",
	variant: "standard",
	clock: { initial: 600_000, increment: 5_000 },
	daysPerTurn: null,
	initialFen: null,
	white: { id: "me", name: "Me", title: null, rating: 1500, provisional: false, aiLevel: null, ratingDiff: null },
	black: { id: "them", name: "Them", title: "FM", rating: 2100, provisional: false, aiLevel: null, ratingDiff: null },
	state: STATE(state),
	tournamentId: null,
	createdAt: 0,
});

describe("a game's stream, mapped", () => {
	it("reads Lichess's gameFull, gameState, chatLine and opponentGone; drops what it doesn't know", () => {
		const full = mapGameLine({
			type: "gameFull",
			id: "abcdEFGH",
			variant: { key: "standard", name: "Standard" },
			clock: { initial: 600000, increment: 5000 },
			speed: "rapid",
			perf: { name: "Rapid" },
			rated: true,
			createdAt: 1,
			white: { id: "me", name: "Me", rating: 1500, provisional: true },
			black: { aiLevel: 3 },
			initialFen: "startpos",
			state: { type: "gameState", moves: "e2e4 e7e5", wtime: 1, btime: 2, winc: 0, binc: 0, status: "started" },
		});
		expect(full).toMatchObject({
			type: "gameFull",
			game: {
				initialFen: null,
				white: { id: "me", provisional: true, aiLevel: null },
				black: { id: null, aiLevel: 3, name: "" },
				state: { moves: ["e2e4", "e7e5"], wdraw: false, expiration: null },
			},
		});
		expect(
			mapGameLine({ type: "gameState", moves: "", wtime: 1, btime: 2, winc: 0, binc: 0, status: "draw", bdraw: true }),
		).toMatchObject({ type: "gameState", state: { moves: [], status: "draw", bdraw: true, winner: null } });
		expect(mapGameLine({ type: "chatLine", room: "player", username: "Them", text: "<b>hi</b>" })).toEqual({
			type: "chatLine",
			room: "player",
			username: "Them",
			text: "<b>hi</b>",
		});
		expect(mapGameLine({ type: "opponentGone", gone: true, claimWinInSeconds: 10 })).toEqual({
			type: "opponentGone",
			gone: true,
			claimWinInSeconds: 10,
		});
		expect(mapGameLine({ type: "somethingNew" })).toBeNull();
		// A move that isn't UCI means the shape changed: dropped, never passed on.
		expect(mapGameLine({ type: "gameState", moves: "e4", wtime: 1, btime: 2, status: "started" })).toBeNull();
	});

	it("a kept-open challenge: the challenge (plain or wrapped), then how it ended", () => {
		const challenge = {
			id: "chal1234",
			status: "created",
			challenger: { id: "me", name: "Me" },
			destUser: { id: "them", name: "Them" },
			variant: { key: "standard" },
			rated: false,
			speed: "rapid",
			timeControl: { type: "clock", limit: 600, increment: 5 },
			color: "random",
		};
		expect(mapChallengeLine({ challenge, socketVersion: 0 })).toMatchObject({
			type: "challenge",
			challenge: { id: "chal1234" },
		});
		expect(mapChallengeLine(challenge)).toMatchObject({
			type: "challenge",
			challenge: { timeControl: { limit: 600 } },
		});
		expect(mapChallengeLine({ done: "accepted" })).toEqual({ type: "done", done: "accepted" });
		expect(mapChallengeLine({ done: "exploded" })).toBeNull();
		expect(challengeListAnswer.parse({ in: [challenge, { broken: true }], out: [] })).toMatchObject({
			incoming: [{ id: "chal1234" }],
			outgoing: [],
		});
		expect(aiGameAnswer.parse({ id: "aiGame12", rated: false })).toEqual({ id: "aiGame12" });
		expect(() => aiGameAnswer.parse({ id: "../evil" })).toThrow();
		expect(chatHistoryAnswer.parse([{ user: "Them", text: "gg" }, null])).toEqual([
			{ room: "player", username: "Them", text: "gg" },
		]);
	});
});

describe("the live game's model", () => {
	const game = (state: Partial<ChaalGameState> = {}, now = 1_000) => liveGameOf(FULL(state), "white", now);

	it("replays Lichess's moves, reusing what it had, and reads Chess960-style castling", () => {
		const moves = replay(START_FEN, ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1h1"]);
		expect(moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
		const longer = replay(START_FEN, ["e2e4", "e7e5", "g1f3"], moves.slice(0, 2));
		expect(longer[0]).toBe(moves[0]);
		// An illegal move stops the replay there.
		expect(replay(START_FEN, ["e2e4", "e2e4"])).toHaveLength(1);
	});

	it("shows the player's move at once, keeps it until Lichess has it, and rolls it back on a refusal", () => {
		const start = game();
		expect(myTurn(start)).toBe(true);
		const pending = withPending(start, { uci: "e2e4", san: "e4", fen: "x" }, 2_000);
		expect(shownMoves(pending)).toHaveLength(1);
		expect(myTurn(pending)).toBe(false);
		// A draw offer arrives before the move: the pending move stays.
		const offered = applyLine(pending, { type: "gameState", state: STATE({ bdraw: true }) }, 2_100);
		expect(offered.pending?.uci).toBe("e2e4");
		const confirmed = applyLine(offered, { type: "gameState", state: STATE({ moves: ["e2e4"] }) }, 2_200);
		expect(confirmed.pending).toBeNull();
		expect(confirmed.moves.map((move) => move.uci)).toEqual(["e2e4"]);
		expect(rollback(pending).pending).toBeNull();
		expect(fenOf(rollback(pending))).toBe(START_FEN);
	});

	it("the clocks run from the second move, from the time Lichess's times arrived; a pending move presses the clock", () => {
		expect(clockOf(game())?.running).toBeNull();
		const two = game({ moves: ["e2e4", "e7e5"], wtime: 500_000, btime: 400_000 }, 5_000);
		expect(clockOf(two)).toEqual({ white: 500_000, black: 400_000, running: "white", since: 5_000 });
		const pressed = clockOf(withPending(two, { uci: "g1f3", san: "Nf3", fen: "x" }, 8_000));
		expect(pressed).toEqual({ white: 500_000 - 3_000 + 5_000, black: 400_000, running: "black", since: 8_000 });
		expect(clockOf(liveGameOf({ ...FULL(), clock: null, daysPerTurn: 3 }, "white", 0))).toBeNull();
	});

	it("offers by side, the opponent gone, abort before both have moved, a takeback after the player's own move", () => {
		const offers = offersOf(game({ bdraw: true, wtakeback: true }));
		expect(offers).toEqual({ draw: true, takeback: false, myDraw: false, myTakeback: true });
		const gone = applyLine(game(), { type: "opponentGone", gone: true, claimWinInSeconds: 30 }, 1_000);
		expect(gone.gone).toEqual({ claimAt: 31_000 });
		expect(applyLine(gone, { type: "opponentGone", gone: false, claimWinInSeconds: null }, 2_000).gone).toBeNull();
		expect(canAbort(game({ moves: ["e2e4"] }))).toBe(true);
		expect(canAbort(game({ moves: ["e2e4", "e7e5"] }))).toBe(false);
		expect(canTakeBack(game())).toBe(false);
		expect(canTakeBack(game({ moves: ["e2e4"] }))).toBe(true);
		expect(canTakeBack(liveGameOf(FULL({ moves: ["e2e4"] }), "black", 0))).toBe(false);
	});

	it("reads how a game ended from Lichess's status and winner", () => {
		expect(endingOf({ status: "started", winner: null })).toBeNull();
		expect(endingOf({ status: "mate", winner: "white" })).toEqual({
			result: "1-0",
			reason: "checkmate",
			aborted: false,
		});
		expect(endingOf({ status: "resign", winner: "black" })).toEqual({
			result: "0-1",
			reason: "resign",
			aborted: false,
		});
		expect(endingOf({ status: "outoftime", winner: null })?.reason).toBe("timeout-draw");
		expect(endingOf({ status: "timeout", winner: "white" })?.reason).toBe("left");
		expect(endingOf({ status: "draw", winner: null })).toEqual({ result: "1/2-1/2", reason: null, aborted: false });
		expect(endingOf({ status: "aborted", winner: null })).toEqual({ result: null, reason: null, aborted: true });
		expect(endingOf({ status: "noStart", winner: "black" })?.reason).toBe("no-start");
	});

	it("chat lines are kept, at most 200", () => {
		let current: LiveGame = game();
		for (let index = 0; index < 205; index++) {
			current = applyLine(current, { type: "chatLine", room: "player", username: "Them", text: String(index) }, 0);
		}
		expect(current.chat).toHaveLength(200);
		expect(current.chat[0]?.text).toBe("5");
	});
});

describe("Board-legal controls", () => {
	it("blitz and slower on Lichess's clock values; bullet, odd starts and 0+0 refused; days from Lichess's list", () => {
		expect(boardLegal({ initial: 180, increment: 2 })).toBe(true);
		expect(boardLegal({ initial: 600, increment: 5 })).toBe(true);
		expect(boardLegal({ initial: 60, increment: 1 })).toBe(false);
		expect(boardLegal({ initial: 120, increment: 0 })).toBe(false);
		expect(clockAccepted({ initial: 100, increment: 0 })).toBe(false);
		expect(clockAccepted({ initial: 0, increment: 0 })).toBe(false);
		expect(clockAccepted({ initial: 600, increment: 61 })).toBe(false);
		expect(paceOfKey("600+5")).toEqual({ kind: "clock", clock: { initial: 600, increment: 5 } });
		expect(paceOfKey("60+0")).toBeNull();
		expect(paceOfKey("d3")).toEqual({ kind: "days", days: 3 });
		expect(paceOfKey("d4")).toBeNull();
		expect(readPlayLimits({ aiMaxLevel: 12, rated: false })).toEqual({ aiMaxLevel: 8, rated: false });
		expect(readPlayLimits(null)).toEqual({ aiMaxLevel: 8, rated: true });
	});

	it("inputs: a Lichess name, a Board-legal pace", () => {
		expect(lichessUsername.safeParse("E2E_Rival").success).toBe(true);
		expect(lichessUsername.safeParse("a").success).toBe(false);
		expect(lichessUsername.safeParse("../../api").success).toBe(false);
		const input = { username: "Them", color: "random", rated: false };
		expect(
			challengePlayerInput.safeParse({ ...input, pace: { kind: "clock", clock: { initial: 60, increment: 0 } } })
				.success,
		).toBe(false);
		expect(challengePlayerInput.safeParse({ ...input, pace: { kind: "days", days: 3 } }).success).toBe(true);
	});
});

const eventGame = (id: string, speed: string): ChaalEventGame => ({
	id,
	color: "white",
	fen: START_FEN,
	lastMove: "",
	source: "friend",
	status: "started",
	variant: "standard",
	speed,
	rated: false,
	hasMoved: false,
	isMyTurn: true,
	secondsLeft: null,
	opponent: { id: "them", name: "Them", title: null, rating: null, aiLevel: null },
	winner: null,
	ratingDiff: null,
	boardCompatible: true,
	tournamentId: null,
});

const challengeEvent = (id: string): ChaalEvent => ({
	type: "challenge",
	challenge: {
		id,
		status: "created",
		challenger: { id: "them", name: "Them", title: null, rating: null, aiLevel: null },
		destUser: { id: "me", name: "Me", title: null, rating: null, aiLevel: null },
		variant: "standard",
		rated: false,
		speed: "rapid",
		timeControl: { type: "clock", limit: 600, increment: 5, daysPerTurn: null },
		color: "random",
		finalColor: null,
		declineReasonKey: null,
	},
});

describe("the event store", () => {
	it("challenges come and go, an accepted one becomes its game, a finished game is kept for its rating change", () => {
		let state = applyEvent(IDLE, challengeEvent("chal1234"));
		expect(state.challenges).toHaveLength(1);
		state = applyEvent(state, { type: "gameStart", game: eventGame("chal1234", "rapid") });
		expect(state.challenges).toHaveLength(0);
		expect(state.games.map((game) => game.id)).toEqual(["chal1234"]);
		state = applyEvent(state, { type: "gameFinish", game: { ...eventGame("chal1234", "rapid"), ratingDiff: 7 } });
		expect(state.games).toHaveLength(0);
		expect(state.finished.chal1234?.ratingDiff).toBe(7);
		const declined = applyEvent(applyEvent(IDLE, challengeEvent("chal5678")), {
			type: "challengeDeclined",
			challenge: {
				...(challengeEvent("x") as { challenge: object }).challenge,
				id: "chal5678",
				declineReasonKey: "later",
			},
		} as ChaalEvent);
		expect(declined.declined).toEqual({ chal5678: "later" });
	});

	it("on a reopened stream, what isn't restated before it settles has gone", () => {
		let state = applyEvent(applyEvent(IDLE, challengeEvent("old11111")), {
			type: "gameStart",
			game: eventGame("game1111", "rapid"),
		});
		state = markStale(state);
		state = applyEvent(state, { type: "gameStart", game: eventGame("game1111", "rapid") });
		state = settle(state);
		expect(state.challenges).toHaveLength(0);
		expect(state.games.map((game) => game.id)).toEqual(["game1111"]);
	});

	it("fair play locks for real-time games only", () => {
		const state = [eventGame("rapid111", "rapid"), eventGame("corr1111", "correspondence")].reduce(
			(current, game) => applyEvent(current, { type: "gameStart", game }),
			IDLE,
		);
		expect(realTimeGames(state)).toEqual(["rapid111"]);
	});
});

/** A response whose body is these lines, then the end. */
const ndjson = (lines: string[], status = 200) =>
	new Response(
		new ReadableStream({
			start: (c) => {
				c.enqueue(new TextEncoder().encode(lines.join("\n")));
				c.close();
			},
		}),
		{
			status,
			headers: { "content-type": "application/x-ndjson" },
		},
	);

describe("reading a stream", () => {
	it("passes lines on, counts keepalives, and ends with the server's reconnect", async () => {
		const seen: unknown[] = [];
		const keepalives: number[] = [];
		const end = await readStream("/s", {
			signal: new AbortController().signal,
			fetcher: async () => ndjson(["", '{"type":"gameState"}', "", '{"type":"reconnect","afterMs":0}', ""]),
			onLine: (value) => seen.push(value),
			onKeepalive: (count) => keepalives.push(count),
		});
		expect(seen).toEqual([{ type: "gameState" }]);
		expect(keepalives).toEqual([1, 2]);
		expect(end).toEqual({ kind: "reconnect", afterMs: 0 });
	});

	it("a refusal carries the server's code and reason; a broken connection is dropped", async () => {
		const refused = await readStream("/s", {
			signal: new AbortController().signal,
			fetcher: async () => Response.json({ error: "FORBIDDEN", reason: "lichess-reconnect" }, { status: 403 }),
			onLine: () => {},
		});
		expect(refused).toEqual({ kind: "refused", status: 403, error: "FORBIDDEN", reason: "lichess-reconnect" });
		const dropped = await readStream("/s", {
			signal: new AbortController().signal,
			fetcher: async () => {
				throw new TypeError("network");
			},
			onLine: () => {},
		});
		expect(dropped).toEqual({ kind: "dropped" });
	});

	it("nothing for too long, not even a keepalive, means the connection is gone", async () => {
		const end = await readStream("/s", {
			signal: new AbortController().signal,
			silenceMs: 30,
			fetcher: async (_url, init) =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("\n"));
							init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
						},
					}),
				),
			onLine: () => {},
		});
		expect(end).toEqual({ kind: "dropped" });
	});

	it("keeps it open: at once after a window, backing off when it keeps ending, and stopping on a refusal it can't fix", async () => {
		const ends = [
			{ lines: ['{"type":"reconnect","afterMs":0}'] },
			{ lines: ['{"type":"reconnect","afterMs":1000}'] },
			{ lines: ['{"type":"reconnect","afterMs":1000}'] },
			{ status: 403 },
		];
		const waits: number[] = [];
		// Each stream reads the clock when it opens and when it ends: the first lasts a minute, the others end at once.
		const times = [0, 60_000];
		const now = () => times.shift() ?? 60_000;
		const statuses: string[] = [];
		await new Promise<void>((resolve) => {
			keepStreaming("/s", {
				fetcher: async () => {
					const next = ends.shift();
					if (!next) throw new Error("no more");
					if (next.status) return Response.json({ error: "FORBIDDEN" }, { status: next.status });
					return ndjson(next.lines ?? []);
				},
				now,
				sleep: async (ms) => {
					waits.push(ms);
				},
				onLine: () => {},
				onStatus: (status) => {
					statuses.push(status.state);
					if (status.state === "refused") resolve();
				},
			} satisfies KeepOptions);
		});
		// After a healthy minute, at once; then a stream that ends at once backs off.
		expect(waits[0]).toBe(0);
		expect(waits[1]).toBeGreaterThanOrEqual(1_000);
		expect(waits[2]).toBeGreaterThan(waits[1] ?? 0);
		expect(statuses.at(-1)).toBe("refused");
	});
});

/** Web Locks and a BroadcastChannel shared by the "tabs" of one test. */
function fakeBrowser() {
	const waiting: Array<{ grant: () => void }> = [];
	let held = false;
	const locks: LockManagerLike = {
		request: (_name, { signal }, callback) =>
			new Promise((resolve, reject) => {
				const grant = () => {
					held = true;
					void callback().then(() => {
						held = false;
						waiting.shift()?.grant();
						resolve(undefined);
					});
				};
				if (!held) grant();
				else {
					const entry = { grant };
					waiting.push(entry);
					signal?.addEventListener("abort", () => {
						const index = waiting.indexOf(entry);
						if (index >= 0) waiting.splice(index, 1);
						reject(new DOMException("aborted", "AbortError"));
					});
				}
			}),
	};
	const channels = new Set<{ listener?: (event: MessageEvent) => void; closed: boolean }>();
	const channel = (): ChannelLike => {
		const self: { listener?: (event: MessageEvent) => void; closed: boolean } = { closed: false };
		channels.add(self);
		return {
			postMessage: (message) => {
				for (const other of channels) {
					if (other !== self && !other.closed)
						queueMicrotask(() => other.listener?.({ data: message } as MessageEvent));
				}
			},
			addEventListener: (_type, listener) => {
				self.listener = listener;
			},
			close: () => {
				self.closed = true;
			},
		};
	};
	return { locks, channel };
}

describe("two tabs", () => {
	it("one tab holds the stream and shares its events; when it closes, the other takes over", async () => {
		const browser = fakeBrowser();
		const opened: Array<{ tab: string; push: (value: unknown) => void; stopped: boolean }> = [];
		const streamFor = (tab: string) => (_url: string, options: KeepOptions) => {
			const entry = { tab, push: (value: unknown) => options.onLine(value), stopped: false };
			opened.push(entry);
			options.onStatus?.({ state: "open" });
			return {
				stop: () => {
					entry.stopped = true;
				},
			};
		};
		const first = createLiveStore();
		const second = createLiveStore();
		const locked = vi.fn();
		const stopFirst = startLiveEvents({
			store: first,
			locks: browser.locks,
			channel: browser.channel(),
			stream: streamFor("first"),
			now: () => 0,
			onLiveGames: () => {},
		});
		await vi.waitFor(() => expect(opened).toHaveLength(1));
		opened[0]?.push({ type: "gameStart", game: eventGame("game1111", "rapid") });
		const stopSecond = startLiveEvents({
			store: second,
			locks: browser.locks,
			channel: browser.channel(),
			stream: streamFor("second"),
			now: () => 0,
			onLiveGames: locked,
		});
		// The second tab got the state so far, opened no stream of its own, and follows the first's events.
		await vi.waitFor(() => expect(second.get().games.map((game) => game.id)).toEqual(["game1111"]));
		expect(opened).toHaveLength(1);
		expect(locked).toHaveBeenLastCalledWith(["game1111"]);
		opened[0]?.push(challengeEvent("chal1234"));
		await vi.waitFor(() => expect(second.get().challenges).toHaveLength(1));
		expect(second.get().status).toBe("open");

		stopFirst();
		await vi.waitFor(() => expect(opened).toHaveLength(2));
		expect(opened[0]?.stopped).toBe(true);
		expect(opened[1]?.tab).toBe("second");
		stopSecond();
		await vi.waitFor(() => expect(opened[1]?.stopped).toBe(true));
	});
});
