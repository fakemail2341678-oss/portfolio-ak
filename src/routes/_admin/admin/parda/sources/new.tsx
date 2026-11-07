import { createFileRoute } from "@tanstack/react-router";
import { PardaSourceNewPage } from "@/features/parda/admin/sources/source-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/sources/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:configure"),
	staticData: { breadcrumb: staticCrumb(m.pd_admin_source_new_title) },
	head: titleHead(m.pd_admin_source_new_title),
	component: PardaSourceNewPage,
});
