import { useEffect, useRef, useState } from "react";
import type { ChaalSeekLine } from "../live/events";
import { type KeepOptions, keepStreaming } from "../live/reader";
import { type LiveStore, liveStore } from "../live/store";
import { paceKey } from "./controls";
import type { SeekInput } from "./schema";

/** The stream route that keeps a seek on a clock open (src/server/routes/chaal-stream.ts). */
export const SEEK_STREAM = "/api/chaal/stream/seek";

/** After Lichess closes a seek, how long its game may take to arrive on the event stream. */
const GAME_WAIT_MS = 10_000;

/** Where quick pairing stands. `key` is the pace's (`600+5`, `d3`), so the tile can say it. */
export type SeekState =
	| { state: "idle" }
	/** In the lobby on a clock, since `since` (Date.now()), until someone accepts or the player cancels. */
	| { state: "seeking"; key: string; since: number }
	/** A correspondence seek waits in Lichess's lobby; its game arrives when someone joins. */
	| { state: "posted"; key: string }
	/** Lichess closed the seek and no game came: it expired. */
	| { state: "ended"; key: string }
	| { state: "failed"; key: string; status: number | null; reason: string | null };

/**
 * Quick pairing (Task 78, decision 0267). A seek on a clock is held open by our seek stream
 * while the page waits (Lichess cancels it when it closes: cancelling, leaving the page);
 * our window running out opens a new one at once. Lichess says nothing on the seek when
 * someone accepts: the game arrives on the event stream, so the hook watches the event
 * store for a new game that hasn't started moving and opens it. A correspondence seek is a
 * call; it waits in the lobby, and its game arrives the same way later.
 *
 * The event stream must be open first (Lichess: "open the event stream first"); the hub
 * offers the tiles only then.
 */
export function useSeek({
	onGame,
	seekDays,
	stream = keepStreaming,
	store = liveStore,
	now = () => Date.now(),
}: {
	onGame: (gameId: string) => void;
	seekDays: (input: SeekInput) => Promise<unknown>;
	/** Tests and stories pass their own. */
	stream?: (url: string, options: KeepOptions) => { stop: () => void };
	store?: LiveStore;
	now?: () => number;
}) {
	const [seek, setSeek] = useState<SeekState>({ state: "idle" });
	const running = useRef<(() => void) | null>(null);
	const opened = useRef(onGame);
	opened.current = onGame;

	const stop = () => {
		running.current?.();
		running.current = null;
	};
	// Leaving the page takes the seek back (closing its stream cancels it at Lichess).
	useEffect(
		() => () => {
			running.current?.();
			running.current = null;
		},
		[],
	);

	const start = async (input: SeekInput) => {
		stop();
		const key = paceKey(input.pace);
		if (input.pace.kind === "days") {
			try {
				await seekDays(input);
				setSeek({ state: "posted", key });
			} catch {
				setSeek({ state: "failed", key, status: null, reason: null });
			}
			return;
		}
		const known = new Set(store.get().games.map((game) => game.id));
		let wait: ReturnType<typeof setTimeout> | undefined;
		let kept: { stop: () => void } | null = null;
		let unsubscribe = () => {};
		const finish = () => {
			clearTimeout(wait);
			unsubscribe();
			kept?.stop();
			if (running.current === finish) running.current = null;
		};
		unsubscribe = store.subscribe(() => {
			const game = store.get().games.find((candidate) => !known.has(candidate.id) && !candidate.hasMoved);
			if (!game) return;
			finish();
			setSeek({ state: "idle" });
			opened.current(game.id);
		});
		running.current = finish;
		setSeek({ state: "seeking", key, since: now() });
		kept = stream(SEEK_STREAM, {
			init: { method: "POST", body: JSON.stringify(input), headers: { "content-type": "application/json" } },
			// Lichess's keepalives come every few seconds; a minute of nothing means it's gone.
			silenceMs: 60_000,
			onLine: (value) => {
				if ((value as ChaalSeekLine).type !== "ended") return;
				// Accepted (the game is on its way) or expired: give the event stream a moment.
				wait = setTimeout(() => {
					finish();
					setSeek({ state: "ended", key });
				}, GAME_WAIT_MS);
			},
			onStatus: (status) => {
				if (status.state !== "refused") return;
				finish();
				setSeek({ state: "failed", key, status: status.status, reason: status.reason ?? status.error });
			},
		});
	};

	const cancel = () => {
		stop();
		setSeek({ state: "idle" });
	};

	return { seek, start, cancel };
}
