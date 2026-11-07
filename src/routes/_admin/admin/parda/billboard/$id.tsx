import { createFileRoute } from "@tanstack/react-router";
import { PardaBillboardEditPage } from "@/features/parda/admin/curation/billboard-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/billboard/$id")({
	// Only UUIDs match; anything else is the 404 without a round trip ("new" matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:curate"),
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaBillboardQueryOptions } = await import("@/features/parda/admin/queries");
		await loadDetailOr404(context.queryClient, pardaBillboardQueryOptions(params.id));
	},
	staticData: { breadcrumb: staticCrumb(m.pd_admin_billboard_edit_title) },
	head: titleHead(m.pd_admin_billboard_edit_title),
	component: PardaBillboardEditPage,
});
