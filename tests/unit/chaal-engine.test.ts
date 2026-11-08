import { describe, expect, it, vi } from "vitest";
import { createEngine, type EngineWorker } from "@/features/chaal/engine/engine";
import { ENGINE_HASH, ENGINE_SCRIPT, ENGINE_WASM } from "@/features/chaal/engine/files";
import { type EngineInfo, levelOf, readBestMove, readInfo } from "@/features/chaal/engine/uci";

/**
 * The engine client against a fake worker (PLAN Task 75; decision 0263): the UCI
 * handshake, streamed lines with multi-PV, scores turned to White's side, one search at a
 * time (a new one stops the old), levels, stopping and quitting. The real engine runs
 * once in e2e (e2e/flows/chaal.spec.ts).
 */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** A worker that answers the handshake and lets a test speak for the engine. */
function fakeWorker({ answer = true } = {}) {
	const sent: unknown[] = [];
	const worker: EngineWorker & { say: (line: string) => void; sent: unknown[]; terminated: boolean } = {
		sent,
		terminated: false,
		onmessage: null,
		onerror: null,
		postMessage(message) {
			sent.push(message);
			if (!answer) return;
			if (message === "uci") queueMicrotask(() => worker.say("uciok"));
			if (message === "isready") queueMicrotask(() => worker.say("readyok"));
		},
		terminate() {
			worker.terminated = true;
		},
		say(line) {
			worker.onmessage?.({ data: line } as MessageEvent);
		},
	};
	return worker;
}

const commands = (worker: { sent: unknown[] }) => worker.sent.filter((message) => typeof message === "string");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("reading UCI", () => {
	it("reads a line with its score from White's side", () => {
		const line =
			"info depth 18 seldepth 24 multipv 2 score cp 35 nodes 120000 nps 900000 hashfull 12 tbhits 0 time 133 pv e7e5 g1f3 b8c6";
		expect(readInfo(line, false)).toEqual({
			depth: 18,
			seldepth: 24,
			multipv: 2,
			score: { cp: 35 },
			pv: ["e7e5", "g1f3", "b8c6"],
			nodes: 120000,
			nps: 900000,
			time: 133,
		});
		expect(readInfo(line, true)?.score).toEqual({ cp: -35 });
		expect(readInfo("info depth 9 score mate 3 pv d1h5 g7g6 h5g6", true)?.score).toEqual({ mate: -3 });
	});

	it("skips bounds, strings, currmove lines and lines without a move", () => {
		expect(readInfo("info depth 10 score cp 20 upperbound pv e2e4", false)).toBeNull();
		expect(readInfo("info string NNUE evaluation using nn.nnue", false)).toBeNull();
		expect(readInfo("info depth 10 currmove e2e4 currmovenumber 1", false)).toBeNull();
		expect(readInfo("info depth 10 score cp 20", false)).toBeNull();
		expect(readInfo("info depth 0 score mate 0", false)?.score).toEqual({ mate: 0 });
		expect(readInfo("readyok", false)).toBeNull();
	});

	it("reads bestmove, and none when there's no legal move", () => {
		expect(readBestMove("bestmove e2e4 ponder e7e5")).toBe("e2e4");
		expect(readBestMove("bestmove (none)")).toBeNull();
		expect(readBestMove("info depth 1")).toBeUndefined();
	});

	it("maps levels 1–8 to skill, depth and time, clamped", () => {
		expect(levelOf(1)).toEqual({ skill: 0, depth: 1, movetime: 50 });
		expect(levelOf(8).skill).toBe(20);
		expect(levelOf(0)).toEqual(levelOf(1));
		expect(levelOf(12)).toEqual(levelOf(8));
		const skills = [1, 2, 3, 4, 5, 6, 7, 8].map((level) => levelOf(level).skill);
		expect(skills).toEqual([...skills].sort((a, b) => a - b));
	});

	it("names the files with the hash of both", () => {
		expect(ENGINE_SCRIPT).toBe(`/chaal/engine/stockfish-19-lite-single.${ENGINE_HASH}.js`);
		expect(ENGINE_WASM).toBe(ENGINE_SCRIPT.replace(/\.js$/, ".wasm"));
	});
});

