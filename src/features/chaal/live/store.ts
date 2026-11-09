import { useSyncExternalStore } from "react";
import type { ChaalEvent, ChaalEventChallenge, ChaalEventGame } from "./events";

/**
 * What the event stream says now, for this tab (PLAN 13.5, "Live play"; decision 0266): the
 * challenges waiting, the games in progress, the games that ended while it watched, and
 * where the stream stands. The tab holding the stream (the leader, ./events-client.ts)
 * applies Lichess's events and passes them to the other tabs, which apply the same ones.
 *
 * Lichess restates every current challenge and game when a stream opens. On each open the
 * store marks what it holds as stale; what's restated is fresh again, and once the stream
 * has settled (its first keepalive from Lichess) what's still stale is dropped: a game that
 * ended or a challenge that went while no stream was open.
 */

export type LiveStatus =
	/** Not following: no connection with play's scopes, or play is off. */
	| "idle"
	| "connecting"
	| "open"
	/** Lost, trying again. */
	| "offline"
	/** Refused for good (`refusal` says why: reconnect, blocked, off). */
	| "refused";

export type LiveState = {
	status: LiveStatus;
	refusal: string | null;
	/** When the stream was last lost (Date.now()), for the banner after 3 s; null while open. */
	downSince: number | null;
	challenges: ChaalEventChallenge[];
	games: ChaalEventGame[];
	/** Games that ended while this tab watched, by id: the game page reads its rating change here. */
	finished: Readonly<Record<string, ChaalEventGame>>;
	/** Challenges the other player declined while this tab watched: Lichess's reason key, by id. */
	declined: Readonly<Record<string, string>>;
	/** Keys (`c:<id>`, `g:<id>`) held from before the stream last opened, not restated yet. */
	stale: ReadonlyArray<string>;
	/** Whether the restatement after the stream last opened is over: what arrives now is new (Task 78's notices). */
	settled: boolean;
	/** When each game's turn and time left were read (Date.now()), by id: its clock counts down from there. */
	readAt: Readonly<Record<string, number>>;
};

export const IDLE: LiveState = {
	status: "idle",
	refusal: null,
	downSince: null,
	challenges: [],
	games: [],
	finished: {},
	declined: {},
	stale: [],
	settled: false,
	readAt: {},
};

const without = <T extends { id: string }>(items: ReadonlyArray<T>, id: string) =>
	items.filter((item) => item.id !== id);
const upsert = <T extends { id: string }>(items: ReadonlyArray<T>, item: T) => {
	const index = items.findIndex((other) => other.id === item.id);
	return index < 0 ? [...items, item] : items.map((other, at) => (at === index ? item : other));
};
const unmark = (stale: ReadonlyArray<string>, key: string) =>
	stale.includes(key) ? stale.filter((other) => other !== key) : stale;

const omit = (record: Readonly<Record<string, number>>, id: string) => {
	if (!(id in record)) return record;
	return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
};

/** One of Lichess's events applied to the state, received at `now`. */
export function applyEvent(state: LiveState, event: ChaalEvent, now: number = Date.now()): LiveState {
	switch (event.type) {
		case "challenge":
			return {
				...state,
				challenges: upsert(state.challenges, event.challenge),
				stale: unmark(state.stale, `c:${event.challenge.id}`),
			};
		case "challengeCanceled":
			return { ...state, challenges: without(state.challenges, event.challenge.id) };
		case "challengeDeclined":
			return {
				...state,
				challenges: without(state.challenges, event.challenge.id),
				declined: { ...state.declined, [event.challenge.id]: event.challenge.declineReasonKey ?? "generic" },
			};
		case "gameStart":
			return {
				...state,
				// An accepted challenge becomes this game (the ids are the same).
				challenges: without(state.challenges, event.game.id),
				games: upsert(state.games, event.game),
				stale: unmark(state.stale, `g:${event.game.id}`),
				readAt: { ...state.readAt, [event.game.id]: now },
			};
		case "gameFinish":
			return {
				...state,
				games: without(state.games, event.game.id),
				finished: { ...state.finished, [event.game.id]: event.game },
				readAt: omit(state.readAt, event.game.id),
			};
		default:
			return state;
	}
}

