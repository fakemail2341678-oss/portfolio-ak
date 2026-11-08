import "@tanstack/react-start/server-only";
import { and, count, desc, eq } from "drizzle-orm";
import {
	ANALYSES_PER_USER,
	ANALYSIS_MAX_BYTES,
	type AnalysisInput,
	analysisInputSchema,
	type ChaalAnalysis,
	type ChaalAnalysisSummary,
} from "@/features/chaal/analysis/schema";
import { PGN_MAX_MOVES } from "@/features/chaal/chess/pgn";
import { type GameTree, sizeOf, verifyTree } from "@/features/chaal/chess/tree";
import { AppError } from "@/lib/errors";
import { chAnalysis } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/**
 * "My analyses" (PLAN 13.5, `ch_analysis`; decision 0264): each call acts on the caller's
 * own rows only, and another player's analysis is NOT_FOUND, never FORBIDDEN (its id
 * says nothing). A tree is checked move by move before it's written (`verifyTree`), so a
 * saved analysis always opens.
 */

const summaryOf = (row: Pick<typeof chAnalysis.$inferSelect, "id" | "title" | "moves" | "tags" | "updatedAt">) => ({
	id: row.id,
	title: row.title,
	moves: row.moves,
	white: row.tags.White ?? null,
	black: row.tags.Black ?? null,
	updatedAt: row.updatedAt.toISOString(),
});

export async function listAnalyses(db: Db, ownerId: string): Promise<ChaalAnalysisSummary[]> {
	const rows = await db
		.select({
			id: chAnalysis.id,
			title: chAnalysis.title,
			moves: chAnalysis.moves,
			tags: chAnalysis.tags,
			updatedAt: chAnalysis.updatedAt,
		})
		.from(chAnalysis)
		.where(eq(chAnalysis.ownerId, ownerId))
		.orderBy(desc(chAnalysis.updatedAt))
		.limit(ANALYSES_PER_USER);
	return rows.map(summaryOf);
}

export async function getAnalysis(db: Db, ownerId: string, id: string): Promise<ChaalAnalysis> {
	const [row] = await db
		.select()
		.from(chAnalysis)
		.where(and(eq(chAnalysis.id, id), eq(chAnalysis.ownerId, ownerId)));
	if (!row) throw new AppError("NOT_FOUND", "No such analysis");
	return {
		id: row.id,
		title: row.title,
		tree: row.tree,
		tags: row.tags,
		orientation: row.orientation,
		updatedAt: row.updatedAt.toISOString(),
	};
}

/** The tree as it will be stored, or BAD_REQUEST naming what's wrong with it. */
function checkedTree(tree: GameTree): GameTree {
	if (JSON.stringify(tree).length > ANALYSIS_MAX_BYTES) throw new AppError("BAD_REQUEST", "Analysis too large");
	const check = verifyTree(tree, PGN_MAX_MOVES);
	if (!check.ok) throw new AppError("BAD_REQUEST", `Not a game tree (${check.reason})`);
	return check.tree;
}

/**
 * Saves a new analysis, or the caller's own by id. A new one beyond ANALYSES_PER_USER is a
 * CONFLICT ("delete one first").
 */
export async function saveAnalysis(db: Db, ownerId: string, input: AnalysisInput): Promise<ChaalAnalysisSummary> {
	const { id, title, tree, tags, orientation } = analysisInputSchema.parse(input);
	// The schema checked each square's spelling; verifyTree checks the rest.
	const checked = checkedTree(tree as GameTree);
	const values = {
		title,
		tree: checked,
		tags,
		orientation,
		startFen: checked.nodes[checked.root]?.fen ?? "",
		moves: sizeOf(checked),
	};
	if (id) {
		const [row] = await db
			.update(chAnalysis)
			.set(values)
			.where(and(eq(chAnalysis.id, id), eq(chAnalysis.ownerId, ownerId)))
			.returning();
		if (!row) throw new AppError("NOT_FOUND", "No such analysis");
		return summaryOf(row);
	}
	return db.transaction(async (tx) => {
		const [{ total } = { total: 0 }] = await tx
			.select({ total: count() })
			.from(chAnalysis)
			.where(eq(chAnalysis.ownerId, ownerId));
		if (total >= ANALYSES_PER_USER) throw new AppError("CONFLICT", "Too many analyses");
		const [row] = await tx
			.insert(chAnalysis)
			.values({ ownerId, ...values })
			.returning();
		if (!row) throw new AppError("INTERNAL", "Analysis not saved");
		return summaryOf(row);
	});
}

export async function deleteAnalysis(db: Db, ownerId: string, id: string): Promise<void> {
	const deleted = await db
		.delete(chAnalysis)
		.where(and(eq(chAnalysis.id, id), eq(chAnalysis.ownerId, ownerId)))
		.returning({ id: chAnalysis.id });
	if (deleted.length === 0) throw new AppError("NOT_FOUND", "No such analysis");
}

/** The claim (src/server/chaal/guest-data.ts): a guest's analyses become the account's. */
export async function moveAnalyses(tx: Tx, fromUserId: string, toUserId: string): Promise<void> {
	await tx.update(chAnalysis).set({ ownerId: toUserId }).where(eq(chAnalysis.ownerId, fromUserId));
}
