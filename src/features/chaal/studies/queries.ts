import { queryOptions } from "@tanstack/react-query";
import { copyChaalToStudy, getChaalMyStudies } from "@/functions/chaal/my-studies";
import { getChaalStudiesBy, getChaalStudy, getChaalStudyChapter } from "@/functions/chaal/studies";
import { chaalKeys } from "../keys";
import type { SaveToStudyInput } from "./schema";

/**
 * Studies' reads (Task 83, decision 0273): an account's public studies, the player's own
 * (with their token), a study's chapters and the chapter shown. A page's loader awaits what
 * its first paint shows.
 */

export const studiesByQueryOptions = (username: string) =>
	queryOptions({
		queryKey: chaalKeys.studiesBy(username),
		queryFn: () => getChaalStudiesBy({ data: { username } }),
		staleTime: 60_000,
		retry: false,
	});

export const myStudiesQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.myStudies(), queryFn: () => getChaalMyStudies(), retry: false });

export const studyQueryOptions = (id: string) =>
	queryOptions({ queryKey: chaalKeys.study(id), queryFn: () => getChaalStudy({ data: { id } }), retry: false });

export const studyChapterQueryOptions = (id: string, chapter: string) =>
	queryOptions({
		queryKey: chaalKeys.studyChapter(id, chapter),
		queryFn: () => getChaalStudyChapter({ data: { id, chapter } }),
		retry: false,
	});

/** Saving the analysis board to a study; a test or a story passes its own. */
export const chaalStudiesMutations = {
	save: (input: SaveToStudyInput) => copyChaalToStudy({ data: input }),
};
