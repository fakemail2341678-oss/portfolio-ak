import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { MembersSettings } from "@/features/taskline/settings/members-settings";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** A project's settings: who is on the project and in which role. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/settings/members")({
	loader: async ({ context, params }) => {
		const { workspaceMembersQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, workspaceMembersQueryOptions(context.session.user.id, params.ws));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_settings_members) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_settings_members()) }] }),
	component: MembersSettings,
});
