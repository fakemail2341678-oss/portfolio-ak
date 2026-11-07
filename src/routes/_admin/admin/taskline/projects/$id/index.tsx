import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectDetails } from "@/features/taskline/admin/projects/project-details";
import { ensureQuery } from "@/lib/query";

/** /admin/taskline/projects/$id: the details tab. */
export const Route = createFileRoute("/_admin/admin/taskline/projects/$id/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { memberOptionsQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, memberOptionsQueryOptions());
	},
	component: AdminProjectDetails,
});
