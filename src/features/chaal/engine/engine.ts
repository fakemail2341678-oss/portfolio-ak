import { turnOf } from "../chess/rules";
import { ENGINE_SCRIPT, ENGINE_WASM_BYTES } from "./files";
import { type EngineInfo, levelOf, readBestMove, readInfo } from "./uci";

/**
 * Chaal's engine client (PLAN 13.5, "The engine"; decision 0263): Stockfish in a dedicated
 * worker, spoken to in UCI over postMessage. Loaded only by the pages that use it, with
 * `await import()`, and its files are outside the bundle (public/chaal/engine/).
 *
 * One search at a time, as UCI has it: a new `analyse` or `bestMove` stops the one
 * running, waits for its `bestmove`, then starts. A search that's replaced ends with
 * `stopped: true`.
 *
 *   const engine = createEngine({ onProgress });
 *   await engine.ready;
 *   engine.analyse(fen, { multiPv: 3, depth: 20 }, (info) => …);
 */

/** What the client needs of a worker: the browser's `Worker`, or a fake in tests. */
export type EngineWorker = {
	postMessage: (message: unknown, transfer?: Transferable[]) => void;
	terminate: () => void;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent | Event) => void) | null;
};

export type EngineProgress = { loaded: number; total: number };

export type EngineOptions = {
	/** Makes the worker; the browser's by default. */
	createWorker?: () => EngineWorker;
	/** The .wasm's download, as the worker reports it. */
	onProgress?: (progress: EngineProgress) => void;
	/** The transposition table, in MB (`ch_settings.engine.hashMb`). */
	hashMb?: number;
	/** How long the handshake may take before the engine counts as failed. */
	timeoutMs?: number;
};

export type AnalyseOptions = { multiPv: number } & ({ depth: number } | { movetime: number });

export type SearchResult = { bestMove: string | null; stopped: boolean };

export type Engine = {
	/** Resolves once the engine answered `readyok`; rejects if it can't start. */
	ready: Promise<void>;
	/** Searches `fen`, calling `onInfo` with each line as it deepens (multi-PV: one call per line). */
	analyse: (fen: string, options: AnalyseOptions, onInfo: (info: EngineInfo) => void) => Promise<SearchResult>;
	/** A move to play at a level 1–8 (the computer, Task 76). */
	bestMove: (fen: string, options: { level: number }) => Promise<SearchResult>;
	/** Stops the search now (its promise resolves with the best move so far). */
	stop: () => void;
	/** Ends the worker; every call after this does nothing. */
	quit: () => void;
};

type Job = {
	fen: string;
	options: Record<string, string>;
	go: string;
	onInfo?: (info: EngineInfo) => void;
	resolve: (result: SearchResult) => void;
	stopped: boolean;
};

const READY_TIMEOUT_MS = 30_000;

const browserWorker = (): EngineWorker => new Worker(ENGINE_SCRIPT) as unknown as EngineWorker;

