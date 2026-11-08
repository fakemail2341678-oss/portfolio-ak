import { z } from "zod";
import type { GameTree } from "../chess/tree";

/**
 * "My analyses" (Task 75, decision 0264): what saving sends and what reading returns. The
 * tree's shape is checked here, its moves on the server (`verifyTree`). Caps keep a row
 * small: PGN's 2,000 moves, 2,000 characters a comment, a megabyte in all.
 */
export const ANALYSIS_TITLE_MAX = 120;
export const ANALYSIS_COMMENT_MAX = 2_000;
/** The tree as JSON, at most. */
export const ANALYSIS_MAX_BYTES = 1_000_000;
/** Saved analyses a player may keep. */
export const ANALYSES_PER_USER = 200;

const square = z.string().regex(/^[a-h][1-8]$/);

const scoreSchema = z.union([z.strictObject({ cp: z.number().int() }), z.strictObject({ mate: z.number().int() })]);

const nodeSchema = z.strictObject({
	id: z.string().regex(/^\d{1,6}$/),
	parent: z
		.string()
		.regex(/^\d{1,6}$/)
		.nullable(),
	ply: z.number().int().min(0).max(10_000),
	uci: z
		.string()
		.regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
		.nullable(),
	san: z.string().max(10).nullable(),
	fen: z.string().max(100),
	children: z.array(z.string().regex(/^\d{1,6}$/)).max(40),
	comments: z.array(z.string().max(ANALYSIS_COMMENT_MAX)).max(4),
	nags: z.array(z.number().int().min(1).max(255)).max(8),
	eval: scoreSchema.optional(),
	clock: z.number().int().min(0).optional(),
	shapes: z
		.array(
			z.strictObject({
				from: square,
				to: square.optional(),
				brush: z.enum(["mark", "ink"]).optional(),
			}),
		)
		.max(32)
		.optional(),
});

export const gameTreeSchema = z.strictObject({
	root: z.string().regex(/^\d{1,6}$/),
	nodes: z.record(z.string(), nodeSchema),
	next: z.number().int().min(1).max(1_000_000),
});

export const analysisInputSchema = z.strictObject({
	/** Absent for a new analysis. */
	id: z.uuid().optional(),
	title: z.string().trim().min(1).max(ANALYSIS_TITLE_MAX),
	tree: gameTreeSchema,
	tags: z.record(z.string().regex(/^[A-Za-z0-9_]{1,40}$/), z.string().max(200)).default({}),
	orientation: z.enum(["white", "black"]),
});
export type AnalysisInput = z.input<typeof analysisInputSchema>;

/** A row of "My analyses". */
export type ChaalAnalysisSummary = {
	id: string;
	title: string;
	moves: number;
	white: string | null;
	black: string | null;
	updatedAt: string;
};

/** A saved analysis, opened. */
export type ChaalAnalysis = {
	id: string;
	title: string;
	tree: GameTree;
	tags: Record<string, string>;
	orientation: "white" | "black";
	updatedAt: string;
};
