import { createFileRoute } from "@tanstack/react-router";
import { PardaTakedownNewPage } from "@/features/parda/admin/titles/takedown-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/titles/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:moderate"),
	staticData: { breadcrumb: staticCrumb(m.pd_admin_takedown_new_title) },
	head: titleHead(m.pd_admin_takedown_new_title),
	component: PardaTakedownNewPage,
});
