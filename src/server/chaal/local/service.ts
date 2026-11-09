import "@tanstack/react-start/server-only";
import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import { PGN_MAX_MOVES } from "@/features/chaal/chess/pgn";
import { fromRecord } from "@/features/chaal/local/game";
import { type LocalGameSummary, localGameRecordSchema, summaryOfRecord } from "@/features/chaal/local/schema";
import { LOCAL_GAMES_MAX, type LocalGameRecord } from "@/features/chaal/local/types";
import { AppError } from "@/lib/errors";
import { chLocalGame } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { recordActivity } from "../activity";
import { requireFeature } from "../connect/service";
import type { ChaalControls } from "../controls";

/**
 * Local games (PLAN Task 76, `ch_local_game`; decision 0265): saved as they're played,
 * listed on the play hub, imported from the browser when a session starts. Each call acts
 * on the caller's own rows; another player's id is NOT_FOUND, and a game id taken by
 * someone else is never overwritten. Every write's PGN is read move by move first
 * (`fromRecord`), so a stored game always opens. A player keeps LOCAL_GAMES_MAX games:
 * the least recently played go.
 */

export type LocalDeps = { db: Db; controls: ChaalControls };

type Row = typeof chLocalGame.$inferSelect;

const recordOf = (row: Row): LocalGameRecord => ({
	id: row.id,
	mode: row.mode,
	level: row.level,
	color: row.color,
	clock: row.clock,
	layout: row.layout,
	pgn: row.pgn,
	clocks: row.clocks,
	result: row.result,
	reason: row.reason,
	status: row.status,
	createdAt: row.startedAt.toISOString(),
	updatedAt: row.playedAt.toISOString(),
});

const summaryOf = (row: Row): LocalGameSummary => summaryOfRecord(recordOf(row), row.moves);

/** The row's values from a checked record, or BAD_REQUEST naming what's wrong. */
function valuesOf(input: LocalGameRecord) {
	const record = localGameRecordSchema.parse(input) as LocalGameRecord;
	const read = fromRecord(record, PGN_MAX_MOVES);
	if (!read.ok) throw new AppError("BAD_REQUEST", `Not a local game (${read.reason})`);
	return {
		mode: record.mode,
		level: record.level,
		color: record.color,
		clock: record.clock,
		layout: record.layout,
		pgn: record.pgn,
		moves: read.game.moves.length,
		clocks: record.clocks,
		result: record.result,
		reason: record.reason,
		status: record.status,
		startedAt: new Date(record.createdAt),
		playedAt: new Date(record.updatedAt),
	};
}

export async function listLocalGames(db: Db, ownerId: string): Promise<LocalGameSummary[]> {
	const rows = await db
		.select()
		.from(chLocalGame)
		.where(eq(chLocalGame.ownerId, ownerId))
		.orderBy(desc(chLocalGame.playedAt))
		.limit(LOCAL_GAMES_MAX);
	return rows.map(summaryOf);
}

export async function getLocalGame(db: Db, ownerId: string, id: string): Promise<LocalGameRecord> {
	const [row] = await db
		.select()
		.from(chLocalGame)
		.where(and(eq(chLocalGame.id, id), eq(chLocalGame.ownerId, ownerId)));
	if (!row) throw new AppError("NOT_FOUND", "No such game");
	return recordOf(row);
}

/**
 * Writes one game: a new one, or the caller's own as it goes on. A finished game stays as
 * it ended (a late write of it is ignored, and its row returned). Refused while the admin
 * has local games off.
 */
export async function saveLocalGame(
	deps: LocalDeps,
	ownerId: string,
	input: LocalGameRecord,
): Promise<LocalGameSummary> {
	requireFeature(await deps.controls.settings(), "local");
	const values = valuesOf(input);
	return deps.db.transaction(async (tx) => {
		const row = await upsert(tx, ownerId, input.id, values);
		if (!row) {
			const [own] = await tx
				.select()
				.from(chLocalGame)
				.where(and(eq(chLocalGame.id, input.id), eq(chLocalGame.ownerId, ownerId)));
			if (!own) throw new AppError("NOT_FOUND", "No such game");
			return summaryOf(own);
		}
		await prune(tx, ownerId);
		// A game is counted when it starts: its first write has no moves (decision 0266).
		if (row.moves === 0) {
			await recordActivity(tx, {
				userId: ownerId,
				kind: "game",
				mode: row.mode === "engine" ? "local-engine" : "local-board",
				ref: row.id,
			});
		}
		return summaryOf(row);
	});
}

/**
 * Inserts the game, or updates it when it's the owner's and still being played. Nothing
 * comes back when the id is someone else's or the game had ended.
 */
async function upsert(tx: Tx, ownerId: string, id: string, values: ReturnType<typeof valuesOf>): Promise<Row | null> {
	const [row] = await tx
		.insert(chLocalGame)
		.values({ id, ownerId, ...values })
		.onConflictDoUpdate({
			target: chLocalGame.id,
			set: values,
			setWhere: and(eq(chLocalGame.ownerId, ownerId), ne(chLocalGame.status, "ended")),
		})
		.returning();
	return row ?? null;
}

export async function deleteLocalGame(db: Db, ownerId: string, id: string): Promise<void> {
	const deleted = await db
		.delete(chLocalGame)
		.where(and(eq(chLocalGame.id, id), eq(chLocalGame.ownerId, ownerId)))
		.returning({ id: chLocalGame.id });
	if (deleted.length === 0) throw new AppError("NOT_FOUND", "No such game");
}

/**
 * This browser's games, when a session starts (decision 0265): each that reads is stored
 * (one that doesn't, or whose id is someone else's, is skipped, never failing the rest).
 * Returns the ids now on the account, which the browser may forget.
 */
export async function importLocalGames(
	deps: LocalDeps,
	ownerId: string,
	games: ReadonlyArray<LocalGameRecord>,
): Promise<{ imported: string[] }> {
	requireFeature(await deps.controls.settings(), "local");
	const checked = games.flatMap((game) => {
		try {
			return [{ id: game.id, values: valuesOf(game) }];
		} catch {
			return [];
		}
	});
	return deps.db.transaction(async (tx) => {
		const imported: string[] = [];
		for (const { id, values } of checked) {
			if (await upsert(tx, ownerId, id, values)) imported.push(id);
			else {
				// Already on the account and finished: the browser's copy can go too.
				const [own] = await tx
					.select({ id: chLocalGame.id })
					.from(chLocalGame)
					.where(and(eq(chLocalGame.id, id), eq(chLocalGame.ownerId, ownerId)));
				if (own) imported.push(id);
			}
		}
		await prune(tx, ownerId);
		return { imported };
	});
}

/** Keeps a player's LOCAL_GAMES_MAX most recently played games. */
async function prune(tx: Tx, ownerId: string): Promise<void> {
	const kept = tx
		.select({ id: chLocalGame.id })
		.from(chLocalGame)
		.where(eq(chLocalGame.ownerId, ownerId))
		.orderBy(desc(chLocalGame.playedAt), desc(chLocalGame.id))
		.limit(LOCAL_GAMES_MAX);
	await tx.delete(chLocalGame).where(and(eq(chLocalGame.ownerId, ownerId), notInArray(chLocalGame.id, kept)));
}

/** The claim (src/server/chaal/guest-data.ts): a guest's games join the account's. */
export async function moveLocalGames(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	const moved = await tx
		.update(chLocalGame)
		.set({ ownerId: toUserId })
		.where(eq(chLocalGame.ownerId, fromUserId))
		.returning({ id: chLocalGame.id });
	if (moved.length > 0) await prune(tx, toUserId);
}
