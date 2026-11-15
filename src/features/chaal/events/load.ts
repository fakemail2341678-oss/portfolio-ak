import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import type { TournamentPageSearch } from "../search";
import { arenaQueryOptions, swissQueryOptions, tournamentsQueryOptions } from "./queries";

/** /tournaments: the arenas' list (a failure is the page's to say). */
export async function loadTournamentsPage(queryClient: QueryClient) {
	await ensureQuery(queryClient, tournamentsQueryOptions()).catch(() => undefined);
}

/** /tournaments/$id: the tournament (one Lichess doesn't know is Chaal's 404); its name for the title. */
export async function loadTournamentPage(
	queryClient: QueryClient,
	id: string,
	search: TournamentPageSearch,
): Promise<{ name: string } | undefined> {
	const read =
		search.kind === "swiss"
			? ensureQuery(queryClient, swissQueryOptions(id)).then((page) => page.swiss.name)
			: ensureQuery(queryClient, arenaQueryOptions(id, search.page ?? 1)).then((page) => page.arena.name);
	const name = await read.catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		// Off, or Lichess away: the page says which.
		return null;
	});
	return name ? { name } : undefined;
}
