import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { TrashSettings } from "@/features/taskline/settings/trash-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** A project's settings: trashed tasks, restored or deleted for good. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/trash")({
	loader: async ({ context, params }) => {
		const { projectTrashQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, projectTrashQueryOptions(context.session.user.id, params.ws, params.key));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_trash) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_trash()) }] }),
	component: TrashSettings,
});
