import { createFileRoute } from "@tanstack/react-router";
import { TasklineOverviewPage } from "@/features/taskline/admin/overview/overview-page";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";

/** /admin/taskline: the team's numbers. */
export const Route = createFileRoute("/_admin/admin/taskline/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { tasklineOverviewQueryOptions } = await import("@/features/taskline/admin/queries");
		await ensureQuery(context.queryClient, tasklineOverviewQueryOptions());
	},
	// A brand, the same in every language.
	head: titleHead(() => TASKLINE_NAME),
	component: TasklineOverviewPage,
});
