import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { ProjectDirectory } from "@/features/taskline/projects/project-directory";
import { projectsSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/taskline/$ws/projects: the workspace's projects as cards or a list, stars, and a create dialog for those allowed. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/projects")({
	validateSearch: projectsSearch,
	loaderDeps: ({ search }) => ({ archived: search.archived === 1 }),
	loader: async ({ context, params, deps }) => {
		const { projectsQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(context.queryClient, projectsQueryOptions(context.session.user.id, params.ws, deps.archived));
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_nav_projects) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_nav_projects()) }] }),
	component: ProjectDirectory,
});
