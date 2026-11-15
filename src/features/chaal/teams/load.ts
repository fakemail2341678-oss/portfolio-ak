import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { chaalConnectionQueryOptions } from "../queries";
import type { TeamsSearch } from "../search";
import { myTeamsQueryOptions, teamQueryOptions, teamSearchQueryOptions, teamsQueryOptions } from "./queries";

/** Whether the viewer's connection may read their teams: connected, with the teams' scopes. */
export function canUseTeams(queryClient: QueryClient): boolean {
	const connection = queryClient.getQueryData(chaalConnectionQueryOptions().queryKey);
	return Boolean(connection && !connection.revoked && !connection.needsScopesFor.includes("teams"));
}

/** /teams: the list the URL asks for (a failure is the page's to say). */
export async function loadTeamsPage(queryClient: QueryClient, search: TeamsSearch) {
	const page = search.page ?? 1;
	const read = search.q
		? ensureQuery(queryClient, teamSearchQueryOptions(search.q, page))
		: search.view === "mine"
			? canUseTeams(queryClient)
				? ensureQuery(queryClient, myTeamsQueryOptions())
				: Promise.resolve(undefined)
			: ensureQuery(queryClient, teamsQueryOptions(page));
	await read.catch(() => undefined);
}

/** /teams/$id: the team (one Lichess doesn't know is Chaal's 404); its name for the title. */
export async function loadTeamPage(queryClient: QueryClient, id: string): Promise<{ name: string } | undefined> {
	const page = await ensureQuery(queryClient, teamQueryOptions(id)).catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		return null;
	});
	return page ? { name: page.team.name } : undefined;
}
