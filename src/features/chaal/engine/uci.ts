import type { Score } from "../chess/eval";

/**
 * Reading Stockfish's UCI lines (PLAN 13.5, "The engine"; decision 0263). Pure, so the
 * engine client and its tests share it. Scores are turned to White's point of view (UCI
 * gives them from the side to move's), as every score in Chaal is (`Score`, PGN's
 * `[%eval]`, Lichess's cloud eval).
 */
export type EngineInfo = {
	depth: number;
	seldepth: number | null;
	/** 1 for the best line. */
	multipv: number;
	/** From White's point of view. */
	score: Score;
	/** The line, in UCI. */
	pv: string[];
	nodes: number | null;
	nps: number | null;
	/** Milliseconds since the search started. */
	time: number | null;
};

const NUMBER_FIELDS = ["depth", "seldepth", "multipv", "nodes", "nps", "time"] as const;

/**
 * An `info` line with a score and a line, or null (`info string …`, `currmove`, a bound
 * that isn't a score yet: Lichess skips `lowerbound` and `upperbound` too).
 * `blackToMove` turns the score to White's side.
 */
export function readInfo(line: string, blackToMove: boolean): EngineInfo | null {
	if (!line.startsWith("info ")) return null;
	const words = line.split(" ");
	const numbers: Partial<Record<(typeof NUMBER_FIELDS)[number], number>> = {};
	let score: Score | null = null;
	let pv: string[] = [];
	for (let index = 1; index < words.length; index += 1) {
		const word = words[index];
		if (word === "string") return null;
		if (word === "pv") {
			pv = words.slice(index + 1).filter(Boolean);
			break;
		}
		if (word === "score") {
			const kind = words[index + 1];
			const value = Number(words[index + 2]);
			if (!Number.isFinite(value)) return null;
			if (words[index + 3] === "lowerbound" || words[index + 3] === "upperbound") return null;
			const sign = blackToMove ? -1 : 1;
			if (kind === "cp") score = { cp: value * sign };
			else if (kind === "mate") score = { mate: value * sign };
			index += 2;
			continue;
		}
		if ((NUMBER_FIELDS as ReadonlyArray<string>).includes(word ?? "")) {
			const value = Number(words[index + 1]);
			if (Number.isFinite(value)) numbers[word as (typeof NUMBER_FIELDS)[number]] = value;
			index += 1;
		}
	}
	if (!score || numbers.depth === undefined) return null;
	// "score mate 0" (the side to move is mated) comes with no line; any other score needs one.
	if (pv.length === 0 && !("mate" in score && score.mate === 0)) return null;
	return {
		depth: numbers.depth,
		seldepth: numbers.seldepth ?? null,
		multipv: numbers.multipv ?? 1,
		score,
		pv,
		nodes: numbers.nodes ?? null,
		nps: numbers.nps ?? null,
		time: numbers.time ?? null,
	};
}

/** `bestmove e2e4 ponder e7e5` → "e2e4"; `bestmove (none)` (no legal move) → null; anything else → undefined. */
export function readBestMove(line: string): string | null | undefined {
	if (!line.startsWith("bestmove")) return undefined;
	const move = line.split(" ")[1];
	return !move || move === "(none)" ? null : move;
}

/**
 * Playing strength for levels 1–8 (the computer, Task 76): Stockfish's `Skill Level`
 * (0–20) with a depth and a time per move, so low levels are both weak and quick. Level 8
 * is full strength within its time.
 */
export type EngineLevel = { skill: number; depth: number; movetime: number };

const FULL_STRENGTH: EngineLevel = { skill: 20, depth: 22, movetime: 1000 };

export const ENGINE_LEVELS: ReadonlyArray<EngineLevel> = [
	{ skill: 0, depth: 1, movetime: 50 },
	{ skill: 3, depth: 2, movetime: 100 },
	{ skill: 6, depth: 3, movetime: 150 },
	{ skill: 9, depth: 5, movetime: 200 },
	{ skill: 11, depth: 8, movetime: 300 },
	{ skill: 14, depth: 12, movetime: 400 },
	{ skill: 17, depth: 16, movetime: 600 },
	FULL_STRENGTH,
];

/** Level 1–8 (rounded and clamped). */
export const levelOf = (level: number): EngineLevel =>
	ENGINE_LEVELS[Math.min(8, Math.max(1, Math.round(level))) - 1] ?? FULL_STRENGTH;
