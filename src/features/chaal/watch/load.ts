import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { isAppError } from "@/lib/errors";
import { ensureQuery, prefetch } from "@/lib/query";
import type { BroadcastPageSearch, BroadcastsSearch } from "../search";
import { isTvChannel } from "./lib/limits";
import {
	broadcastGameQueryOptions,
	broadcastRoundQueryOptions,
	broadcastSearchQueryOptions,
	broadcastsQueryOptions,
	broadcastTourQueryOptions,
	officialBroadcastsQueryOptions,
	streamersQueryOptions,
	tvQueryOptions,
} from "./queries";

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
