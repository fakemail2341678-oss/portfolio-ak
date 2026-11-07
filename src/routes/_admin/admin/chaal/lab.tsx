import { createFileRoute } from "@tanstack/react-router";
import { ChaalLabPage } from "@/features/chaal/admin/lab/lab-page";
import { chaalLabSearch } from "@/features/chaal/admin/search";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/chaal/lab: connect Lichess, see the account and scopes, time the event stream (chaal:configure, Task 71). */
export const Route = createFileRoute("/_admin/admin/chaal/lab")({
	validateSearch: chaalLabSearch,
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "chaal:configure"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const [{ chaalLabQueryOptions }, { chaalConnectionQueryOptions, chaalStatusQueryOptions }] = await Promise.all([
			import("@/features/chaal/admin/queries"),
			import("@/features/chaal/queries"),
		]);
		await Promise.all([
			ensureQuery(context.queryClient, chaalLabQueryOptions()),
			ensureQuery(context.queryClient, chaalConnectionQueryOptions()),
			ensureQuery(context.queryClient, chaalStatusQueryOptions()),
		]);
	},
	staticData: { breadcrumb: staticCrumb(m.ch_lab_title) },
	head: titleHead(m.ch_lab_title),
	component: ChaalLabPage,
});
