import { createFileRoute } from "@tanstack/react-router";
import { ChaalBlocksPage, ChaalBlocksPending } from "@/features/chaal/admin/blocks/block-list";
import { CHAAL_BLOCKS_TABLE_ID, chaalBlockList } from "@/features/chaal/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/** /admin/chaal/blocks: the blocked Lichess accounts and site users (PLAN Task 79). */
export const Route = createFileRoute("/_admin/admin/chaal/blocks/")({
	...listSearch(chaalBlockList.search, chaalBlockList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalBlocksQueryOptions } = await import("@/features/chaal/admin/queries");
		return listLoader(route, { tableId: CHAAL_BLOCKS_TABLE_ID, query: chaalBlocksQueryOptions });
	},
	staticData: { breadcrumb: staticCrumb(m.ch_admin_blocks_title) },
	head: titleHead(m.ch_admin_blocks_title),
	pendingComponent: ChaalBlocksPending,
	component: ChaalBlocksPage,
});
