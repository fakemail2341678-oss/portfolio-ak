import { createFileRoute } from "@tanstack/react-router";
import { ProjectSettingsLayout } from "@/features/taskline/settings/settings-layout";
import { staticCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";
import { AppError } from "@/lib/errors";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * A project's settings: its lead's (and `taskline:manage`'s). Someone who can see the
 * project but not run it gets the FORBIDDEN page (decision 0204: they can see it, so
 * it isn't a 404); the server refuses their writes anyway.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings")({
	loader: async ({ context, params }) => {
		const { projectTasksQueryOptions } = await import("@/features/taskline/queries");
		const data = await loadDetailOr404(
			context.queryClient,
			projectTasksQueryOptions(context.session.user.id, params.ws, params.key),
		);
		if (!data.project.can.manage) {
			const error = new AppError("FORBIDDEN", "Taskline: project settings are the lead's");
			await setErrorStatus(error);
			throw error;
		}
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_view_settings) },
	component: ProjectSettingsLayout,
});
