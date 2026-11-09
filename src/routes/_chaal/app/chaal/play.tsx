import { createFileRoute } from "@tanstack/react-router";
import { chaalPlayHead } from "@/features/chaal/local/head";
import { ChaalPlayHub } from "@/features/chaal/local/play-hub";
import { playSearch } from "@/features/chaal/search";

/**
 * /app/chaal/play: the play hub (PLAN Tasks 76 and 77). Indexable. Online on Lichess (the
 * AI, a friend, a link), against the computer or over the board, and the games played
 * here: the loader reads a session's history and, for a connected player, their
 * challenges (without a session the games are in the browser, read after hydration).
 */
export const Route = createFileRoute("/_chaal/app/chaal/play")({
	validateSearch: playSearch,
	loader: async ({ context }) => {
		if (!context.session) return;
		const [{ localGamesQueryOptions }, { challengesQueryOptions }, { chaalConnectionQueryOptions }, { ensureQuery }] =
			await Promise.all([
				import("@/features/chaal/local/queries"),
				import("@/features/chaal/play/queries"),
				import("@/features/chaal/queries"),
				import("@/lib/query"),
			]);
		const challenges = async () => {
			// Only for a connection that can play: anything else would be a refused call.
			const connection = await ensureQuery(context.queryClient, chaalConnectionQueryOptions()).catch(() => null);
			if (!connection || connection.revoked || connection.needsScopesFor.includes("play")) return;
			await ensureQuery(context.queryClient, challengesQueryOptions()).catch(() => undefined);
		};
		// A failed read shows in its list; the forms still work.
		await Promise.all([
			ensureQuery(context.queryClient, localGamesQueryOptions()).catch(() => undefined),
			challenges(),
		]);
	},
	head: () => chaalPlayHead(),
	component: ChaalPlayHub,
});
