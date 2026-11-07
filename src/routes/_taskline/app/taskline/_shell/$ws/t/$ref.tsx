import { createFileRoute, notFound } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { keyOfRef } from "@/features/taskline/search";
import { TaskPage } from "@/features/taskline/task/task-page";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";

/**
 * /app/taskline/$ws/t/$ref: a task's own page ("WEB-12"), what the sheet over a view
 * is masked as (a reload, a new tab, a copied link). Unknown or hidden: a 404.
 */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/t/$ref")({
	loader: async ({ context, params }) => {
		const key = keyOfRef(params.ref);
		if (!key) throw notFound();
		const { projectTasksQueryOptions, taskQueryOptions } = await import("@/features/taskline/queries");
		const userId = context.session.user.id;
		const [task] = await Promise.all([
			loadDetailOr404(context.queryClient, taskQueryOptions(userId, params.ws, params.ref)),
			loadDetailOr404(context.queryClient, projectTasksQueryOptions(userId, params.ws, key)),
		]);
		return { title: `${task.ref} ${task.title}` };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => ({ meta: [{ title: tasklineTitle(loaderData?.title) }] }),
	component: TaskPage,
});
