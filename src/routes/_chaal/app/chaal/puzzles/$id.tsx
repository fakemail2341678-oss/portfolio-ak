import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/brand";
import { ChaalPuzzlePage } from "@/features/chaal/puzzles/puzzles-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/puzzles/$id (PLAN Task 80; noindex, PLAN 13.5): one puzzle by its Lichess id,
 * drawn on the server, then training. A puzzle Lichess doesn't have is said on the page.
 */
export const Route = createFileRoute("/_chaal/app/chaal/puzzles/$id")({
	loader: async ({ context, params }) =>
		(await import("@/features/chaal/puzzles/queries")).loadPuzzlePage(
			context.queryClient,
			Boolean(context.session),
			params.id,
		),
	head: () => chaalHead(m.ch_puzzle_title()),
	component: ChaalPuzzlePage,
});
