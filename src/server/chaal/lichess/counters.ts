import "@tanstack/react-start/server-only";

/**
 * This instance's Lichess calls, per endpoint class (PLAN 13.5, "Logging"): calls, errors,
 * 429s and time. The lab shows them; Task 79 flushes them hourly to `ch_api_stat` for the
 * health page.
 */
export type CallCounts = { calls: number; errors: number; rateLimited: number; totalMs: number; lastStatus: number };

export type Counters = {
	record: (endpoint: string, outcome: { status: number; ms: number }) => void;
	snapshot: () => Record<string, CallCounts>;
};

export function createCounters(): Counters {
	const counts = new Map<string, CallCounts>();
	return {
		record: (endpoint, { status, ms }) => {
			const entry = counts.get(endpoint) ?? { calls: 0, errors: 0, rateLimited: 0, totalMs: 0, lastStatus: 0 };
			entry.calls += 1;
			entry.totalMs += ms;
			entry.lastStatus = status;
			// 0 is a request that never got an answer (a timeout, a refused connection).
			if (status === 0 || status >= 400) entry.errors += 1;
			if (status === 429) entry.rateLimited += 1;
			counts.set(endpoint, entry);
		},
		snapshot: () => Object.fromEntries([...counts].map(([endpoint, entry]) => [endpoint, { ...entry }])),
	};
}
