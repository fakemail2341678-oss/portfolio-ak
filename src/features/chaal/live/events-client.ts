import { getChaalPlaying } from "@/functions/chaal/challenges";
import { CHAAL_EVENT_STREAM } from "../links";
import type { ChaalEvent, ChaalEventGame } from "./events";
import { setLiveGames } from "./fair-play";
import { type KeepOptions, keepStreaming, type StreamStatus } from "./reader";
import {
	applyEvent,
	applyPlaying,
	IDLE,
	type LiveState,
	type LiveStatus,
	type LiveStore,
	liveStore,
	markStale,
	realTimeGames,
	settle,
} from "./store";

/**
 * Following the player's Lichess events in the browser (PLAN 13.5, "Live play"; decision
 * 0266). Lichess allows one event stream per token, so one tab holds it: the one holding the
 * Web Lock `chaal-events`. It applies each event to its store and passes it to the other
 * tabs over the `chaal-events` BroadcastChannel; a tab that opens later says hello and gets
 * the state so far. When the leader closes, the lock passes to a waiting tab, which opens
 * the stream (Lichess restates everything). Every tab feeds fair play's lock from its store.
 *
 * The event stream says when a game starts or ends, never when a move is made, so the
 * leader also reads the games in progress (`playing`, Task 78): once the stream has settled,
 * after a game starts or ends, and every minute while a correspondence game is going on,
 * and shares them like an event. That's how "your move" reaches every tab.
 *
 * Loaded by the frame with `await import()`, only for a player connected for play.
 */

export const EVENTS_LOCK = "chaal-events";
export const EVENTS_CHANNEL = "chaal-events";

/** Lichess's first keepalive comes 7 s after it opens: by then the restatement is over. */
const SETTLE_MS = 8_000;

/** How often the leader reads the games in progress while a correspondence game is going on. */
export const PLAYING_EVERY_MS = 60_000;
/** Games starting or ending come in bursts (a restatement, a seek): one read after the last. */
const PLAYING_AFTER_MS = 1_500;

type Message =
	| { kind: "hello" }
	| { kind: "snapshot"; state: LiveState }
	| { kind: "event"; event: ChaalEvent }
	| { kind: "opened" }
	| { kind: "settled" }
	| { kind: "playing"; games: ChaalEventGame[]; at: number }
	| { kind: "status"; status: LiveStatus; refusal: string | null; downSince: number | null };

export type LockManagerLike = {
	request: (name: string, options: { signal?: AbortSignal }, callback: () => Promise<void>) => Promise<unknown>;
};

export type ChannelLike = {
	postMessage: (message: unknown) => void;
	addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
	close: () => void;
};

export type EventsDeps = {
	store: LiveStore;
	/** Null where the browser has no Web Locks: this tab leads alone. */
	locks: LockManagerLike | null;
	channel: ChannelLike | null;
	stream: (url: string, options: KeepOptions) => { stop: () => void };
	url: string;
	now: () => number;
	/** Fair play's lock: the real-time games in progress. */
	onLiveGames: (ids: string[]) => void;
	/** The games in progress (GET /api/account/playing through our server). */
	playing: () => Promise<{ games: ChaalEventGame[] }>;
};

const browserDeps = (): EventsDeps => ({
	store: liveStore,
	locks: typeof navigator !== "undefined" && "locks" in navigator ? (navigator.locks as LockManagerLike) : null,
	channel: typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(EVENTS_CHANNEL),
	stream: keepStreaming,
	url: CHAAL_EVENT_STREAM,
	now: () => Date.now(),
	onLiveGames: setLiveGames,
	playing: () => getChaalPlaying(),
});

const KNOWN = new Set(["gameStart", "gameFinish", "challenge", "challengeCanceled", "challengeDeclined"]);
const isEvent = (value: unknown): value is ChaalEvent =>
	typeof value === "object" && value !== null && KNOWN.has(String((value as { type?: unknown }).type));

