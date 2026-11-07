import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/parda/collections/*: curated collections (parda:read from the section; writes need parda:curate). */
export const Route = createFileRoute("/_admin/admin/parda/collections")({
	staticData: { breadcrumb: staticCrumb(m.pd_admin_collections_title) },
});
