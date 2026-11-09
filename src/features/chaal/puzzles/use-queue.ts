import { useEffect, useRef, useState } from "react";
import { isAppError } from "@/lib/errors";
import type { ChaalPuzzle, ChaalPuzzleBatch, PuzzleBatchInput, PuzzleGlicko } from "./schema";

/** Another batch is asked for when fewer than this many puzzles are left ahead. */
export const REFILL_AT = 5;

export type QueueChoice = Omit<PuzzleBatchInput, "round">;

type Lane = {
	puzzles: ChaalPuzzle[];
	loading: boolean;
	error: "wait" | "failed" | null;
	/** The last batch brought nothing new: Lichess has no more for this choice now. */
	exhausted: boolean;
};

const keyOf = (choice: QueueChoice) =>
	[choice.angle, choice.difficulty ?? "", choice.color ?? "", choice.streak ? "streak" : ""].join("|");

const emptyLane = (): Lane => ({ puzzles: [], loading: false, error: null, exhausted: false });

export type FetchBatch = (input: PuzzleBatchInput) => Promise<ChaalPuzzleBatch>;

const fetchFromServer: FetchBatch = async (input) => {
	const { getChaalPuzzleBatch } = await import("@/functions/chaal/puzzles");
	return getChaalPuzzleBatch({ data: input });
};

/**
 * Training's queue (PLAN Task 80, "15 puzzles ahead"; decision 0269): puzzles by choice
 * (theme, difficulty, side, the streak), starting from the batch the page was drawn with.
 * When fewer than REFILL_AT are left ahead, the next batch is asked for (a full batch is
 * the admin's `ahead`, 15 by default), skipping puzzles already in the queue. `upcoming`
 * is a choice to have ready too (the streak's next difficulty), so switching waits for nothing.
 */
export function usePuzzleQueue({
	choice,
	first,
	upcoming = null,
	fetchBatch = fetchFromServer,
}: {
	choice: QueueChoice;
	/** The batch the loader read for `choice` (round 0). */
	first: ChaalPuzzleBatch | null;
	upcoming?: QueueChoice | null;
	fetchBatch?: FetchBatch;
}) {
	const [lanes, setLanes] = useState<Record<string, Lane>>(() =>
		first ? { [keyOf(choice)]: { ...emptyLane(), puzzles: first.puzzles } } : {},
	);
	const [played, setPlayed] = useState<ReadonlySet<string>>(() => new Set());
	const [glicko, setGlicko] = useState<PuzzleGlicko | null>(first?.glicko ?? null);
	const rounds = useRef<Record<string, number>>({});
	const asking = useRef(new Set<string>());
	const firstKey = useRef(first ? keyOf(choice) : null);

	const key = keyOf(choice);
	const lane = lanes[key] ?? emptyLane();
	const ahead = lane.puzzles.filter((puzzle) => !played.has(puzzle.id));
	const current = ahead[0] ?? null;

	const upcomingKey = upcoming ? keyOf(upcoming) : null;
	const upcomingLane = upcomingKey ? (lanes[upcomingKey] ?? emptyLane()) : null;
	const wantsCurrent = !lane.loading && !lane.error && !lane.exhausted && ahead.length < REFILL_AT;
	const wantsUpcoming =
		upcoming !== null &&
		upcomingLane !== null &&
		!upcomingLane.loading &&
		!upcomingLane.error &&
		upcomingLane.puzzles.length === 0;

	useEffect(() => {
		const load = (laneKey: string, laneChoice: QueueChoice) => {
			if (asking.current.has(laneKey)) return;
			asking.current.add(laneKey);
			// Counted here, not in state: a queue's batches never repeat a round.
			const round = rounds.current[laneKey] ?? (laneKey === firstKey.current ? 1 : 0);
			rounds.current[laneKey] = round + 1;
			setLanes((all) => ({ ...all, [laneKey]: { ...(all[laneKey] ?? emptyLane()), loading: true } }));
			fetchBatch({ ...laneChoice, round })
				.then((batch) => {
					setLanes((all) => {
						const was = all[laneKey] ?? emptyLane();
						const known = new Set(was.puzzles.map((puzzle) => puzzle.id));
						const fresh = batch.puzzles.filter((puzzle) => !known.has(puzzle.id));
						return {
							...all,
							[laneKey]: {
								puzzles: [...was.puzzles, ...fresh],
								loading: false,
								error: null,
								exhausted: fresh.length === 0,
							},
						};
					});
					if (batch.glicko) setGlicko(batch.glicko);
				})
				.catch((error: unknown) => {
					const wait = isAppError(error) && error.code === "RATE_LIMITED";
					setLanes((all) => ({
						...all,
						[laneKey]: { ...(all[laneKey] ?? emptyLane()), loading: false, error: wait ? "wait" : "failed" },
					}));
				})
				.finally(() => asking.current.delete(laneKey));
		};
		if (wantsCurrent) load(key, choice);
		if (wantsUpcoming && upcomingKey && upcoming) load(upcomingKey, upcoming);
	}, [wantsCurrent, wantsUpcoming, key, upcomingKey, choice, upcoming, fetchBatch]);

	return {
		current,
		/** Puzzles ready after the current one. */
		ready: Math.max(0, ahead.length - 1),
		loading: lane.loading,
		error: lane.error,
		exhausted: lane.exhausted && current === null,
		glicko,
		/** The current puzzle is done: the next one comes up. */
		next: () => {
			if (current) setPlayed((was) => new Set([...was, current.id]));
		},
		/** After an error: ask again. */
		retry: () => setLanes((all) => ({ ...all, [key]: { ...(all[key] ?? emptyLane()), error: null } })),
	};
}
