import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/lib/brand";
import { GeneralSettings } from "@/features/taskline/settings/components/general-settings-panel";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** A project's settings: the project form, its state and health, and archiving. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/general")({
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_general) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_general()) }] }),
	component: GeneralSettings,
});
