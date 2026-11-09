import { createFileRoute } from "@tanstack/react-router";
import { chaalPageHead } from "@/features/chaal/head";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { ChaalPuzzlesPage } from "@/features/chaal/puzzles/puzzles-page";
import { puzzlesSearch } from "@/features/chaal/search";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/puzzles (PLAN Task 80, decision 0269): the daily puzzle (drawn on the server,
 * indexable), training (`?mode=train`, a theme, a difficulty, a side), the streak and
 * replaying Lichess's misses. The loader reads what the first paint shows; a failed read is
 * the page's to say.
 */
export const Route = createFileRoute("/_chaal/app/chaal/puzzles/")({
	validateSearch: puzzlesSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) =>
		(await import("@/features/chaal/puzzles/queries")).loadPuzzlesPage(
			context.queryClient,
			Boolean(context.session),
			deps,
		),
	head: () => chaalPageHead(CHAAL_PATHS.puzzles, m.ch_puzzles_title(), m.ch_puzzles_description()),
	component: ChaalPuzzlesPage,
});
