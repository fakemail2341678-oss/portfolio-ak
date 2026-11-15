import { queryOptions } from "@tanstack/react-query";
import {
	getChaalBroadcastGame,
	getChaalBroadcastRound,
	getChaalBroadcasts,
	getChaalBroadcastTour,
	getChaalOfficialBroadcasts,
	getChaalStreamers,
	getChaalTv,
	searchChaalBroadcasts,
} from "@/functions/chaal/watch";
import { chaalKeys } from "../keys";

/**
 * Watch's reads (Task 82, decision 0272). A page's loader awaits what its first paint shows
 * (the TV's games; a broadcasts list; a broadcast, its round and a followed board's PGN) and
 * starts the rest (the streamers, what's broadcast now beside the TV). What's live after the
 * first paint the browser reads from Lichess (./use-live.ts).
 */

export const tvQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.tv(), queryFn: () => getChaalTv(), staleTime: 5_000 });

export const streamersQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.streamers(), queryFn: () => getChaalStreamers(), staleTime: 60_000 });

export const broadcastsQueryOptions = (page: number) =>
	queryOptions({
		queryKey: chaalKeys.broadcasts(page),
		queryFn: () => getChaalBroadcasts({ data: { page } }),
		staleTime: 60_000,
	});

export const officialBroadcastsQueryOptions = () =>
	queryOptions({
		queryKey: chaalKeys.officialBroadcasts(),
		queryFn: () => getChaalOfficialBroadcasts(),
		staleTime: 60_000,
	});

export const broadcastSearchQueryOptions = (q: string, page: number) =>
	queryOptions({
		queryKey: chaalKeys.broadcastSearch(q, page),
		queryFn: () => searchChaalBroadcasts({ data: { q, page } }),
		staleTime: 60_000,
	});

export const broadcastTourQueryOptions = (id: string) =>
	queryOptions({
		queryKey: chaalKeys.broadcastTour(id),
		queryFn: () => getChaalBroadcastTour({ data: { id } }),
		retry: false,
	});

export const broadcastRoundQueryOptions = (id: string) =>
	queryOptions({ queryKey: chaalKeys.broadcastRound(id), queryFn: () => getChaalBroadcastRound({ data: { id } }) });

export const broadcastGameQueryOptions = (round: string, board: string) =>
	queryOptions({
		queryKey: chaalKeys.broadcastGame(round, board),
		queryFn: () => getChaalBroadcastGame({ data: { round, board } }),
		retry: false,
	});
