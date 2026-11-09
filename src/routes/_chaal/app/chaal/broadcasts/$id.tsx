import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { broadcastPageSearch } from "@/features/chaal/search";
import { ChaalBroadcastPage } from "@/features/chaal/watch/broadcast-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/broadcasts/$id (PLAN Task 82, decision 0272; noindex: third-party content): a
 * broadcast tournament, a round's boards (`?round=`) or one board followed (`?board=`). One
 * Lichess doesn't know is Chaal's 404; the loader returns the name for the title.
 */
export const Route = createFileRoute("/_chaal/app/chaal/broadcasts/$id")({
	validateSearch: broadcastPageSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) =>
		(await import("@/features/chaal/watch/queries")).loadBroadcastPage(context.queryClient, params.id, deps),
	head: ({ loaderData }) => chaalHead(loaderData?.name ?? m.ch_broadcasts_title()),
	component: ChaalBroadcastPage,
});
