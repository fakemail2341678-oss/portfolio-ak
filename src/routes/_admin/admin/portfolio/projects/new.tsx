import { createFileRoute } from "@tanstack/react-router";
import { ProjectNewPage } from "@/features/portfolio/admin/components/project-pages";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/projects/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:write"),
	staticData: { breadcrumb: staticCrumb(m.portfolio_admin_projects_new) },
	head: titleHead(m.portfolio_admin_projects_new),
	component: ProjectNewPage,
});
