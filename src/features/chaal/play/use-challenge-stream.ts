import { useEffect, useRef, useState } from "react";
import type { ChaalChallengeLine } from "../live/events";
import { readStream, type StreamEnd } from "../live/reader";
import type { ChallengePlayerInput } from "./schema";

/** The stream route that keeps a real-time challenge open (src/server/routes/chaal-stream.ts). */
export const CHALLENGE_STREAM = "/api/chaal/stream/challenge";

/** Where a challenge sent from this page stands. */
export type SentChallenge =
	| { state: "sending"; username: string }
	| { state: "waiting"; username: string; id: string }
	| { state: "accepted"; username: string; id: string }
	| { state: "declined"; username: string; id: string | null }
	| { state: "canceled"; username: string }
	/** Nobody answered while the stream could stay open: the challenge was taken back. */
	| { state: "expired"; username: string }
	| { state: "failed"; username: string; end: Extract<StreamEnd, { kind: "refused" }> | null };

/**
 * A real-time challenge to a player (Task 77, decision 0266): Lichess drops one nobody
 * answers in 20 s, so it's held open by our stream route while this page waits, and taken
 * back when the page goes or the player cancels. Accepted, the page opens the game.
 */
export function useChallengeStream({
	onAccepted,
	fetcher,
}: {
	onAccepted: (gameId: string) => void;
	/** Tests pass their own. */
	fetcher?: typeof fetch;
}) {
	const [sent, setSent] = useState<SentChallenge | null>(null);
	const abort = useRef<AbortController | null>(null);
	const accepted = useRef(onAccepted);
	accepted.current = onAccepted;

	// Leaving the page takes the challenge back (the server cancels it when the stream closes).
	useEffect(() => () => abort.current?.abort(), []);

	const send = async (input: ChallengePlayerInput) => {
		abort.current?.abort();
		const controller = new AbortController();
		abort.current = controller;
		const username = input.username;
		let id: string | null = null;
		// Set inside the line callback, which TypeScript can't follow.
		let outcome = null as SentChallenge | null;
		setSent({ state: "sending", username });
		const end = await readStream(CHALLENGE_STREAM, {
			signal: controller.signal,
			// Lichess's keepalives every few seconds; a minute of nothing means it's gone.
			silenceMs: 60_000,
			...(fetcher ? { fetcher } : {}),
			init: { method: "POST", body: JSON.stringify(input), headers: { "content-type": "application/json" } },
			onLine: (value) => {
				const line = value as ChaalChallengeLine;
				if (line.type === "challenge") {
					id = line.challenge.id;
					setSent({ state: "waiting", username, id });
				} else if (line.type === "done") {
					if (line.done === "accepted" && id) outcome = { state: "accepted", username, id };
					else if (line.done === "declined") outcome = { state: "declined", username, id };
					else outcome = { state: "canceled", username };
				} else if (line.type === "expired") {
					outcome = { state: "expired", username };
				}
			},
		});
		if (controller.signal.aborted) return;
		const final: SentChallenge =
			outcome ??
			(end.kind === "refused"
				? { state: "failed", username, end }
				: end.kind === "dropped"
					? { state: "failed", username, end: null }
					: { state: "expired", username });
		setSent(final);
		if (final.state === "accepted") accepted.current(final.id);
	};

	const cancel = () => {
		abort.current?.abort();
		abort.current = null;
		setSent((current) => (current ? { state: "canceled", username: current.username } : null));
	};

	return { sent, send, cancel, reset: () => setSent(null) };
}
