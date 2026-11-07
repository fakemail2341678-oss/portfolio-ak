import { createFileRoute } from "@tanstack/react-router";
import { AdminProjectLayout } from "@/features/taskline/admin/projects/project-layout";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404 } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { parseParams } from "@/lib/list/params";
import { pageTitle } from "@/lib/seo";

/** /admin/taskline/projects/$id/*: one team project, its header and tabs around the tab. */
export const Route = createFileRoute("/_admin/admin/taskline/projects/$id")({
	// Only UUIDs match ("new" is its own route and matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { adminProjectQueryOptions } = await import("@/features/taskline/admin/queries");
		const project = await loadDetailOr404(context.queryClient, adminProjectQueryOptions(params.id));
		return { title: `${project.key} · ${project.name}` };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? "") }] }),
	component: AdminProjectLayout,
});
