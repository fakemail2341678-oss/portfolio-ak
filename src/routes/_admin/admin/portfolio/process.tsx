import { createFileRoute } from "@tanstack/react-router";
import { ProcessPage } from "@/features/portfolio/admin/components/section-page";
import { assertRoutePermission } from "@/features/rbac/lib/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/process")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:read"),
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { processSection } = await import("@/features/portfolio/admin/lib/sections");
		return ensureQuery(context.queryClient, processSection.list());
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_process_title) },
	head: titleHead(m.portfolio_admin_process_title),
	component: ProcessPage,
});