/** Starts following; the function returned stops it (and gives the lock to another tab). */
export function startLiveEvents(overrides: Partial<EventsDeps> = {}): () => void {
	const deps = { ...browserDeps(), ...overrides };
	const { store, channel } = deps;
	const abort = new AbortController();
	let leading = false;
	let release: () => void = () => {};

	const post = (message: Message) => channel?.postMessage(message);
	const status = (next: LiveStatus, refusal: string | null = null) => {
		const current = store.get();
		const downSince = next === "open" ? null : (current.downSince ?? deps.now());
		store.set({ ...current, status: next, refusal, downSince });
		post({ kind: "status", status: next, refusal, downSince });
	};

	const lead = () => {
		let settleTimer: ReturnType<typeof setTimeout> | undefined;
		let playingTimer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		const readPlaying = async () => {
			try {
				const { games } = await deps.playing();
				if (stopped) return;
				const at = deps.now();
				store.set((state) => applyPlaying(state, games, at));
				post({ kind: "playing", games, at });
			} catch {
				// A failed read changes nothing; the next one may work.
			}
			schedulePlaying(PLAYING_EVERY_MS);
		};
		/** The next read: soon after a change, then every minute while correspondence is going on. */
		const schedulePlaying = (ms: number) => {
			clearTimeout(playingTimer);
			if (stopped) return;
			const correspondence = store.get().games.some((game) => game.speed === "correspondence");
			if (ms === PLAYING_EVERY_MS && !correspondence) return;
			playingTimer = setTimeout(() => void readPlaying(), ms);
		};
		const settleNow = () => {
			clearTimeout(settleTimer);
			store.set(settle);
			post({ kind: "settled" });
			schedulePlaying(0);
		};
		const onStatus = (stream: StreamStatus) => {
			if (stream.state === "open") {
				store.set(markStale);
				post({ kind: "opened" });
				status("open");
				clearTimeout(settleTimer);
				settleTimer = setTimeout(settleNow, SETTLE_MS);
			} else if (stream.state === "refused") {
				status("refused", stream.reason ?? stream.error);
			} else {
				status(store.get().status === "idle" || store.get().status === "connecting" ? "connecting" : "offline");
			}
		};
		const kept = deps.stream(deps.url, {
			reopenWhenClosed: true,
			onStatus,
			onLine: (value) => {
				if (!isEvent(value)) return;
				store.set((state) => applyEvent(state, value, deps.now()));
				post({ kind: "event", event: value });
				if ((value.type === "gameStart" || value.type === "gameFinish") && store.get().settled) {
					schedulePlaying(PLAYING_AFTER_MS);
				}
			},
			// Our server's own keepalive comes first; Lichess's is the second.
			onKeepalive: (count) => {
				if (count === 2) settleNow();
			},
		});
		return () => {
			stopped = true;
			clearTimeout(settleTimer);
			clearTimeout(playingTimer);
			kept.stop();
		};
	};

	channel?.addEventListener("message", (message: MessageEvent) => {
		const data = message.data as Message;
		if (leading) {
			if (data.kind === "hello") post({ kind: "snapshot", state: store.get() });
			return;
		}
		if (data.kind === "snapshot") store.set(data.state);
		else if (data.kind === "event") store.set((state) => applyEvent(state, data.event, deps.now()));
		else if (data.kind === "playing") store.set((state) => applyPlaying(state, data.games, data.at));
		else if (data.kind === "opened") store.set(markStale);
		else if (data.kind === "settled") store.set(settle);
		else if (data.kind === "status")
			store.set((state) => ({ ...state, status: data.status, refusal: data.refusal, downSince: data.downSince }));
	});

	const unsubscribe = store.subscribe(() => deps.onLiveGames(realTimeGames(store.get())));
	store.set({ ...IDLE, status: "connecting", downSince: deps.now() });
	post({ kind: "hello" });

	const becomeLeader = async () => {
		leading = true;
		const stop = lead();
		await new Promise<void>((resolve) => {
			release = resolve;
			if (abort.signal.aborted) resolve();
		});
		stop();
		leading = false;
	};
	if (deps.locks) {
		deps.locks.request(EVENTS_LOCK, { signal: abort.signal }, becomeLeader).catch(() => {
			// Stopped while waiting for the lock: nothing to undo.
		});
	} else {
		void becomeLeader();
	}

	return () => {
		abort.abort();
		release();
		unsubscribe();
		channel?.close();
		store.set(IDLE);
		deps.onLiveGames([]);
	};
}
