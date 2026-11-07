import { createFileRoute } from "@tanstack/react-router";
import { PlayerLabPage } from "@/features/parda/admin/player-lab/player-lab-page";
import { playerLabSearch } from "@/features/parda/admin/search";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/player-lab: tries each source and logs its messages (parda:configure). */
export const Route = createFileRoute("/_admin/admin/parda/player-lab")({
	validateSearch: playerLabSearch,
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaLabSourcesQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaLabSourcesQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.pd_lab_title) },
	head: titleHead(m.pd_lab_title),
	component: PlayerLabPage,
});
