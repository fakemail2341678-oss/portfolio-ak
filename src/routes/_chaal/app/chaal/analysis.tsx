import { createFileRoute } from "@tanstack/react-router";
import { ChaalAnalysisPage } from "@/features/chaal/analysis/analysis-page";
import { chaalAnalysisHead } from "@/features/chaal/analysis/head";
import { analysisSearch } from "@/features/chaal/search";

/**
 * /app/chaal/analysis: the analysis board (PLAN Task 75, decision 0264). Indexable. The URL
 * holds the position (`fen`, `moves`, `ply`, `orientation`), drawn on the server; `?id=`
 * opens one of the player's saved analyses, which the loader reads for a session.
 */
export const Route = createFileRoute("/_chaal/app/chaal/analysis")({
	validateSearch: analysisSearch,
	loaderDeps: ({ search }) => ({ id: search.id }),
	loader: async ({ context, deps }) => {
		if (!deps.id || !context.session) return;
		const [{ analysisQueryOptions }, { ensureQuery }] = await Promise.all([
			import("@/features/chaal/analysis/queries"),
			import("@/lib/query"),
		]);
		// Another player's id, or one deleted since: the page says so and opens an empty board.
		await ensureQuery(context.queryClient, analysisQueryOptions(deps.id)).catch(() => undefined);
	},
	head: () => chaalAnalysisHead(),
	component: ChaalAnalysisPage,
});
