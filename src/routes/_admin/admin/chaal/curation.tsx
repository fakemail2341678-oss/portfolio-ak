import { createFileRoute } from "@tanstack/react-router";
import { ChaalCurationPage } from "@/features/chaal/admin/curation/curation-page";
import { chaalCurationSearch } from "@/features/chaal/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/chaal/curation: what the home features, its sections' order and the announcement (PLAN Task 84). */
export const Route = createFileRoute("/_admin/admin/chaal/curation")({
	validateSearch: chaalCurationSearch,
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalCurationQueryOptions } = await import("@/features/chaal/admin/queries");
		await ensureQuery(context.queryClient, chaalCurationQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.ch_admin_curation_title) },
	head: titleHead(m.ch_admin_curation_title),
	component: ChaalCurationPage,
});
