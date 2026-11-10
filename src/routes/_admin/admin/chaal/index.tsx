import { createFileRoute } from "@tanstack/react-router";
import { ChaalOverviewPage } from "@/features/chaal/admin/overview/overview-page";
import { chaalOverviewSearch } from "@/features/chaal/admin/search";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/chaal: the numbers (PLAN Task 84). Every Chaal admin page needs chaal:read. */
export const Route = createFileRoute("/_admin/admin/chaal/")({
	validateSearch: chaalOverviewSearch,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalOverviewQueryOptions } = await import("@/features/chaal/admin/queries");
		await ensureQuery(context.queryClient, chaalOverviewQueryOptions(deps.range));
	},
	head: titleHead(m.ch_admin_overview_title),
	component: ChaalOverviewPage,
});
