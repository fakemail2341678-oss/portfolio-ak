import { createServerFn } from "@tanstack/react-start";
import {
	type ChaalStudy,
	type ChaalStudyChapter,
	type ChaalStudyList,
	studiesByInput,
	studyChapterInput,
	studyInput,
} from "@/features/chaal/studies/schema";
import { zodInput } from "@/functions/_lib/validator";
import { withChaalPublic } from "@/middleware/chaal";
import * as studies from "@/server/chaal/studies/service";

/**
 * Studies for everyone (Task 83, decision 0273): an account's public studies, a study's
 * chapters and one chapter's PGN (a connected viewer's own private studies open too, read
 * with their token). Public: each starts with `withChaalPublic` and checks the `studies` switch.
 */

export const getChaalStudiesBy = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(studiesByInput))
	.handler(({ context, data }): Promise<ChaalStudyList> => studies.studiesBy(context.chaal, data.username));

export const getChaalStudy = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(studyInput))
	.handler(({ context, data }): Promise<ChaalStudy> => studies.study(context.chaal, context.session, data.id));

export const getChaalStudyChapter = createServerFn({ method: "GET" })
	.middleware([withChaalPublic])
	.validator(zodInput(studyChapterInput))
	.handler(
		({ context, data }): Promise<ChaalStudyChapter> =>
			studies.studyChapter(context.chaal, context.session, data.id, data.chapter),
	);
