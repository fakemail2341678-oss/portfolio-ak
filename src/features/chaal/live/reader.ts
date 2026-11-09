import { ndjsonLines, parseLine } from "./ndjson";

/**
 * Reading Chaal's streams in the browser (PLAN 13.5, "Live play"; decision 0266): one
 * response at a time (`readStream`), and a stream kept open across the server's windows,
 * Lichess's restarts and the network dropping (`keepStreaming`). Every stream restates its
 * state when it opens, so a reconnect loses nothing.
 */

/** How a response ended. */
export type StreamEnd =
	/** The server asked for a reconnect (its window ran out, or Lichess ended the upstream). */
	| { kind: "reconnect"; afterMs: number }
	/** The server closed it with nothing more to say (a game over, a challenge answered). */
	| { kind: "closed" }
	/** Refused before it opened: the status and the server's `{ error, reason }`. */
	| { kind: "refused"; status: number; error: string | null; reason: string | null }
	/** The network or the reading failed, or nothing came for too long. */
	| { kind: "dropped" }
	/** Stopped from this side. */
	| { kind: "stopped" };

export type ReadOptions = {
	init?: RequestInit;
	signal: AbortSignal;
	onOpen?: () => void;
	onLine: (value: unknown) => void;
	/** Each keepalive (an empty line), counted from the first. */
	onKeepalive?: (count: number) => void;
	/** Nothing for this long (not even a keepalive) means the connection is gone. Lichess sends one every 7 s. */
	silenceMs?: number;
	fetcher?: typeof fetch;
};

const SILENCE_MS = 20_000;

async function refusalOf(response: Response): Promise<StreamEnd> {
	let body: { error?: unknown; reason?: unknown } = {};
	try {
		body = (await response.json()) as typeof body;
	} catch {
		// Not JSON: the status says enough.
	}
	return {
		kind: "refused",
		status: response.status,
		error: typeof body.error === "string" ? body.error : null,
		reason: typeof body.reason === "string" ? body.reason : null,
	};
}

/** Reads one response of a stream route to its end. */
export async function readStream(url: string, options: ReadOptions): Promise<StreamEnd> {
	const { signal, onOpen, onLine, onKeepalive, silenceMs = SILENCE_MS, fetcher = fetch } = options;
	const local = new AbortController();
	const stop = () => local.abort();
	signal.addEventListener("abort", stop, { once: true });
	let silent = false;
	let watchdog: ReturnType<typeof setTimeout> | undefined;
	const listen = () => {
		clearTimeout(watchdog);
		watchdog = setTimeout(() => {
			silent = true;
			local.abort();
		}, silenceMs);
	};
	try {
		listen();
		const response = await fetcher(url, {
			...options.init,
			signal: local.signal,
			credentials: "same-origin",
			headers: { accept: "application/x-ndjson", ...(options.init?.headers as Record<string, string> | undefined) },
		});
		if (!response.ok || !response.body) {
			clearTimeout(watchdog);
			return await refusalOf(response);
		}
		onOpen?.();
		let reconnect: number | null = null;
		let keepalives = 0;
		for await (const text of ndjsonLines(response.body)) {
			listen();
			if (text === "") {
				keepalives += 1;
				onKeepalive?.(keepalives);
				continue;
			}
			const value = parseLine(text);
			if (value === undefined) continue;
			const type = (value as { type?: unknown }).type;
			if (type === "reconnect") {
				const after = (value as { afterMs?: unknown }).afterMs;
				reconnect = typeof after === "number" && after >= 0 ? after : 1_000;
				continue;
			}
			onLine(value);
		}
		return reconnect === null ? { kind: "closed" } : { kind: "reconnect", afterMs: reconnect };
	} catch {
		if (signal.aborted) return { kind: "stopped" };
		return { kind: "dropped" };
	} finally {
		clearTimeout(watchdog);
		signal.removeEventListener("abort", stop);
		if (silent && !signal.aborted) local.abort();
	}
}

/** Where a kept stream stands: connecting, open, waiting to try again (offline), or refused for good. */
export type StreamStatus =
	| { state: "connecting" }
	| { state: "open" }
	| { state: "waiting"; retryInMs: number }
	| { state: "refused"; status: number; error: string | null; reason: string | null };

export type KeepOptions = Omit<ReadOptions, "signal" | "onOpen"> & {
	onStatus?: (status: StreamStatus) => void;
	/** After the server closed it for good (`closed`): true to open it again (the event stream), false to stop. */
	reopenWhenClosed?: boolean;
	/** For tests: how waiting is done. */
	sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
	/** For tests: the clock that tells a short-lived stream from a long one. */
	now?: () => number;
};

const MAX_BACKOFF_MS = 30_000;
/** A stream that stayed open this long was healthy: the next drop starts the backoff again. */
const HEALTHY_MS = 30_000;
/** Lichess asks for a minute after a 429. */
const RATE_LIMIT_MS = 60_000;

const wait = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted || ms <= 0) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});

/**
 * Keeps a stream open until `stop()`: reconnects at once when the server asks, backs off
 * (1 s, doubling to 30 s) when the network drops or a stream keeps ending soon after it
 * opened (another device holding Lichess's one event stream per token), waits a minute
 * after a 429, and gives up on a refusal it can't fix (401, 403, 404, 400).
 */
export function keepStreaming(url: string, options: KeepOptions): { stop: () => void } {
	const controller = new AbortController();
	const { onStatus, reopenWhenClosed = false, sleep = wait, now = () => Date.now(), ...read } = options;
	void (async () => {
		let backoff = 0;
		while (!controller.signal.aborted) {
			onStatus?.({ state: "connecting" });
			let openedAt: number | null = null;
			const end = await readStream(url, {
				...read,
				signal: controller.signal,
				onOpen: () => {
					openedAt = now();
					onStatus?.({ state: "open" });
				},
			});
			if (controller.signal.aborted || end.kind === "stopped") return;
			const lasted = openedAt === null ? 0 : now() - openedAt;
			const next = (base: number) => {
				backoff = lasted >= HEALTHY_MS ? 0 : Math.min(MAX_BACKOFF_MS, backoff === 0 ? 1_000 : backoff * 2);
				return Math.max(base, backoff);
			};
			let delay: number;
			if (end.kind === "refused") {
				if (end.status === 429) delay = RATE_LIMIT_MS;
				else if (end.status >= 500) delay = next(1_000);
				else {
					onStatus?.({ state: "refused", status: end.status, error: end.error, reason: end.reason });
					return;
				}
			} else if (end.kind === "closed") {
				if (!reopenWhenClosed) return;
				delay = next(1_000);
			} else if (end.kind === "reconnect") {
				// A window running out is routine; Lichess ending a fresh stream again and again isn't.
				delay = end.afterMs === 0 && lasted >= HEALTHY_MS ? 0 : next(end.afterMs);
			} else {
				delay = next(1_000);
			}
			if (delay > 0) onStatus?.({ state: "waiting", retryInMs: delay });
			await sleep(delay, controller.signal);
		}
	})();
	return { stop: () => controller.abort() };
}
