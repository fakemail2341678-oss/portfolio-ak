import { createFileRoute } from "@tanstack/react-router";
import { ChaalHealthPage } from "@/features/chaal/admin/health/health-page";
import { chaalHealthSearch } from "@/features/chaal/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/chaal/health: Lichess calls, errors and 429s by hour and endpoint, cooldowns, errors, a ping (PLAN Task 79). */
export const Route = createFileRoute("/_admin/admin/chaal/health")({
	validateSearch: chaalHealthSearch,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalHealthQueryOptions } = await import("@/features/chaal/admin/queries");
		await ensureQuery(context.queryClient, chaalHealthQueryOptions(deps.range));
	},
	staticData: { breadcrumb: staticCrumb(m.ch_admin_health_title) },
	head: titleHead(m.ch_admin_health_title),
	component: ChaalHealthPage,
});
