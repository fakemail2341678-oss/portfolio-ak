import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalLocalGamePage } from "@/features/chaal/local/local-game-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/local/$id: a local game (PLAN Task 76; noindex, a player's own). The loader
 * reads a session's game, so it renders on the server; without a session the game is in
 * the browser and the page reads it after hydration.
 */
export const Route = createFileRoute("/_chaal/app/chaal/local/$id")({
	loader: async ({ context, params }) => {
		if (!context.session) return;
		const [{ localGameQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/chaal/local/queries"),
			import("@/lib/query"),
		]);
		// Not on the account (another player's, deleted, or still in this browser): the page decides.
		await ensureQuery(context.queryClient, localGameQueryOptions(params.id)).catch(() => undefined);
	},
	head: () => chaalHead(m.ch_local_title()),
	component: ChaalLocalGamePage,
});
