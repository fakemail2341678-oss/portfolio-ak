import { createFileRoute } from "@tanstack/react-router";
import { PardaOverviewPage } from "@/features/parda/admin/overview/overview-page";
import { pardaOverviewSearch } from "@/features/parda/admin/search";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda: the numbers (PLAN Task 69). */
export const Route = createFileRoute("/_admin/admin/parda/")({
	validateSearch: pardaOverviewSearch,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaOverviewQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaOverviewQueryOptions(deps.range));
	},
	head: titleHead(m.pd_admin_overview_title),
	component: PardaOverviewPage,
});
