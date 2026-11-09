import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalGamePage } from "@/features/chaal/game/game-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/game/$id (noindex): a game on Lichess. The player's own while it's played
 * (PLAN Task 77: the loader reads its first state with their token, and its stream keeps it
 * live); every other game, finished, is its replay (Task 81, decision 0271), for anyone.
 * Task 82 adds spectating a game still being played.
 */
export const Route = createFileRoute("/_chaal/app/chaal/game/$id")({
	loader: async ({ context, params }) =>
		(await import("@/features/chaal/game/load")).loadGamePage(context.queryClient, Boolean(context.session), params.id),
	head: () => chaalHead(m.ch_game_title()),
	component: ChaalGamePage,
});
