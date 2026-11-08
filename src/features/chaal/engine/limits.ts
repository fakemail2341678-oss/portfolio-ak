/**
 * The engine's limits in the browser (PLAN 13.5, "Lifecycle"; decision 0263), set by the
 * admin in `ch_settings.engine` (its form arrives with Task 79) and sent to every page
 * with the status. Stored values are read through `readEngineLimits`, which clamps them
 * to what the lite single-threaded build can do on a phone.
 */
export type EngineLimits = {
	/** The depth a search stops at. */
	maxDepth: number;
	/** How many lines (multi-PV) the analysis board shows. */
	multiPv: number;
	/** The transposition table, in MB. */
	hashMb: number;
};

export const DEFAULT_ENGINE_LIMITS: EngineLimits = { maxDepth: 22, multiPv: 3, hashMb: 16 };

export const ENGINE_BOUNDS = {
	maxDepth: { min: 8, max: 30 },
	multiPv: { min: 1, max: 5 },
	hashMb: { min: 1, max: 64 },
} as const;

const clamp = (value: unknown, { min, max }: { min: number; max: number }, fallback: number) =>
	typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export function readEngineLimits(value: Partial<EngineLimits> | null | undefined): EngineLimits {
	return {
		maxDepth: clamp(value?.maxDepth, ENGINE_BOUNDS.maxDepth, DEFAULT_ENGINE_LIMITS.maxDepth),
		multiPv: clamp(value?.multiPv, ENGINE_BOUNDS.multiPv, DEFAULT_ENGINE_LIMITS.multiPv),
		hashMb: clamp(value?.hashMb, ENGINE_BOUNDS.hashMb, DEFAULT_ENGINE_LIMITS.hashMb),
	};
}