export function createEngine({
	createWorker = browserWorker,
	onProgress,
	hashMb = 16,
	timeoutMs = READY_TIMEOUT_MS,
}: EngineOptions = {}): Engine {
	const worker = createWorker();
	let ended = false;
	let current: Job | null = null;
	let pending: Job | null = null;
	/** Options as the engine has them, so only changes are sent. */
	const set = new Map<string, string>();

	const send = (command: string) => {
		if (!ended) worker.postMessage(command);
	};

	let onReady: () => void = () => {};
	let onFail: (error: Error) => void = () => {};
	const ready = new Promise<void>((resolve, reject) => {
		onReady = resolve;
		onFail = reject;
	});
	// A rejection nobody awaits yet isn't an unhandled error: callers see it through `ready`.
	ready.catch(() => {});
	let handshake: "uci" | "isready" | "done" = "uci";
	const timer = setTimeout(() => onFail(new Error("The engine didn't start in time")), timeoutMs);

	const start = (job: Job) => {
		current = job;
		for (const [name, value] of Object.entries(job.options)) {
			if (set.get(name) === value) continue;
			set.set(name, value);
			send(`setoption name ${name} value ${value}`);
		}
		send(`position fen ${job.fen}`);
		send(job.go);
	};

	const finish = (bestMove: string | null) => {
		const job = current;
		current = null;
		job?.resolve({ bestMove, stopped: job.stopped });
		if (pending) {
			const next = pending;
			pending = null;
			start(next);
		}
	};

	worker.onmessage = (event: MessageEvent) => {
		const line = typeof event.data === "string" ? event.data : null;
		if (line === null) return;
		if (handshake === "uci" && line === "uciok") {
			handshake = "isready";
			send(`setoption name Hash value ${hashMb}`);
			set.set("Hash", String(hashMb));
			send("isready");
			return;
		}
		if (handshake === "isready" && line === "readyok") {
			handshake = "done";
			clearTimeout(timer);
			onReady();
			return;
		}
		const best = readBestMove(line);
		if (best !== undefined) {
			finish(best);
			return;
		}
		const job = current;
		if (job?.onInfo && !job.stopped) {
			const info = readInfo(line, turnOf(job.fen) === "black");
			if (info) job.onInfo(info);
		}
	};
	worker.onerror = () => {
		clearTimeout(timer);
		onFail(new Error("The engine stopped"));
		const job = current;
		current = null;
		job?.resolve({ bestMove: null, stopped: true });
		pending?.resolve({ bestMove: null, stopped: true });
		pending = null;
	};

	// The worker reports the .wasm's download on a port of its own (stockfish.js's `progressPort`).
	if (onProgress && typeof MessageChannel !== "undefined") {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event: MessageEvent<{ loaded?: number; total?: number }>) => {
			const { loaded, total } = event.data ?? {};
			if (typeof loaded === "number") onProgress({ loaded, total: total || ENGINE_WASM_BYTES });
		};
		worker.postMessage({ progressPort: channel.port2 }, [channel.port2]);
	}
	send("uci");

	const queue = (job: Omit<Job, "resolve" | "stopped">): Promise<SearchResult> =>
		new Promise<SearchResult>((resolve) => {
			if (ended) {
				resolve({ bestMove: null, stopped: true });
				return;
			}
			const next: Job = { ...job, resolve, stopped: false };
			void ready.then(
				() => {
					if (ended) {
						resolve({ bestMove: null, stopped: true });
						return;
					}
					if (!current) {
						start(next);
						return;
					}
					// One search at a time: the waiting one is replaced, the running one stopped.
					if (pending) {
						pending.resolve({ bestMove: null, stopped: true });
					}
					pending = next;
					if (!current.stopped) {
						current.stopped = true;
						send("stop");
					}
				},
				() => resolve({ bestMove: null, stopped: true }),
			);
		});

	return {
		ready,
		analyse: (fen, options, onInfo) =>
			queue({
				fen,
				onInfo,
				options: { "Skill Level": "20", MultiPV: String(Math.max(1, Math.round(options.multiPv))) },
				go: "depth" in options ? `go depth ${options.depth}` : `go movetime ${options.movetime}`,
			}),
		bestMove: (fen, { level }) => {
			const { skill, depth, movetime } = levelOf(level);
			return queue({
				fen,
				options: { "Skill Level": String(skill), MultiPV: "1" },
				go: `go depth ${depth} movetime ${movetime}`,
			});
		},
		stop: () => {
			pending?.resolve({ bestMove: null, stopped: true });
			pending = null;
			if (current && !current.stopped) {
				current.stopped = true;
				send("stop");
			}
		},
		quit: () => {
			if (ended) return;
			clearTimeout(timer);
			const job = current;
			current = null;
			job?.resolve({ bestMove: null, stopped: true });
			pending?.resolve({ bestMove: null, stopped: true });
			pending = null;
			send("quit");
			ended = true;
			worker.terminate();
			onFail(new Error("The engine was closed"));
		},
	};
}
