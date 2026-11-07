import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { AutomationsSettings } from "@/features/taskline/settings/automations-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** A project's settings: its automations and their run log (Task 56). */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/automations")({
	loader: async ({ context, params }) => {
		const { projectAutomationsQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(
			context.queryClient,
			projectAutomationsQueryOptions(context.session.user.id, params.ws, params.key),
		);
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_automations) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_automations()) }] }),
	component: AutomationsSettings,
});
