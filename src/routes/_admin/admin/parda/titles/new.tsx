import { createFileRoute } from "@tanstack/react-router";
import { PardaTakedownNewPage } from "@/features/parda/admin/titles/components/takedown-form";
import { assertRoutePermission } from "@/features/rbac/lib/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/titles/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:moderate"),
	staticData: { breadcrumb: staticCrumb(m.parda_admin_takedown_new_title) },
	head: titleHead(m.parda_admin_takedown_new_title),
	component: PardaTakedownNewPage,
});
