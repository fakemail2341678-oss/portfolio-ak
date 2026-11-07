import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { LabelsSettings } from "@/features/taskline/settings/labels-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** A project's settings: the project's labels. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/labels")({
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_labels) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_labels()) }] }),
	component: LabelsSettings,
});
