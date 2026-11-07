import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectLabels } from "@/features/taskline/admin/projects/project-tabs";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/taskline/projects/$id/labels: the project's own labels (its lead edits them in Taskline). */
export const Route = createFileRoute("/_admin/admin/taskline/projects/$id/labels")({
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_tab_labels) },
	component: AdminProjectLabels,
});
