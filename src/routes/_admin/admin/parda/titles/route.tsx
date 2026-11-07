import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/parda/titles/*: the takedown list (parda:read from the section; writes need parda:moderate). */
export const Route = createFileRoute("/_admin/admin/parda/titles")({
	staticData: { breadcrumb: staticCrumb(m.pd_admin_takedowns_title) },
});
