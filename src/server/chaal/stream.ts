import "@tanstack/react-start/server-only";
import { featureOn } from "@/features/chaal/features";
import type { ChaalChallengeLine, ChaalEvent, ChaalGameLine, ChaalSeekLine } from "@/features/chaal/live/events";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { challengePlayerInput, seekInput } from "@/features/chaal/play/schema";
import { isAppError } from "@/lib/errors";
import { errorFields, log } from "@/server/log";
import { modeOfSource, recordActivity } from "./activity";
import { type ChaalUser, type ConnectDeps, withToken } from "./connect/service";
import { userLane } from "./lichess/lanes";
import { mapChallengeLine, mapGameLine, mapStreamEvent } from "./lichess/schemas";
import { cancelChallenge, challengeForm, checkChallenge, seekForm } from "./play/service";

/**
 * Chaal's streams through our server (PLAN 13.5, "Live play"; decisions 0256 and 0266), so
 * a token never leaves it:
 * - GET /api/chaal/stream/events: the user's Lichess event stream;
 * - GET /api/chaal/stream/game/{id}: a Board API game's stream (Task 77);
 * - POST /api/chaal/stream/challenge: a real-time challenge to a player, kept open by
 *   Lichess's `keepAliveStream` while this response lasts (Task 77);
 * - POST /api/chaal/stream/seek: a seek in the lobby on a clock, open while it waits (Task 78).
 * Each line is mapped to Chaal's lean shape (unknown types are dropped) and keepalives pass
 * through. A stream closes itself before the function's time limit; the event and game
 * streams then say `reconnect` and the client opens them again at once (Lichess restates
 * everything when they open, so nothing is lost); a challenge nobody answered in that time
 * is cancelled and said `expired`.
 */

/**
 * How long one response stays open: Vercel's Fluid compute stops a function after 300 s on
 * Hobby (the default on every plan; Pro may raise it to 800 s), streaming included. 30 s spare.
 */
export const STREAM_WINDOW_MS = 270_000;

const encoder = new TextEncoder();
const lineOf = (value: object) => encoder.encode(`${JSON.stringify(value)}\n`);

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

/** Why a relay ended: its window ran out, Lichess ended it, it broke, or the browser went away. */
type Ending = "window" | "ended" | "broke" | "client";

type Relay<L extends object> = {
	name: string;
	upstream: ReadableStream<Uint8Array>;
	abort: AbortController;
	map: (value: unknown) => L | null;
	windowMs: number;
	/** The last line, by why the relay ends (none for the browser going away); null sends nothing. */
	closing: (ending: Exclude<Ending, "client">) => object | null;
	onLine?: (line: L) => void;
	onEnd?: (ending: Ending) => void;
};

