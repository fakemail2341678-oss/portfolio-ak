import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/lib/brand";
import { ChaalChannelPage } from "@/features/chaal/watch/components/channel-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/watch/$channel (PLAN Task 82, decision 0272; noindex: other people's games): one
 * TV channel on the big board, live. A channel Chaal doesn't show is its 404.
 */
export const Route = createFileRoute("/_chaal/app/chaal/watch/$channel")({
	loader: async ({ context, params }) =>
		(await import("@/features/chaal/watch/load")).loadChannelPage(context.queryClient, params.channel),
	head: () => chaalHead(m.chaal_watch_tv()),
	component: ChaalChannelPage,
});
