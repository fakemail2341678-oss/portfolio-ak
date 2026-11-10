import { createServerFn } from "@tanstack/react-start";
import { type SavedToStudy, type StudySummary, saveToStudyInput } from "@/features/chaal/studies/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as studies from "@/server/chaal/studies/service";

/**
 * The player's studies on Lichess (Task 83, decision 0273): their own (private ones too) and
 * "Save to study" from the analysis board, with their own token (`study:read`,
 * `study:write`, the `studies` switch, and the admin's `community.saveToStudy` for saving).
 * Anyone with a session, guests included (tests/server/chaal-access.test.ts).
 */

export const getChaalMyStudies = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<StudySummary[]> => studies.myStudies(context, context.user.id));

export const saveChaalToStudy = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(saveToStudyInput))
	.handler(({ context, data }): Promise<SavedToStudy> => studies.saveToStudy(context, context.user.id, data));
