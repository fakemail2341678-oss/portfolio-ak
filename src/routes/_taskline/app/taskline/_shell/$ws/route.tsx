import { createFileRoute } from "@tanstack/react-router";
import { SANDBOX_SEGMENT } from "@/features/taskline/types";
import { loadDetailOr404 } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

/**
 * A workspace (`$ws`: the team's slug, or `sandbox` for the caller's own). Unknown,
 * or not the caller's to see, is a 404 (decision 0204). Pages read the workspace from
 * the query cache. Its breadcrumb comes from the URL (src/lib/breadcrumbs.ts: a child's
 * 404 leaves this match without loader data in the browser).
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws")({
	loader: async ({ context, params }) => {
		const { workspaceQueryOptions } = await import("@/features/taskline/queries");
		await loadDetailOr404(context.queryClient, workspaceQueryOptions(context.session.user.id, params.ws));
	},
	staticData: {
		breadcrumb: ({ params }) => (params.ws === SANDBOX_SEGMENT ? m.taskline_crumb_sandbox() : m.taskline_crumb_team()),
	},
});
