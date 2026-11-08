import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analysisInputSchema, type ChaalAnalysis, type ChaalAnalysisSummary } from "@/features/chaal/analysis/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as analyses from "@/server/chaal/analysis/service";

/**
 * "My analyses" (Task 75, decision 0264): list, open, save and delete the caller's saved
 * analysis boards. Anyone with a session, guests included (the page starts a Chaal guest
 * to save); each acts on the caller's own rows only (tests/server/chaal-access.test.ts).
 */

const idInput = z.strictObject({ id: z.uuid() });

export const listChaalAnalyses = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalAnalysisSummary[]> => analyses.listAnalyses(context.db, context.user.id));

export const getChaalAnalysis = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(idInput))
	.handler(({ context, data }): Promise<ChaalAnalysis> => analyses.getAnalysis(context.db, context.user.id, data.id));

export const saveChaalAnalysis = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(analysisInputSchema))
	.handler(
		({ context, data }): Promise<ChaalAnalysisSummary> => analyses.saveAnalysis(context.db, context.user.id, data),
	);

export const deleteChaalAnalysis = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(idInput))
	.handler(({ context, data }): Promise<void> => analyses.deleteAnalysis(context.db, context.user.id, data.id));
