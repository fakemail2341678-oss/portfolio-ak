import { createFileRoute } from "@tanstack/react-router";
import { PARDA_TAKEDOWNS_TABLE_ID, pardaTakedownList } from "@/features/parda/admin/search";
import { PardaTakedownsPage, PardaTakedownsPending } from "@/features/parda/admin/titles/takedown-list";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/** /admin/parda/titles: the takedowns (PLAN Task 65). */
export const Route = createFileRoute("/_admin/admin/parda/titles/")({
	...listSearch(pardaTakedownList.search, pardaTakedownList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaTakedownsQueryOptions } = await import("@/features/parda/admin/queries");
		return listLoader(route, { tableId: PARDA_TAKEDOWNS_TABLE_ID, query: pardaTakedownsQueryOptions });
	},
	head: titleHead(m.pd_admin_takedowns_title),
	pendingComponent: PardaTakedownsPending,
	component: PardaTakedownsPage,
});
