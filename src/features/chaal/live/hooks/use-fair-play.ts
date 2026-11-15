import { useSyncExternalStore } from "react";

/**
 * Fair play (PLAN 13.5, "Fair play"; decision 0264): while the player has a real-time game
 * in progress, the engine, cloud eval and the explorer are off everywhere in Chaal, with a
 * banner saying why. Lichess's rules ("Engine assistance, or any kind of outside help, is
 * forbidden") are Chaal's.
 *
 * This holds the games in progress for the browser tab. The event stream sets them (Task
 * 77: `gameStart` and `gameFinish` for real-time games); the analysis board and the
 * computer read `useFairPlay()`. On the server the page renders unlocked, and the lock
 * applies as soon as the stream says so.
 */
let games: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** The real-time games in progress now (their Lichess ids); an empty list lifts the lock. */
export function setLiveGames(ids: Iterable<string>): void {
	const next = new Set(ids);
	if (next.size === games.size && [...next].every((id) => games.has(id))) return;
	games = next;
	for (const listener of listeners) listener();
}

export type FairPlay = { locked: boolean; games: number };

const UNLOCKED: FairPlay = { locked: false, games: 0 };
let snapshot: FairPlay = UNLOCKED;
const read = (): FairPlay => {
	if (snapshot.games !== games.size) snapshot = { locked: games.size > 0, games: games.size };
	return snapshot;
};

export function useFairPlay(): FairPlay {
	return useSyncExternalStore(subscribe, read, () => UNLOCKED);
}
