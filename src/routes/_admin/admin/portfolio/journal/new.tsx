import { createFileRoute } from "@tanstack/react-router";
import { PostNewPage } from "@/features/portfolio/admin/components/post-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/journal/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:write"),
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_posts_new) },
	head: titleHead(m.portfolio_admin_posts_new),
	component: PostNewPage,
});
