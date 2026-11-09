import "@tanstack/react-start/server-only";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { featureOn, missingScopes } from "@/features/chaal/features";
import type { PuzzleAngle } from "@/features/chaal/puzzles/angles";
import { readPuzzleLimits } from "@/features/chaal/puzzles/limits";
import { progressOf } from "@/features/chaal/puzzles/progress";
import {
	type ChaalPuzzle,
	type ChaalPuzzleBatch,
	type ChaalPuzzleProgress,
	type ChaalPuzzleReplay,
	PROGRESS_DAYS,
	type PuzzleAttempt,
	type PuzzleBatchInput,
	puzzleAttemptSchema,
} from "@/features/chaal/puzzles/schema";
import { AppError, isAppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { chPuzzleAttempt } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { recordActivity } from "../activity";
import { connectionOf } from "../connect/repository";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import type { ChaalCache } from "../lichess/cache";
import { untilUtcMidnight } from "../lichess/cache";
import { userLane } from "../lichess/lanes";
import {
	puzzleAnswer,
	puzzleBatchAnswer,
	puzzleDashboardAnswer,
	puzzleReplayAnswer,
	puzzleSolveAnswer,
} from "../lichess/schemas";

/**
 * Puzzles (PLAN Task 80, decision 0269). Public reads go through the client and the cache:
 * the daily puzzle until the next UTC midnight, a puzzle by id for a week (they don't
 * change), and visitors' batches by the page's round (10 minutes for the first, so a page's
 * first paint never asks Lichess twice, a minute after). A player connected with the puzzle
 * scopes trains on their own batches (unseen puzzles at their rating), with their token on
 * their lane, never cached. Attempts are stored for anyone with a session; a connected
 * player's are posted to Lichess in batches (PUZZLE_SYNC_AT at a time, or with the next
 * batch or the progress panel), the streak's never (they aren't rated).
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const TTL = {
	byId: 7 * DAY,
	firstBatch: 10 * MINUTE,
	nextBatch: MINUTE,
	dashboard: 10 * MINUTE,
} as const;

/** A player keeps this many attempts: the oldest go. */
export const PUZZLE_ATTEMPTS_MAX = 1_000;
/** Attempts waiting for Lichess are posted once there are this many. */
export const PUZZLE_SYNC_AT = 5;
/** Lichess's batch call takes at most 50 solutions or puzzles. */
const LICHESS_BATCH_MAX = 50;

const notFound = (error: unknown) => isAppError(error) && error.code === "NOT_FOUND";

export async function dailyPuzzle(chaal: ChaalPublic, now: number = Date.now()): Promise<ChaalPuzzle> {
	requireFeature(chaal.settings, "puzzles");
	const path = "/api/puzzle/daily";
	return chaal.cache.read(
		{ endpoint: "puzzle-daily", path, epoch: chaal.settings.cacheEpoch },
		untilUtcMidnight(now),
		() => chaal.lichess.json({ endpoint: "puzzle-daily", path, lane: "public" }, puzzleAnswer),
	);
}

export async function puzzleById(chaal: Pick<ChaalPublic, "cache" | "lichess" | "settings">, id: string) {
	requireFeature(chaal.settings, "puzzles");
	const path = `/api/puzzle/${id}`;
	return chaal.cache.read({ endpoint: "puzzle", path, epoch: chaal.settings.cacheEpoch }, TTL.byId, () =>
		chaal.lichess.json({ endpoint: "puzzle", path, lane: "public" }, puzzleAnswer),
	);
}

/** Whether a connection may train on its own puzzles: there, not revoked, with puzzles' scopes. */
function puzzlesConnected(row: Awaited<ReturnType<typeof connectionOf>>): boolean {
	return Boolean(row && !row.revokedAt && missingScopes("puzzles", row.scopes).length === 0);
}

/**
 * The next puzzles for training or the streak. Lichess picks colours itself for more than
 * one puzzle, so a colour asks for twice as many and keeps that side's.
 */
export async function puzzleBatch(
	chaal: ChaalPublic,
	session: Session | null,
	input: PuzzleBatchInput,
): Promise<ChaalPuzzleBatch> {
	requireFeature(chaal.settings, "puzzles");
	const limits = readPuzzleLimits(chaal.settings.puzzles);
	if (input.streak && !limits.streak) throw new AppError("FORBIDDEN", "Chaal's puzzle streak is off");
	const nb = Math.min(LICHESS_BATCH_MAX, input.color ? limits.ahead * 2 : limits.ahead);
	const params = { nb, difficulty: input.difficulty };
	const path = `/api/puzzle/batch/${input.angle}`;
	const keep = (puzzles: ChaalPuzzle[]) =>
		(input.color ? puzzles.filter((puzzle) => puzzle.color === input.color) : puzzles).slice(0, limits.ahead);

	if (session && !input.streak && chaal.connectConfigured && !chaal.settings.maintenance) {
		const deps = await chaal.connectDeps();
		if (puzzlesConnected(await connectionOf(deps.db, session.user.id))) {
			try {
				const batch = await withToken(deps, session.user.id, "puzzles", async (token) => {
					const lane = userLane(session.user.id);
					// The waiting solutions go first, so Lichess doesn't offer them again.
					const posted = await postPending(deps, session.user.id, token, {
						angle: input.angle,
						nb: input.difficulty ? 0 : nb,
					});
					if (posted && posted.puzzles.length > 0) return posted;
					return chaal.lichess.json({ endpoint: "puzzle-batch", path, params, token, lane }, puzzleBatchAnswer);
				});
				return { puzzles: keep(batch.puzzles), source: "account", glicko: batch.glicko };
			} catch (error) {
				// A token Lichess refused (now marked revoked): anyone's puzzles, and the panel says reconnect.
				if (!(isAppError(error) && error.reason === "lichess-reconnect")) throw error;
			}
		}
	}
	const batch = await chaal.cache.read(
		{ endpoint: "puzzle-batch", path, params: { ...params, round: input.round }, epoch: chaal.settings.cacheEpoch },
		input.round === 0 ? TTL.firstBatch : TTL.nextBatch,
		() => chaal.lichess.json({ endpoint: "puzzle-batch", path, params, lane: "public" }, puzzleBatchAnswer),
	);
	return { puzzles: keep(batch.puzzles), source: "public", glicko: null };
}

/**
 * Posts the player's waiting attempts to Lichess, by the theme they were trained on, and
 * marks them sent with their rating change. With `ask`, the post for that theme also asks
 * for the next batch (Lichess answers both at once) and returns it.
 */
async function postPending(deps: ConnectDeps, userId: string, token: string, ask?: { angle: PuzzleAngle; nb: number }) {
	const pending = await deps.db
		.select()
		.from(chPuzzleAttempt)
		.where(and(eq(chPuzzleAttempt.ownerId, userId), eq(chPuzzleAttempt.lichess, "pending")))
		.orderBy(chPuzzleAttempt.at)
		.limit(LICHESS_BATCH_MAX);
	const byAngle = new Map<string, typeof pending>();
	for (const row of pending) byAngle.set(row.angle, [...(byAngle.get(row.angle) ?? []), row]);
	let answer: { puzzles: ChaalPuzzle[]; glicko: ChaalPuzzleBatch["glicko"] } | null = null;
	for (const [angle, rows] of byAngle) {
		const nb = ask && ask.angle === angle ? ask.nb : 0;
		const solved = await deps.lichess.json(
			{
				endpoint: "puzzle-solve",
				method: "POST",
				path: `/api/puzzle/batch/${angle}`,
				params: { nb },
				json: { solutions: rows.map((row) => ({ id: row.puzzleId, win: row.won, rated: true })) },
				token,
				lane: userLane(userId),
			},
			puzzleSolveAnswer,
		);
		await deps.db
			.update(chPuzzleAttempt)
			.set({ lichess: "sent" })
			.where(
				inArray(
					chPuzzleAttempt.id,
					rows.map((row) => row.id),
				),
			);
		for (const round of solved.rounds) {
			if (round.ratingDiff === null) continue;
			const ids = rows.filter((row) => row.puzzleId === round.id).map((row) => row.id);
			if (ids.length > 0)
				await deps.db
					.update(chPuzzleAttempt)
					.set({ ratingDiff: round.ratingDiff })
					.where(inArray(chPuzzleAttempt.id, ids));
		}
		if (nb > 0) answer = { puzzles: solved.puzzles, glicko: solved.glicko };
	}
	return answer;
}

/** Posts the waiting attempts, best effort: a failure leaves them waiting for the next time. */
async function syncPending(deps: ConnectDeps, userId: string): Promise<void> {
	try {
		await withToken(deps, userId, "puzzles", (token) => postPending(deps, userId, token));
	} catch (error) {
		log("info", "chaal puzzle results not posted", errorFields(error));
	}
}

const pendingCount = async (db: Db, userId: string) => {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(chPuzzleAttempt)
		.where(and(eq(chPuzzleAttempt.ownerId, userId), eq(chPuzzleAttempt.lichess, "pending")));
	return row?.count ?? 0;
};

/** Keeps the player's PUZZLE_ATTEMPTS_MAX most recent attempts. */
async function prune(db: Db | Tx, ownerId: string): Promise<void> {
	const kept = db
		.select({ id: chPuzzleAttempt.id })
		.from(chPuzzleAttempt)
		.where(eq(chPuzzleAttempt.ownerId, ownerId))
		.orderBy(desc(chPuzzleAttempt.at))
		.limit(PUZZLE_ATTEMPTS_MAX);
	await db
		.delete(chPuzzleAttempt)
		.where(and(eq(chPuzzleAttempt.ownerId, ownerId), notInArray(chPuzzleAttempt.id, kept)));
}

const valuesOf = (attempt: PuzzleAttempt) => ({
	puzzleId: attempt.puzzleId,
	won: attempt.won,
	ms: attempt.ms,
	rating: attempt.rating,
	themes: attempt.themes,
	mode: attempt.mode,
	angle: attempt.angle,
	streak: attempt.streak,
	at: new Date(attempt.at),
});

/**
 * A finished puzzle. A connected player's (not the streak's) waits to be posted to Lichess,
 * and the waiting ones go once there are PUZZLE_SYNC_AT. The same id twice is one attempt.
 */
export async function recordAttempt(deps: ConnectDeps, userId: string, input: PuzzleAttempt): Promise<void> {
	const settings = await deps.controls.settings();
	requireFeature(settings, "puzzles");
	const attempt = puzzleAttemptSchema.parse(input);
	const forLichess =
		attempt.mode !== "streak" &&
		!settings.maintenance &&
		deps.vault !== null &&
		puzzlesConnected(await connectionOf(deps.db, userId));
	const inserted = await deps.db
		.insert(chPuzzleAttempt)
		.values({ id: attempt.id, ownerId: userId, ...valuesOf(attempt), lichess: forLichess ? "pending" : null })
		.onConflictDoNothing()
		.returning({ id: chPuzzleAttempt.id });
	if (inserted.length === 0) return;
	await prune(deps.db, userId);
	await recordActivity(deps.db, { userId, kind: "puzzle", ref: attempt.puzzleId });
	if (forLichess && (await pendingCount(deps.db, userId)) >= PUZZLE_SYNC_AT) await syncPending(deps, userId);
}

/**
 * This browser's attempts, when a session starts (they were made without a connection, so
 * they never go to Lichess). Returns the ids the account now has, which the browser forgets.
 */
export async function importAttempts(
	deps: Pick<ConnectDeps, "db" | "controls">,
	userId: string,
	input: ReadonlyArray<PuzzleAttempt>,
): Promise<{ imported: string[] }> {
	requireFeature(await deps.controls.settings(), "puzzles");
	const attempts = input.map((attempt) => puzzleAttemptSchema.parse(attempt));
	if (attempts.length === 0) return { imported: [] };
	await deps.db
		.insert(chPuzzleAttempt)
		.values(attempts.map((attempt) => ({ id: attempt.id, ownerId: userId, ...valuesOf(attempt), lichess: null })))
		.onConflictDoNothing();
	const own = await deps.db
		.select({ id: chPuzzleAttempt.id })
		.from(chPuzzleAttempt)
		.where(
			and(
				eq(chPuzzleAttempt.ownerId, userId),
				inArray(
					chPuzzleAttempt.id,
					attempts.map((attempt) => attempt.id),
				),
			),
		);
	await prune(deps.db, userId);
	return { imported: own.map((row) => row.id) };
}

/** What a failed Lichess read means for the progress panel. */
function lichessState(error: unknown): "reconnect" | "wait" | "unavailable" {
	if (isAppError(error) && error.reason === "lichess-reconnect") return "reconnect";
	if (isAppError(error) && error.code === "RATE_LIMITED") return "wait";
	return "unavailable";
}

/**
 * The progress panel: the player's attempts over PROGRESS_DAYS (and the best streak ever),
 * and, connected with the puzzle scopes, Lichess's own dashboard after the waiting
 * attempts are posted. The dashboard is cached for the player; posting more changes its key.
 */
export async function progress(
	deps: ConnectDeps & { cache: ChaalCache },
	userId: string,
	now: number = Date.now(),
): Promise<ChaalPuzzleProgress> {
	const settings = await deps.controls.settings();
	requireFeature(settings, "puzzles");
	const rows = await deps.db
		.select()
		.from(chPuzzleAttempt)
		.where(eq(chPuzzleAttempt.ownerId, userId))
		.orderBy(desc(chPuzzleAttempt.at))
		.limit(PUZZLE_ATTEMPTS_MAX);
	const row = deps.vault ? await connectionOf(deps.db, userId) : null;
	let lichess: ChaalPuzzleProgress["lichess"] = { state: "connect" };
	if (row && !settings.maintenance && featureOn(settings.features, "puzzles")) {
		if (!puzzlesConnected(row)) lichess = { state: "reconnect" };
		else {
			if (rows.some((attempt) => attempt.lichess === "pending")) await syncPending(deps, userId);
			const sent = await deps.db
				.select({ count: sql<number>`count(*)::int` })
				.from(chPuzzleAttempt)
				.where(and(eq(chPuzzleAttempt.ownerId, userId), eq(chPuzzleAttempt.lichess, "sent")));
			try {
				const path = `/api/puzzle/dashboard/${PROGRESS_DAYS}`;
				const dashboard = await deps.cache.read(
					{
						endpoint: "puzzle-dashboard",
						path,
						params: { sent: sent[0]?.count ?? 0 },
						epoch: settings.cacheEpoch,
						owner: userId,
					},
					TTL.dashboard,
					() =>
						withToken(deps, userId, "puzzles", (token) =>
							deps.lichess.json(
								{ endpoint: "puzzle-dashboard", path, token, lane: userLane(userId) },
								puzzleDashboardAnswer,
							),
						),
				);
				lichess = { state: "ok", dashboard };
			} catch (error) {
				lichess = { state: lichessState(error) };
			}
		}
	}
	// Read again: posting may have changed what's waiting and the rating changes.
	const attempts = rows.some((attempt) => attempt.lichess === "pending")
		? await deps.db
				.select()
				.from(chPuzzleAttempt)
				.where(eq(chPuzzleAttempt.ownerId, userId))
				.orderBy(desc(chPuzzleAttempt.at))
				.limit(PUZZLE_ATTEMPTS_MAX)
		: rows;
	return {
		stats: progressOf(
			attempts.map((attempt) => ({ ...attempt, at: attempt.at.toISOString() })),
			now,
		),
		pending: attempts.filter((attempt) => attempt.lichess === "pending").length,
		lichess,
	};
}

/** Lichess's misses to replay for a theme, over PROGRESS_DAYS (none: an empty list). */
export async function replay(deps: ConnectDeps, userId: string, theme: PuzzleAngle): Promise<ChaalPuzzleReplay> {
	const path = `/api/puzzle/replay/${PROGRESS_DAYS}/${theme}`;
	try {
		return await withToken(deps, userId, "puzzles", (token) =>
			deps.lichess.json({ endpoint: "puzzle-replay", path, token, lane: userLane(userId) }, puzzleReplayAnswer),
		);
	} catch (error) {
		if (notFound(error)) return { theme, remaining: [] };
		throw error;
	}
}

/** The guest claim: a guest's attempts join the account's (it keeps its PUZZLE_ATTEMPTS_MAX most recent). */
export async function movePuzzleAttempts(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(chPuzzleAttempt).set({ ownerId: toUserId }).where(eq(chPuzzleAttempt.ownerId, fromUserId));
	await prune(tx, toUserId);
}
