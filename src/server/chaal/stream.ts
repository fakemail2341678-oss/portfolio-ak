import "@tanstack/react-start/server-only";
import type { ChaalEvent } from "@/features/chaal/live/events";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { isAppError } from "@/lib/errors";
import { errorFields, log } from "@/server/log";
import { type ChaalUser, type ConnectDeps, withToken } from "./connect/service";
import { userLane } from "./lichess/lanes";
import { mapStreamEvent } from "./lichess/schemas";

/**
 * GET /api/chaal/stream/events (PLAN 13.5, "Live play"; decision 0256): the user's Lichess
 * event stream, through our server so the token never leaves it. Each line is mapped to
 * Chaal's lean event (unknown types are dropped) and keepalives pass through. The route
 * closes itself before the function's time limit with a `reconnect` event, and the client
 * opens it again at once: Lichess restates every current challenge and game on open, so
 * nothing is lost.
 */

/**
 * How long one response stays open: Vercel's Fluid compute stops a function after 300 s on
 * Hobby (the default on every plan; Pro may raise it to 800 s), streaming included. 30 s spare.
 */
export const STREAM_WINDOW_MS = 270_000;

const encoder = new TextEncoder();
const line = (event: ChaalEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

/** An error before the stream opened, as the status and code the client acts on. */
function refusal(error: unknown): Response {
	if (isAppError(error)) {
		return json(error.status, { error: error.code, ...(error.reason ? { reason: error.reason } : {}) });
	}
	log("error", "chaal stream failed to open", errorFields(error));
	return json(500, { error: "INTERNAL" });
}

export type StreamOptions = { windowMs?: number };

export async function eventStream(
	deps: ConnectDeps,
	user: ChaalUser | null,
	{ windowMs = STREAM_WINDOW_MS }: StreamOptions = {},
): Promise<Response> {
	if (!user) return json(401, { error: "UNAUTHORIZED" });
	const blocks = await deps.controls.blocks();
	if (blocks.users.has(user.id)) return json(403, { error: "FORBIDDEN" });

	const upstreamAbort = new AbortController();
	let upstream: ReadableStream<Uint8Array>;
	try {
		upstream = await withToken(deps, user.id, "play", (token) =>
			deps.lichess.stream({
				endpoint: "stream:event",
				path: "/api/stream/event",
				token,
				lane: userLane(user.id),
				signal: upstreamAbort.signal,
			}),
		);
	} catch (error) {
		return refusal(error);
	}

	const opened = Date.now();
	let closing = false;
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const finish = (afterMs: number) => {
				if (closing) return;
				closing = true;
				controller.enqueue(line({ type: "reconnect", afterMs }));
				controller.close();
				upstreamAbort.abort();
			};
			// A first keepalive sends the headers at once, so the client knows it's open.
			controller.enqueue(encoder.encode("\n"));
			const deadline = setTimeout(() => finish(0), windowMs);
			try {
				for await (const text of ndjsonLines(upstream)) {
					if (closing) break;
					if (text === "") {
						controller.enqueue(encoder.encode("\n"));
						continue;
					}
					const event = mapStreamEvent(parseLine(text));
					if (event) controller.enqueue(line(event));
				}
				// Lichess ended it: another stream opened for this token, or Lichess restarted.
				finish(1_000);
			} catch (error) {
				if (!closing) log("warn", "chaal event stream broke", errorFields(error));
				finish(2_000);
			} finally {
				clearTimeout(deadline);
				log("info", "chaal event stream closed", { ms: Date.now() - opened });
			}
		},
		cancel() {
			// The browser went away: stop reading Lichess.
			closing = true;
			upstreamAbort.abort();
		},
	});

	return new Response(body, {
		headers: {
			"content-type": "application/x-ndjson; charset=utf-8",
			"cache-control": "no-store",
			// Proxies that buffer by default (nginx) pass each line on at once.
			"x-accel-buffering": "no",
		},
	});
}
