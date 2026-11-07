import { createFileRoute } from "@tanstack/react-router";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/taskline/projects/*: names its breadcrumb (the parent checks taskline:read).
export const Route = createFileRoute("/_admin/admin/taskline/projects")({
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_projects_title) },
});
