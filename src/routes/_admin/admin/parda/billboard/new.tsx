import { createFileRoute } from "@tanstack/react-router";
import { PardaBillboardNewPage } from "@/features/parda/admin/curation/components/billboard-form";
import { pardaPageSearch } from "@/features/parda/admin/search";
import { assertRoutePermission } from "@/features/rbac/lib/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/billboard/new")({
	validateSearch: pardaPageSearch,
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:curate"),
	staticData: { breadcrumb: staticCrumb(m.parda_admin_billboard_new_title) },
	head: titleHead(m.parda_admin_billboard_new_title),
	component: PardaBillboardNewPage,
});
