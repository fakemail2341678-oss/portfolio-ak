import { createFileRoute } from "@tanstack/react-router";
import { PardaLayoutPage } from "@/features/parda/admin/curation/layout-page";
import { pardaPageSearch } from "@/features/parda/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/layout: the rails of the home and each hub (PLAN Task 69). */
export const Route = createFileRoute("/_admin/admin/parda/layout")({
	validateSearch: pardaPageSearch,
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ context, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaLayoutQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaLayoutQueryOptions(deps.page));
	},
	staticData: { breadcrumb: staticCrumb(m.pd_admin_layout_title) },
	head: titleHead(m.pd_admin_layout_title),
	component: PardaLayoutPage,
});
