import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditPage } from "@/features/portfolio/admin/components/project-pages";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/projects/$id")({
	// Only UUIDs match ("new" is its own route and matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:write"),
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { projectDetailQueryOptions } = await import("@/features/portfolio/admin/queries");
		return {
			title: (await loadDetailOr404(context.queryClient, projectDetailQueryOptions(params.id))).title,
		};
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.portfolio_admin_projects_edit),
	component: ProjectEditPage,
});
