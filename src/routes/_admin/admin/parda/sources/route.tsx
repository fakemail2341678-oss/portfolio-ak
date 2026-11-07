import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/parda/sources/*: the playback sources (parda:read from the section; writes need parda:configure). */
export const Route = createFileRoute("/_admin/admin/parda/sources")({
	staticData: { breadcrumb: staticCrumb(m.pd_admin_sources_title) },
});
