import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { FieldsSettings } from "@/features/taskline/settings/fields-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** A project's settings: its custom fields (Task 55). */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/fields")({
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_fields) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_fields()) }] }),
	component: FieldsSettings,
});
