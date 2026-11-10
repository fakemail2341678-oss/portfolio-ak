import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { joinChaalTournament, withdrawChaalTournament } from "@/functions/chaal/tournament-entry";
import { getChaalArena, getChaalSwiss, getChaalTournaments } from "@/functions/chaal/tournaments";
import { isAppError } from "@/lib/errors";
import { ensureQuery } from "@/lib/query";
import { chaalKeys } from "../keys";
import type { TournamentPageSearch } from "../search";
import type { TournamentJoinInput, TournamentKind } from "./schema";

/**
 * Tournaments' reads (Task 83, decision 0273). A page's loader awaits what its first paint
 * shows: the arenas' list, or one tournament (an arena with the standings' page asked for,
 * or a Swiss one with its standings). A tournament being played is read again every 10 s
 * while the page is open.
 */

export const tournamentsQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.tournaments(), queryFn: () => getChaalTournaments(), staleTime: 60_000 });

const PLAYED_MS = 10_000;

export const arenaQueryOptions = (id: string, page: number) =>
	queryOptions({
		queryKey: chaalKeys.arena(id, page),
		queryFn: () => getChaalArena({ data: { id, page } }),
		retry: false,
		refetchInterval: (query) => (query.state.data?.arena.status === "started" ? PLAYED_MS : false),
	});

export const swissQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.swiss(id),
		queryFn: () => getChaalSwiss({ data: { id } }),
		retry: false,
		refetchInterval: (query) => (query.state.data?.swiss.status === "started" ? PLAYED_MS : false),
	});

/** Joining and withdrawing; a test or a story passes its own. */
export const tournamentCalls = {
	join: (input: TournamentJoinInput) => joinChaalTournament({ data: input }),
	withdraw: (kind: TournamentKind, id: string) => withdrawChaalTournament({ data: { kind, id } }),
};

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
