import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { ProjectOverview } from "@/features/taskline/projects/project-overview";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";

/** /app/taskline/$ws/p/$key: a project's overview (description, progress, people, recent activity). */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/")({
	loader: async ({ context, params }) => {
		const { projectActivityQueryOptions, projectTasksQueryOptions, projectUpdatesQueryOptions } = await import(
			"@/features/taskline/queries"
		);
		const userId = context.session.user.id;
		const [data] = await Promise.all([
			loadDetailOr404(context.queryClient, projectTasksQueryOptions(userId, params.ws, params.key)),
			loadDetailOr404(context.queryClient, projectActivityQueryOptions(userId, params.ws, params.key)),
			loadDetailOr404(context.queryClient, projectUpdatesQueryOptions(userId, params.ws, params.key)),
		]);
		return { title: data.project.name };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => ({ meta: [{ title: tasklineTitle(loaderData?.title) }] }),
	component: ProjectOverview,
});
