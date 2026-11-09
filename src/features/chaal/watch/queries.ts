import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
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
import { isAppError } from "@/lib/errors";
import { ensureQuery, prefetch } from "@/lib/query";
import { chaalKeys } from "../keys";
import type { BroadcastPageSearch, BroadcastsSearch } from "../search";
import { isTvChannel } from "./limits";

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

/** /watch: the TV's games now; the streamers and what's broadcast stream in beside them. */
export async function loadWatchPage(queryClient: QueryClient) {
	prefetch(queryClient, streamersQueryOptions());
	prefetch(queryClient, broadcastsQueryOptions(1));
	// A failure is the page's to say.
	await ensureQuery(queryClient, tvQueryOptions()).catch(() => undefined);
}

/**
 * /watch/$channel: the same read as the grid (the other channels are listed beside the
 * board). A channel Chaal doesn't show (a variant's, or a typo) is Chaal's 404.
 */
export async function loadChannelPage(queryClient: QueryClient, channel: string) {
	if (!isTvChannel(channel)) throw notFound();
	await ensureQuery(queryClient, tvQueryOptions()).catch(() => undefined);
}

/** /broadcasts: the list the URL asks for (a failure is the page's to say). */
export async function loadBroadcastsPage(queryClient: QueryClient, search: BroadcastsSearch) {
	const page = search.page ?? 1;
	const read = search.q
		? ensureQuery(queryClient, broadcastSearchQueryOptions(search.q, page))
		: search.view === "official"
			? ensureQuery(queryClient, officialBroadcastsQueryOptions())
			: ensureQuery(queryClient, broadcastsQueryOptions(page));
	await read.catch(() => undefined);
}

/**
 * /broadcasts/$id: the tournament (one Lichess doesn't know is Chaal's 404), the round shown
 * (the one asked for, else the one Lichess opens), and the followed board's PGN.
 */
export async function loadBroadcastPage(
	queryClient: QueryClient,
	id: string,
	search: BroadcastPageSearch,
): Promise<{ name: string } | undefined> {
	const tour = await ensureQuery(queryClient, broadcastTourQueryOptions(id)).catch((error: unknown) => {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		// Off, or Lichess away: the page says which.
		return null;
	});
	if (!tour) return;
	const round = roundShown(tour, search);
	if (!round) return { name: tour.name };
	await Promise.all([
		ensureQuery(queryClient, broadcastRoundQueryOptions(round)).catch(() => undefined),
		search.board
			? ensureQuery(queryClient, broadcastGameQueryOptions(round, search.board)).catch(() => undefined)
			: Promise.resolve(undefined),
	]);
	// The page's title.
	return { name: tour.name };
}

/** The round a broadcast's page shows: the one in the URL if the tournament has it, else Lichess's choice. */
export function roundShown(
	tour: { rounds: ReadonlyArray<{ id: string }>; defaultRound: string | null },
	search: BroadcastPageSearch,
): string | null {
	if (search.round && tour.rounds.some((round) => round.id === search.round)) return search.round;
	return tour.defaultRound ?? tour.rounds[0]?.id ?? null;
}
