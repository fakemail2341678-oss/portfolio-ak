import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type ChaalCloudEval,
	type ChaalExplorerResult,
	type ChaalImportedGame,
	type ChaalTablebase,
	EXPLORER_DATABASES,
	EXPLORER_RATINGS,
	EXPLORER_SPEEDS,
} from "@/features/chaal/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as analysis from "@/server/chaal/analysis/lichess";

/**
 * Lichess's data for the analysis board (Task 75, decision 0264): cloud eval, the opening
 * explorer, the tablebase and importing a finished game. Public: each starts with
 * `withChaalPublic` and reads through the client and the cache. Each checks its feature's
 * switch (`engine` for cloud eval, `explorer` for the explorer and tablebase, `analysis`
 * for importing).
 */

/** A FEN as the board holds one: six fields, at most 100 characters (checked again on the server). */
const fen = z.string().trim().min(10).max(100);

export const getChaalCloudEval = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(z.strictObject({ fen, multiPv: z.number().int().min(1).max(5) })))
	.handler(
		({ context, data }): Promise<ChaalCloudEval | null> => analysis.cloudEval(context.chaal, data.fen, data.multiPv),
	);

export const getChaalExplorer = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(
		zodInput(
			z.strictObject({
				database: z.enum(EXPLORER_DATABASES),
				fen,
				speeds: z.array(z.enum(EXPLORER_SPEEDS)).max(EXPLORER_SPEEDS.length).optional(),
				ratings: z
					.array(z.union(EXPLORER_RATINGS.map((rating) => z.literal(rating))))
					.max(EXPLORER_RATINGS.length)
					.optional(),
				// Lichess usernames: letters, digits, "_" and "-", 2 to 30 characters.
				player: z
					.string()
					.trim()
					.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/)
					.optional(),
				color: z.enum(["white", "black"]).optional(),
			}),
		),
	)
	.handler(
		({ context, data }): Promise<ChaalExplorerResult> => analysis.explorer(context.chaal, context.session, data),
	);

export const getChaalTablebase = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(z.strictObject({ fen })))
	.handler(({ context, data }): Promise<ChaalTablebase | null> => analysis.tablebase(context.chaal, data.fen));

export const importChaalGame = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(z.strictObject({ id: z.string().regex(/^[A-Za-z0-9]{8}$/) })))
	.handler(({ context, data }): Promise<ChaalImportedGame> => analysis.importGame(context.chaal, data.id));
