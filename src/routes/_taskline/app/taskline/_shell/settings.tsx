import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { NotifySettingsPage } from "@/features/taskline/inbox/notify-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/taskline/settings, "My settings": how notifications reach the caller (Task 50). */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/settings")({
	loader: async ({ context }) => {
		const { notifySettingsQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, notifySettingsQueryOptions(context.session.user.id));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_my_settings) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_my_settings()) }] }),
	component: NotifySettingsPage,
});
