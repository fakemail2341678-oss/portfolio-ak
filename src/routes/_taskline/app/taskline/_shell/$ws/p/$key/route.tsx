import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { ProjectLayout } from "@/features/taskline/projects/project-layout";
import { loadDetailOr404 } from "@/lib/crud/route";

/**
 * A project (`$key`): its header and view tabs around the overview, the board, the
 * list and the lead's settings. The project's tasks, statuses, labels and members load
 * here once for every view. Unknown, or not the caller's to see, is a 404 (0204). Its
 * breadcrumb is the key, from the URL (a child's 404 leaves this match without loader
 * data in the browser, src/lib/breadcrumbs.ts); the overview renames it.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key")({
	loader: async ({ context, params }) => {
		const { projectMembersQueryOptions, projectTasksQueryOptions } = await import("@/features/taskline/queries");
		const userId = context.session.user.id;
		const [data] = await Promise.all([
			loadDetailOr404(context.queryClient, projectTasksQueryOptions(userId, params.ws, params.key)),
			loadDetailOr404(context.queryClient, projectMembersQueryOptions(userId, params.ws, params.key)),
		]);
		return { title: data.project.name };
	},
	staticData: { breadcrumb: ({ params }) => params.key },
	head: ({ loaderData }) => ({ meta: [{ title: tasklineTitle(loaderData?.title) }] }),
	component: ProjectLayout,
});
