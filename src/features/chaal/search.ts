import { z } from "zod";
import { CONNECT_RESULTS } from "./links";

/**
 * Chaal's URL contracts (route files import this, never a form schema, 0194). Search
 * schemas aren't strict: links carry utm tags.
 */

/** A page connecting returns to (settings, the admin's lab): `?lichess=` says how it ended. */
export const connectResultSearch = z.object({ lichess: z.enum(CONNECT_RESULTS).optional().catch(undefined) });

/**
 * The analysis board's URL (Task 75, src/features/chaal/analysis/url.ts): the start
 * position, a line of UCI moves joined by "_", how far along it the board is, the side at
 * the bottom, or a saved analysis's id. Anything that doesn't read is dropped, so a mangled
 * link opens the board at the start.
 */
export const analysisSearch = z.object({
	fen: z.string().max(100).optional().catch(undefined),
	moves: z
		.string()
		.max(12_000)
		.regex(/^[a-h1-8qrbn_]*$/)
		.optional()
		.catch(undefined),
	ply: z.coerce.number().int().min(0).max(2_000).optional().catch(undefined),
	orientation: z.enum(["white", "black"]).optional().catch(undefined),
	id: z.uuid().optional().catch(undefined),
});
