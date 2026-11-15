import { queryOptions } from "@tanstack/react-query";
import { joinChaalTournament, leaveChaalTournament } from "@/functions/chaal/tournament-entry";
import { getChaalArena, getChaalSwiss, getChaalTournaments } from "@/functions/chaal/tournaments";
import { chaalKeys } from "../keys";
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
export const chaalEventsMutations = {
	join: (input: TournamentJoinInput) => joinChaalTournament({ data: input }),
	withdraw: (kind: TournamentKind, id: string) => leaveChaalTournament({ data: { kind, id } }),
};
