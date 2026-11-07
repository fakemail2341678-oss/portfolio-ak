import { createFileRoute } from "@tanstack/react-router";
import { PardaCollectionEditPage } from "@/features/parda/admin/curation/collection-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { localizedValue } from "@/lib/i18n/localized";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/collections/$id")({
	// Only UUIDs match; anything else is the 404 without a round trip ("new" matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:curate"),
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaAdminCollectionQueryOptions } = await import("@/features/parda/admin/queries");
		const collection = await loadDetailOr404(context.queryClient, pardaAdminCollectionQueryOptions(params.id));
		return { title: localizedValue(collection.name) };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.pd_admin_collection_edit_title),
	component: PardaCollectionEditPage,
});