/** The stream opened again: what's held waits to be restated. */
export const markStale = (state: LiveState): LiveState => ({
	...state,
	settled: false,
	stale: [...state.challenges.map((challenge) => `c:${challenge.id}`), ...state.games.map((game) => `g:${game.id}`)],
});

/** The restatement is over: what wasn't restated has gone. */
export const settle = (state: LiveState): LiveState =>
	state.stale.length === 0
		? state.settled
			? state
			: { ...state, settled: true }
		: {
				...state,
				challenges: state.challenges.filter((challenge) => !state.stale.includes(`c:${challenge.id}`)),
				games: state.games.filter((game) => !state.stale.includes(`g:${game.id}`)),
				stale: [],
				settled: true,
			};

/**
 * The games in progress as Lichess lists them (GET /api/account/playing, Task 78): fresher
 * turns and times than the event stream's, which says only when a game starts or ends. A
 * game the list has is updated (or added); one it lacks stays until the event stream ends it.
 */
export function applyPlaying(state: LiveState, games: ReadonlyArray<ChaalEventGame>, now: number): LiveState {
	let next = state.games;
	const readAt = { ...state.readAt };
	for (const game of games) {
		if (game.status && game.status !== "started" && game.status !== "created") continue;
		next = upsert(next, game);
		readAt[game.id] = now;
	}
	return { ...state, games: next, readAt };
}

/** The games where it's the player's move, the most urgent first: the least time left, then correspondence by days. */
export function myTurnGames(state: Pick<LiveState, "games" | "readAt">, now: number): ChaalEventGame[] {
	return orderGames(state, now).filter((game) => game.isMyTurn);
}

/** Seconds left on a game's clock now, counted from when it was read; null when Lichess didn't say. */
export function secondsLeftOf(game: ChaalEventGame, readAt: number | undefined, now: number): number | null {
	if (game.secondsLeft === null) return null;
	if (!game.isMyTurn || readAt === undefined) return game.secondsLeft;
	return Math.max(0, game.secondsLeft - Math.floor((now - readAt) / 1000));
}

/** "My games" (Task 78): the player's move first, then the least time left; real-time before correspondence on a tie. */
export function orderGames(state: Pick<LiveState, "games" | "readAt">, now: number): ChaalEventGame[] {
	const left = (game: ChaalEventGame) => secondsLeftOf(game, state.readAt[game.id], now) ?? Number.POSITIVE_INFINITY;
	return [...state.games].sort(
		(a, b) => Number(b.isMyTurn) - Number(a.isMyTurn) || left(a) - left(b) || a.id.localeCompare(b.id),
	);
}

/** The challenges waiting for the player's answer (not their own, and not an open link). */
export const incomingChallenges = (state: Pick<LiveState, "challenges">, me: string | null) =>
	state.challenges.filter((challenge) => challenge.destUser !== null && challenge.challenger?.id !== me);

/** The real-time games in progress: what fair play locks for (correspondence doesn't, PLAN 13.5). */
export const realTimeGames = (state: LiveState): string[] =>
	state.games.filter((game) => game.speed !== "correspondence").map((game) => game.id);

export type LiveStore = {
	get: () => LiveState;
	set: (next: LiveState | ((state: LiveState) => LiveState)) => void;
	subscribe: (listener: () => void) => () => void;
};

export function createLiveStore(initial: LiveState = IDLE): LiveStore {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set: (next) => {
			const value = typeof next === "function" ? next(state) : next;
			if (value === state) return;
			state = value;
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

/** This tab's store: the frame starts following when the player is connected for play. */
export const liveStore = createLiveStore();

export function useLive(store: LiveStore = liveStore): LiveState {
	return useSyncExternalStore(store.subscribe, store.get, () => IDLE);
}
