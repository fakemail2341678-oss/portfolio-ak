import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import type { StudiesSearch, StudyPageSearch } from "../search";
import { myStudiesQueryOptions, studiesByQueryOptions, studyChapterQueryOptions, studyQueryOptions } from "./queries";

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