describe("the engine client", () => {
	it("shakes hands (uci, Hash, isready) before it's ready", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker, hashMb: 32 });
		await engine.ready;
		expect(commands(worker)).toEqual(["uci", "setoption name Hash value 32", "isready"]);
	});

	it("fails when the worker never answers", async () => {
		vi.useFakeTimers();
		try {
			const engine = createEngine({ createWorker: () => fakeWorker({ answer: false }), timeoutMs: 1_000 });
			const failed = expect(engine.ready).rejects.toThrow(/in time/);
			await vi.advanceTimersByTimeAsync(1_001);
			await failed;
		} finally {
			vi.useRealTimers();
		}
	});

	it("streams multi-PV lines from White's side and ends with the best move", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const infos: EngineInfo[] = [];
		const search = engine.analyse(AFTER_E4, { multiPv: 2, depth: 12 }, (info) => infos.push(info));
		await flush();
		expect(commands(worker).slice(-4)).toEqual([
			"setoption name Skill Level value 20",
			"setoption name MultiPV value 2",
			`position fen ${AFTER_E4}`,
			"go depth 12",
		]);
		worker.say("info depth 12 multipv 1 score cp -20 pv e7e5 g1f3");
		worker.say("info depth 12 multipv 2 score cp -31 pv c7c5 g1f3");
		worker.say("info string ignored");
		worker.say("bestmove e7e5 ponder g1f3");
		await expect(search).resolves.toEqual({ bestMove: "e7e5", stopped: false });
		// Black to move: Stockfish's −20 for Black is +20 for White.
		expect(infos.map((info) => [info.multipv, info.score])).toEqual([
			[1, { cp: 20 }],
			[2, { cp: 31 }],
		]);
	});

	it("sends options only when they change", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const first = engine.analyse(START, { multiPv: 3, depth: 5 }, () => {});
		await flush();
		worker.say("bestmove e2e4");
		await first;
		const before = commands(worker).length;
		const second = engine.analyse(AFTER_E4, { multiPv: 3, depth: 5 }, () => {});
		await flush();
		expect(commands(worker).slice(before)).toEqual([`position fen ${AFTER_E4}`, "go depth 5"]);
		worker.say("bestmove e7e5");
		await second;
	});

	it("runs one search at a time: a new one stops the running one and waits for its bestmove", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const seen: string[] = [];
		const first = engine.analyse(START, { multiPv: 1, depth: 30 }, () => seen.push("first"));
		await flush();
		const second = engine.analyse(AFTER_E4, { multiPv: 1, depth: 30 }, () => seen.push("second"));
		const third = engine.analyse(START, { multiPv: 1, depth: 30 }, () => seen.push("third"));
		await flush();
		expect(commands(worker).filter((command) => command === "stop")).toHaveLength(1);
		// Lines after the stop belong to the old search: nobody hears them.
		worker.say("info depth 20 multipv 1 score cp 30 pv e2e4");
		worker.say("bestmove e2e4");
		await expect(first).resolves.toEqual({ bestMove: "e2e4", stopped: true });
		// The second never started: the third replaced it.
		await expect(second).resolves.toEqual({ bestMove: null, stopped: true });
		await flush();
		expect(commands(worker).at(-2)).toBe(`position fen ${START}`);
		worker.say("info depth 1 multipv 1 score cp 25 pv d2d4");
		worker.say("bestmove d2d4");
		await expect(third).resolves.toEqual({ bestMove: "d2d4", stopped: false });
		expect(seen).toEqual(["third"]);
	});

	it("plays at a level with its skill, depth and time", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const move = engine.bestMove(START, { level: 2 });
		await flush();
		expect(commands(worker).slice(-4)).toEqual([
			"setoption name Skill Level value 3",
			"setoption name MultiPV value 1",
			`position fen ${START}`,
			"go depth 2 movetime 100",
		]);
		worker.say("bestmove g1f3");
		await expect(move).resolves.toEqual({ bestMove: "g1f3", stopped: false });
	});

	it("stops on request, and quits for good", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const search = engine.analyse(START, { multiPv: 1, depth: 40 }, () => {});
		await flush();
		engine.stop();
		expect(commands(worker).at(-1)).toBe("stop");
		worker.say("bestmove e2e4");
		await expect(search).resolves.toEqual({ bestMove: "e2e4", stopped: true });

		const running = engine.analyse(START, { multiPv: 1, depth: 40 }, () => {});
		await flush();
		engine.quit();
		await expect(running).resolves.toEqual({ bestMove: null, stopped: true });
		expect(commands(worker).at(-1)).toBe("quit");
		expect(worker.terminated).toBe(true);
		await expect(engine.analyse(START, { multiPv: 1, depth: 1 }, () => {})).resolves.toEqual({
			bestMove: null,
			stopped: true,
		});
	});

	it("reports the download on the worker's progress port", async () => {
		const worker = fakeWorker();
		const progress = vi.fn();
		createEngine({ createWorker: () => worker, onProgress: progress });
		const port = (worker.sent[0] as { progressPort?: MessagePort }).progressPort;
		expect(port).toBeDefined();
		port?.postMessage({ loaded: 500, total: 1000, percent: 0.5 });
		await vi.waitFor(() => expect(progress).toHaveBeenCalledWith({ loaded: 500, total: 1000 }));
		port?.close();
	});

	it("fails and ends its searches when the worker errors", async () => {
		const worker = fakeWorker();
		const engine = createEngine({ createWorker: () => worker });
		await engine.ready;
		const search = engine.analyse(START, { multiPv: 1, depth: 40 }, () => {});
		await flush();
		worker.onerror?.(new Event("error"));
		await expect(search).resolves.toEqual({ bestMove: null, stopped: true });
	});
});
