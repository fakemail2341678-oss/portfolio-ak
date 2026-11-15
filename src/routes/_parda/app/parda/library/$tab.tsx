import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/lib/brand";
import { PardaLibraryPage } from "@/features/parda/library/components/library-page";
import { LIBRARY_DEFAULTS, librarySearchSchema } from "@/features/parda/search";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/library/{list,favourites,continue,history}: the profile's library (PLAN Task
 * 67, decision 0240). Private (noindex). An unknown tab is Parda's 404.
 */
export const Route = createFileRoute("/_parda/app/parda/library/$tab")({
	validateSearch: librarySearchSchema,
	search: { middlewares: [stripSearchParams(LIBRARY_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, params, deps }) => {
		const { loadLibraryPage } = await import("@/features/parda/library/load");
		await loadLibraryPage(context.queryClient, getLocale(), params.tab, deps, Boolean(context.session));
	},
	head: ({ params }) =>
		pardaHead(
			params.tab === "favourites"
				? m.parda_library_favourites()
				: params.tab === "continue"
					? m.parda_continue_watching()
					: params.tab === "history"
						? m.parda_library_history()
						: m.parda_my_list(),
		),
	component: PardaLibraryPage,
});
