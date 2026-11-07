import { createFileRoute } from "@tanstack/react-router";
import { AppsUsagePage } from "@/features/apps/admin/usage-page";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/apps: the showcase apps' usage (decision 0187). */
export const Route = createFileRoute("/_admin/admin/apps")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "apps:read"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { appsUsageQueryOptions } = await import("@/features/apps/admin/queries");
		await ensureQuery(context.queryClient, appsUsageQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.apps_usage_title) },
	head: titleHead(m.apps_usage_title),
	component: AppsUsagePage,
});
