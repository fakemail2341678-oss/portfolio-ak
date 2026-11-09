import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalLiveGamePage } from "@/features/chaal/game/live-game-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/game/$id: a game the player plays on Lichess (PLAN Task 77; noindex, a
 * player's own). For a session connected for play the loader reads the game's first state
 * with the player's token, so it renders on the server; the page says every other case.
 * Task 81 adds finished games anyone may replay, Task 82 spectating.
 */
export const Route = createFileRoute("/_chaal/app/chaal/game/$id")({
	loader: async ({ context, params }) => {
		if (!context.session) return;
		const [{ liveGameQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/chaal/play/queries"),
			import("@/lib/query"),
		]);
		// Not connected, not a game of this player, or Lichess away: the page says which.
		await ensureQuery(context.queryClient, liveGameQueryOptions(params.id)).catch(() => undefined);
	},
	head: () => chaalHead(m.ch_game_title()),
	component: ChaalLiveGamePage,
});
