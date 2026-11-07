import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectWorkflow } from "@/features/taskline/admin/projects/project-tabs";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/taskline/projects/$id/workflow: the project's statuses (its lead edits them in Taskline). */
export const Route = createFileRoute("/_admin/admin/taskline/projects/$id/workflow")({
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_tab_workflow) },
	component: AdminProjectWorkflow,
});
