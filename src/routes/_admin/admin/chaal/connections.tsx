import { createFileRoute } from "@tanstack/react-router";
import { ChaalConnectionsPage, ChaalConnectionsPending } from "@/features/chaal/admin/connections/connection-list";
import { CHAAL_CONNECTIONS_TABLE_ID, chaalConnectionList } from "@/features/chaal/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/** /admin/chaal/connections: connected Lichess accounts, revoke, block, CSV (PLAN Task 79). */
export const Route = createFileRoute("/_admin/admin/chaal/connections")({
	...listSearch(chaalConnectionList.search, chaalConnectionList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalConnectionsQueryOptions } = await import("@/features/chaal/admin/queries");
		return listLoader(route, { tableId: CHAAL_CONNECTIONS_TABLE_ID, query: chaalConnectionsQueryOptions });
	},
	staticData: { breadcrumb: staticCrumb(m.ch_admin_connections_title) },
	head: titleHead(m.ch_admin_connections_title),
	pendingComponent: ChaalConnectionsPending,
	component: ChaalConnectionsPage,
});
