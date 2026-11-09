import "@tanstack/react-start/server-only";

/**
 * "Only make one request at a time" (Lichess's API rules, PLAN 13.4). Each lane runs its
 * calls one after another, in order, on this server instance: `public` for everything
 * without a token, and two per connection: `user:<id>` for reads and writes, `play:<id>`
 * for moves, so a move never waits behind a slow read. Streams don't take a lane: they stay
 * open for minutes, and Lichess expects them alongside the calls.
 */
export type LaneKey = "public" | `user:${string}` | `play:${string}`;

export const userLane = (connectionId: string): LaneKey => `user:${connectionId}`;
export const playLane = (connectionId: string): LaneKey => `play:${connectionId}`;

/** A lane's kind, for logs and the health page: never the connection it belongs to. */
export const laneKind = (lane: LaneKey): "public" | "user" | "play" =>
	lane === "public" ? "public" : lane.startsWith("play:") ? "play" : "user";

/** A lane's cooldown key: the public lane's own, or the connection's (its two lanes share one). */
export const cooldownKey = (lane: LaneKey): string => (lane === "public" ? "public" : `conn:${lane.split(":")[1]}`);

export type Lanes = {
	run: <T>(lane: LaneKey, task: () => Promise<T>) => Promise<T>;
	/** Lanes with a call running or waiting (for the lab and tests). */
	busy: () => number;
};

export function createLanes(): Lanes {
	const tails = new Map<LaneKey, Promise<unknown>>();
	return {
		busy: () => tails.size,
		run: <T>(lane: LaneKey, task: () => Promise<T>) => {
			const previous = tails.get(lane) ?? Promise.resolve();
			// The next call starts when this one settles, however it settles.
			const result = previous.then(task, task);
			const tail = result.then(
				() => undefined,
				() => undefined,
			);
			tails.set(lane, tail);
			void tail.then(() => {
				if (tails.get(lane) === tail) tails.delete(lane);
			});
			return result;
		},
	};
}
