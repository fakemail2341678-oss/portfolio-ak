import { createFileRoute } from "@tanstack/react-router";
import { PardaReportsPage, PardaReportsPending } from "@/features/parda/admin/reports/report-list";
import { PARDA_REPORTS_TABLE_ID, pardaReportList } from "@/features/parda/admin/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { listLoader, listSearch, titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/reports: viewers' reports, open ones first (PLAN Task 65). */
export const Route = createFileRoute("/_admin/admin/parda/reports")({
	...listSearch(pardaReportList.search, pardaReportList.defaults),
	loaderDeps: ({ search }) => search,
	loader: async (route) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaReportsQueryOptions, pardaSourcesQueryOptions } = await import("@/features/parda/admin/queries");
		return listLoader(route, {
			tableId: PARDA_REPORTS_TABLE_ID,
			query: pardaReportsQueryOptions,
			also: (queryClient) => ensureQuery(queryClient, pardaSourcesQueryOptions()),
		});
	},
	staticData: { breadcrumb: staticCrumb(m.pd_admin_reports_title) },
	head: titleHead(m.pd_admin_reports_title),
	pendingComponent: PardaReportsPending,
	component: PardaReportsPage,
});
