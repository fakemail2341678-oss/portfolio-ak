import { createFileRoute } from "@tanstack/react-router";
import { utilizationRange, utilizationSearch } from "@/features/taskline/admin/search";
import { UtilizationPage } from "@/features/taskline/admin/time/utilization-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/timesheets/utilization: each member's time against their capacity (Task 53). */
export const Route = createFileRoute("/_admin/admin/taskline/timesheets/utilization")({
	validateSearch: utilizationSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const { timeOptionsQueryOptions, utilizationQueryOptions } = await import("@/features/taskline/admin/queries");
		const options = await ensureQuery(context.queryClient, timeOptionsQueryOptions());
		const range = utilizationRange(deps, options);
		await ensureQuery(context.queryClient, utilizationQueryOptions(range.from, range.to));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_utilization_title) },
	head: titleHead(m.taskline_admin_utilization_title),
	component: UtilizationPage,
});
