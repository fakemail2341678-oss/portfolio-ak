import "@tanstack/react-start/server-only";
import type { ChaalLaneKind } from "@/server/db/schema";

/**
 * This instance's Lichess calls, per endpoint class (PLAN 13.5, "Logging"): calls, errors,
 * 429s and time. The lab shows the running totals (`snapshot`); the health page reads what
 * every instance added to `ch_api_stat` and `ch_api_error` (Task 79, decision 0268): each
 * call is also kept in a pending batch that `drain` hands to the flush (../stats.ts), which
 * `onRecord` starts.
 */
export type CallCounts = { calls: number; errors: number; rateLimited: number; totalMs: number; lastStatus: number };

/** What one call left: its endpoint class, status (0: no answer), time, lane kind and when it started. */
export type CallOutcome = { status: number; ms: number; lane?: ChaalLaneKind; at?: number };

/** Calls not flushed yet: counts by hour (its start, in ms) and endpoint, and the failed calls. */
export type PendingCalls = {
	hours: Map<string, CallCounts & { hour: number; endpoint: string }>;
	errors: Array<{ endpoint: string; status: number; ms: number; lane: ChaalLaneKind; at: number }>;
};

export type Counters = {
	record: (endpoint: string, outcome: CallOutcome) => void;
	snapshot: () => Record<string, CallCounts>;
	/** Takes the calls not flushed yet, leaving none. */
	drain: () => PendingCalls;
};

const HOUR_MS = 3_600_000;
/** Failed calls kept between flushes at most: the table keeps 500. */
const MAX_PENDING_ERRORS = 500;

export const isFailure = (status: number) => status === 0 || status >= 400;

const empty = (): CallCounts => ({ calls: 0, errors: 0, rateLimited: 0, totalMs: 0, lastStatus: 0 });

function add(entry: CallCounts, { status, ms }: CallOutcome) {
	entry.calls += 1;
	entry.totalMs += ms;
	entry.lastStatus = status;
	// 0 is a request that never got an answer (a timeout, a refused connection).
	if (isFailure(status)) entry.errors += 1;
	if (status === 429) entry.rateLimited += 1;
}

export function createCounters({
	onRecord,
	now = Date.now,
}: {
	onRecord?: () => void;
	now?: () => number;
} = {}): Counters {
	const counts = new Map<string, CallCounts>();
	let pending: PendingCalls = { hours: new Map(), errors: [] };
	return {
		record: (endpoint, outcome) => {
			const entry = counts.get(endpoint) ?? empty();
			add(entry, outcome);
			counts.set(endpoint, entry);

			const at = outcome.at ?? now();
			const hour = Math.floor(at / HOUR_MS) * HOUR_MS;
			const key = `${hour}|${endpoint}`;
			const bucket = pending.hours.get(key) ?? { ...empty(), hour, endpoint };
			add(bucket, outcome);
			pending.hours.set(key, bucket);
			if (isFailure(outcome.status)) {
				pending.errors.push({ endpoint, status: outcome.status, ms: outcome.ms, lane: outcome.lane ?? "public", at });
				if (pending.errors.length > MAX_PENDING_ERRORS) pending.errors.shift();
			}
			onRecord?.();
		},
		snapshot: () => Object.fromEntries([...counts].map(([endpoint, entry]) => [endpoint, { ...entry }])),
		drain: () => {
			const taken = pending;
			pending = { hours: new Map(), errors: [] };
			return taken;
		},
	};
}
