import { createFileRoute } from "@tanstack/react-router";
import { chaalPlayHead } from "@/features/chaal/local/head";
import { ChaalPlayHub } from "@/features/chaal/local/play-hub";

/**
 * /app/chaal/play: the play hub (PLAN Task 76). Indexable. Against the computer or over the
 * board, and the games played here: the loader reads a session's history (without one the
 * games are in the browser, read after hydration).
 */
export const Route = createFileRoute("/_chaal/app/chaal/play")({
	loader: async ({ context }) => {
		if (!context.session) return;
		const [{ localGamesQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/chaal/local/queries"),
			import("@/lib/query"),
		]);
		// A failed read shows in the list; the forms still work.
		await ensureQuery(context.queryClient, localGamesQueryOptions()).catch(() => undefined);
	},
	head: () => chaalPlayHead(),
	component: ChaalPlayHub,
});