/** Passes a Lichess stream on: mapped lines and keepalives, then one closing line. */
function relay<L extends object>({ name, upstream, abort, map, windowMs, closing, onLine, onEnd }: Relay<L>): Response {
	const opened = Date.now();
	let closed = false;
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const finish = (ending: Exclude<Ending, "client">) => {
				if (closed) return;
				closed = true;
				const last = closing(ending);
				if (last) controller.enqueue(lineOf(last));
				controller.close();
				abort.abort();
				onEnd?.(ending);
			};
			// A first keepalive sends the headers at once, so the client knows it's open.
			controller.enqueue(encoder.encode("\n"));
			const deadline = setTimeout(() => finish("window"), windowMs);
			try {
				for await (const text of ndjsonLines(upstream)) {
					if (closed) break;
					if (text === "") {
						controller.enqueue(encoder.encode("\n"));
						continue;
					}
					const line = map(parseLine(text));
					if (!line) continue;
					controller.enqueue(lineOf(line));
					onLine?.(line);
				}
				finish("ended");
			} catch (error) {
				if (!closed) log("warn", `chaal ${name} stream broke`, errorFields(error));
				finish("broke");
			} finally {
				clearTimeout(deadline);
				log("info", `chaal ${name} stream closed`, { ms: Date.now() - opened });
			}
		},
		cancel() {
			// The browser went away: stop reading Lichess.
			if (closed) return;
			closed = true;
			abort.abort();
			onEnd?.("client");
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

/** The reconnect line for the event and game streams: at once after the window, a second after Lichess ended it, two after a break. */
const reconnect = (ending: Exclude<Ending, "client">) =>
	({ type: "reconnect", afterMs: ending === "window" ? 0 : ending === "ended" ? 1_000 : 2_000 }) as const;

/** Refused before Lichess is asked: no session, or a blocked user. */
async function gate(deps: ConnectDeps, user: ChaalUser | null): Promise<Response | null> {
	if (!user) return json(401, { error: "UNAUTHORIZED" });
	const blocks = await deps.controls.blocks();
	return blocks.users.has(user.id) ? json(403, { error: "FORBIDDEN" }) : null;
}

export async function eventStream(
	deps: ConnectDeps,
	user: ChaalUser | null,
	{ windowMs = STREAM_WINDOW_MS }: StreamOptions = {},
): Promise<Response> {
	const refused = await gate(deps, user);
	if (refused || !user) return refused ?? json(401, { error: "UNAUTHORIZED" });
	const abort = new AbortController();
	let upstream: ReadableStream<Uint8Array>;
	try {
		upstream = await withToken(deps, user.id, "play", (token) =>
			deps.lichess.stream({
				endpoint: "stream:event",
				path: "/api/stream/event",
				token,
				lane: userLane(user.id),
				signal: abort.signal,
			}),
		);
	} catch (error) {
		return refusal(error);
	}
	return relay<ChaalEvent>({
		name: "event",
		upstream,
		abort,
		map: mapStreamEvent,
		windowMs,
		closing: reconnect,
		onLine: (event) => {
			// A game that has just started counts once (decision 0266); a restated one that has moves doesn't.
			if (event.type === "gameStart" && !event.game.hasMoved) {
				void recordActivity(deps.db, {
					userId: user.id,
					kind: "game",
					mode: modeOfSource(event.game.source),
					ref: event.game.id,
				});
			}
		},
	});
}

/** A game's id in a stream route's path: `/api/chaal/stream/game/{id}`. */
export const GAME_ID = /^[A-Za-z0-9]{8}$/;

export async function gameStream(
	deps: ConnectDeps,
	user: ChaalUser | null,
	gameId: string,
	{ windowMs = STREAM_WINDOW_MS }: StreamOptions = {},
): Promise<Response> {
	const refused = await gate(deps, user);
	if (refused || !user) return refused ?? json(401, { error: "UNAUTHORIZED" });
	if (!GAME_ID.test(gameId)) return json(404, { error: "NOT_FOUND" });
	const abort = new AbortController();
	let upstream: ReadableStream<Uint8Array>;
	try {
		upstream = await withToken(deps, user.id, "play", (token) =>
			deps.lichess.stream({
				endpoint: "stream:game",
				path: `/api/board/game/stream/${gameId}`,
				token,
				lane: userLane(user.id),
				signal: abort.signal,
			}),
		);
	} catch (error) {
		return refusal(error);
	}
	const chat = featureOn((await deps.controls.settings()).features, "chat");
	return relay<ChaalGameLine>({
		name: "game",
		upstream,
		abort,
		// With chat off, its lines never reach the page.
		map: (value) => {
			const line = mapGameLine(value);
			return line?.type === "chatLine" && !chat ? null : line;
		},
		windowMs,
		closing: reconnect,
	});
}

/**
 * A real-time challenge to a player: Lichess keeps it while this response is open (its
 * `keepAliveStream`), then says how it ended (`done`). Nobody answering within the window,
 * the stream breaking or the page going away cancels it at Lichess.
 */
export async function challengeStream(
	deps: ConnectDeps,
	user: ChaalUser | null,
	body: unknown,
	{ windowMs = STREAM_WINDOW_MS }: StreamOptions = {},
): Promise<Response> {
	const refused = await gate(deps, user);
	if (refused || !user) return refused ?? json(401, { error: "UNAUTHORIZED" });
	const parsed = challengePlayerInput.safeParse(body);
	if (!parsed.success || parsed.data.pace.kind !== "clock") return json(400, { error: "BAD_REQUEST" });
	const input = parsed.data;
	const abort = new AbortController();
	let upstream: ReadableStream<Uint8Array>;
	try {
		await checkChallenge(deps, input);
		upstream = await withToken(deps, user.id, "play", (token) =>
			deps.lichess.stream({
				endpoint: "stream:challenge",
				method: "POST",
				path: `/api/challenge/${encodeURIComponent(input.username)}`,
				form: challengeForm(input, { keepAliveStream: "true" }),
				token,
				lane: userLane(user.id),
				signal: abort.signal,
			}),
		);
	} catch (error) {
		return refusal(error);
	}
	let challengeId: string | null = null;
	let done = false;
	return relay<ChaalChallengeLine>({
		name: "challenge",
		upstream,
		abort,
		map: mapChallengeLine,
		windowMs,
		closing: () => (done ? null : { type: "expired" }),
		onLine: (line) => {
			if (line.type === "challenge") challengeId = line.challenge.id;
			if (line.type === "done") {
				done = true;
				if (line.done === "accepted" && challengeId) {
					void recordActivity(deps.db, { userId: user.id, kind: "game", mode: "challenge", ref: challengeId });
				}
			}
		},
		onEnd: () => {
			// Not answered: take it back at Lichess, so the player doesn't accept a challenge nobody waits for.
			if (done || !challengeId) return;
			void cancelChallenge(deps, user.id, challengeId).catch((error: unknown) =>
				log("warn", "chaal challenge cancel failed", errorFields(error)),
			);
		},
	});
}

/**
 * A seek in Lichess's lobby on a clock (quick pairing, Task 78, decision 0267): Lichess keeps
 * it while this response is open, sends nothing but keepalives, and closes it when someone
 * accepts it (the game arrives on the event stream) or it expires: `ended`. Our window
 * running out or the stream breaking says `reconnect`, and the page seeks again at once.
 * Closing the response (the player cancels or leaves) cancels the seek at Lichess.
 */
export async function seekStream(
	deps: ConnectDeps,
	user: ChaalUser | null,
	body: unknown,
	{ windowMs = STREAM_WINDOW_MS }: StreamOptions = {},
): Promise<Response> {
	const refused = await gate(deps, user);
	if (refused || !user) return refused ?? json(401, { error: "UNAUTHORIZED" });
	const parsed = seekInput.safeParse(body);
	if (!parsed.success || parsed.data.pace.kind !== "clock") return json(400, { error: "BAD_REQUEST" });
	const input = parsed.data;
	const abort = new AbortController();
	let upstream: ReadableStream<Uint8Array>;
	try {
		upstream = await withToken(deps, user.id, "play", async (token) =>
			deps.lichess.stream({
				endpoint: "stream:seek",
				method: "POST",
				path: "/api/board/seek",
				form: await seekForm(deps, user.id, token, input),
				token,
				lane: userLane(user.id),
				signal: abort.signal,
			}),
		);
	} catch (error) {
		return refusal(error);
	}
	return relay<ChaalSeekLine>({
		name: "seek",
		upstream,
		abort,
		// Lichess sends only keepalives: anything else isn't ours to pass on.
		map: () => null,
		windowMs,
		closing: (ending) => (ending === "ended" ? { type: "ended" } : reconnect(ending)),
	});
}

/**
 * A POST from one of our pages, not another site's (the stream routes run outside the server
 * functions' CSRF check): the browser's `Sec-Fetch-Site`, else the `Origin`.
 */
export function sameOrigin(headers: Headers, url: string): boolean {
	const site = headers.get("sec-fetch-site");
	if (site) return site === "same-origin";
	const origin = headers.get("origin");
	return origin !== null && origin === new URL(url).origin;
}
