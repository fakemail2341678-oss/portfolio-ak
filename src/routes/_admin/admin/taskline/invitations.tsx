import { createFileRoute } from "@tanstack/react-router";
import { AdminInvitationList } from "@/features/taskline/admin/members/invitation-list";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/taskline/invitations: who was invited and hasn't joined yet. */
export const Route = createFileRoute("/_admin/admin/taskline/invitations")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { activityOptionsQueryOptions, invitationsQueryOptions } = await import("@/features/taskline/admin/queries");
		await Promise.all([
			ensureQuery(context.queryClient, invitationsQueryOptions()),
			ensureQuery(context.queryClient, activityOptionsQueryOptions()),
		]);
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_invitations_title) },
	head: titleHead(m.taskline_admin_invitations_title),
	component: AdminInvitationList,
});
