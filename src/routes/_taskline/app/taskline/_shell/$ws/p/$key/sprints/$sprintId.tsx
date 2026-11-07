import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { sprintReportSearch } from "@/features/taskline/search";
import { SprintReportPage } from "@/features/taskline/sprints/sprint-report";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";

/**
 * /app/taskline/$ws/p/$key/sprints/$sprintId (Task 52): a sprint's report. Unknown, or
 * another project's: a 404.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/sprints/$sprintId")({
	validateSearch: sprintReportSearch,
	loader: async ({ context, params }) => {
		const { sprintReportQueryOptions } = await import("@/features/taskline/queries");
		const report = await loadDetailOr404(
			context.queryClient,
			sprintReportQueryOptions(context.session.user.id, params.ws, params.key, params.sprintId),
		);
		return { title: report.sprint.name };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => ({ meta: [{ title: tasklineTitle(loaderData?.title) }] }),
	component: SprintReportPage,
});
