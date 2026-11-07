import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { WorkflowSettings } from "@/features/taskline/settings/workflow-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** A project's settings: the statuses, which are the board's columns. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/workflow")({
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_workflow) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_workflow()) }] }),
	component: WorkflowSettings,
});
