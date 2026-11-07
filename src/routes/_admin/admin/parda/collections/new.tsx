import { createFileRoute } from "@tanstack/react-router";
import { PardaCollectionNewPage } from "@/features/parda/admin/curation/collection-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/collections/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:curate"),
	staticData: { breadcrumb: staticCrumb(m.pd_admin_collection_new_title) },
	head: titleHead(m.pd_admin_collection_new_title),
	component: PardaCollectionNewPage,
});
