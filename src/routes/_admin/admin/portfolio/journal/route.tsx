import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/portfolio/journal/*: needs portfolio:read; names its breadcrumb.
export const Route = createFileRoute("/_admin/admin/portfolio/journal")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:read"),
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_posts_title) },
});
