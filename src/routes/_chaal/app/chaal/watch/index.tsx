import { createFileRoute } from "@tanstack/react-router";
import { chaalPageHead } from "@/features/chaal/head";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { ChaalWatchPage } from "@/features/chaal/watch/tv-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/watch (PLAN Task 82, decision 0272; indexable): Lichess TV, a diagram per
 * channel drawn on the server and then live from the browser; beside it what's broadcast now
 * and the streamers live. The loader reads the TV's games; a failed read is the page's to say.
 */
export const Route = createFileRoute("/_chaal/app/chaal/watch/")({
	loader: async ({ context }) => (await import("@/features/chaal/watch/queries")).loadWatchPage(context.queryClient),
	head: () => chaalPageHead(CHAAL_PATHS.watch, m.ch_watch_title(), m.ch_watch_description()),
	component: ChaalWatchPage,
});
