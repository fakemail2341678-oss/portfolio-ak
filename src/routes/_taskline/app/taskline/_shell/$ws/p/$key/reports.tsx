import { createFileRoute } from "@tanstack/react-router";
import { tasklineTitle } from "@/features/taskline/brand";
import { ProjectReportsPage } from "@/features/taskline/reports/reports-page";
import { projectReportsSearch } from "@/features/taskline/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/taskline/$ws/p/$key/reports (Task 57): a project's reports over `?range=` weeks. */
export const Route = createFileRoute("/_taskline/app/taskline/_shell/$ws/p/$key/reports")({
	validateSearch: projectReportsSearch,
	loaderDeps: ({ search }) => ({ range: search.range }),
	loader: async ({ context, params, deps }) => {
		const { projectReportsQueryOptions } = await import("@/features/taskline/queries");
		await ensureQuery(
			context.queryClient,
			projectReportsQueryOptions(context.session.user.id, params.ws, params.key, deps.range),
		);
	},
	staticData: { breadcrumb: staticCrumb(m.taskline_view_reports) },
	head: () => ({ meta: [{ title: tasklineTitle(m.taskline_view_reports()) }] }),
	component: ProjectReportsPage,
});
