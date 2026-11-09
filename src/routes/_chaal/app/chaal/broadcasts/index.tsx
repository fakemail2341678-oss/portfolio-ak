import { createFileRoute } from "@tanstack/react-router";
import { chaalPageHead } from "@/features/chaal/head";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { broadcastsSearch } from "@/features/chaal/search";
import { ChaalBroadcastsPage } from "@/features/chaal/watch/broadcasts-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/broadcasts (PLAN Task 82, decision 0272; indexable): Lichess's broadcasts: live,
 * coming up and past (`?page=`), the official ones (`?view=official`), or a search (`?q=`).
 */
export const Route = createFileRoute("/_chaal/app/chaal/broadcasts/")({
	validateSearch: broadcastsSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) =>
		(await import("@/features/chaal/watch/queries")).loadBroadcastsPage(context.queryClient, deps),
	head: () => chaalPageHead(CHAAL_PATHS.broadcasts, m.ch_broadcasts_title(), m.ch_broadcasts_description()),
	component: ChaalBroadcastsPage,
});
