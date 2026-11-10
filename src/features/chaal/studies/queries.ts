import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { getChaalMyStudies, saveChaalToStudy } from "@/functions/chaal/my-studies";
import { getChaalStudiesBy, getChaalStudy, getChaalStudyChapter } from "@/functions/chaal/studies";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { chaalKeys } from "../keys";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import type { StudiesSearch, StudyPageSearch } from "../search";
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
export const studyCalls = {
	save: (input: SaveToStudyInput) => saveChaalToStudy({ data: input }),
};

/** Whether the viewer's connection may read their studies: connected, with the studies' scopes. */
export function canUseStudies(queryClient: QueryClient): boolean {
	const connection = queryClient.getQueryData(chaalConnectionQueryOptions().queryKey);
	return Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("studies"));
}

/** The account a list shows: the URL's, else the admin's. */
export function studiesAccount(queryClient: QueryClient, search: StudiesSearch): string {
	return search.by ?? queryClient.getQueryData(chaalStatusQueryOptions().queryKey)?.community.studiesBy ?? "lichess";
}

/** /studies: the list the URL asks for (a failure is the page's to say). */
export async function loadStudiesPage(queryClient: QueryClient, search: StudiesSearch) {
	const read =
		search.view === "mine"
			? canUseStudies(queryClient)
				? ensureQuery(queryClient, myStudiesQueryOptions())
				: Promise.resolve(undefined)
			: ensureQuery(queryClient, studiesByQueryOptions(studiesAccount(queryClient, search)));
	await read.catch(() => undefined);
}

/** /studies/$id: the study (one Lichess doesn't have, or won't show, is Chaal's 404) and the chapter shown. */
export async function loadStudyPage(
	queryClient: QueryClient,
	id: string,
	search: StudyPageSearch,
): Promise<{ name: string } | undefined> {
	const study = await ensureQuery(queryClient, studyQueryOptions(id)).catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		return null;
	});
	if (!study) return;
	const chapter = chapterShown(study, search);
	if (chapter) await ensureQuery(queryClient, studyChapterQueryOptions(id, chapter)).catch(() => undefined);
	return { name: study.name };
}

/** The chapter a study's page shows: the URL's if the study has it, else the first. */
export function chapterShown(
	study: { chapters: ReadonlyArray<{ id: string }> },
	search: StudyPageSearch,
): string | null {
	if (search.chapter && study.chapters.some((chapter) => chapter.id === search.chapter)) return search.chapter;
	return study.chapters[0]?.id ?? null;
}
