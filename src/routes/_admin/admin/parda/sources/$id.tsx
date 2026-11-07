import { createFileRoute } from "@tanstack/react-router";
import { PardaSourceEditPage } from "@/features/parda/admin/sources/source-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { localizedValue } from "@/lib/i18n/localized";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/parda/sources/$id")({
	// Only UUIDs match; anything else is the 404 without a round trip ("new" matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:configure"),
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaSourceQueryOptions } = await import("@/features/parda/admin/queries");
		const source = await loadDetailOr404(context.queryClient, pardaSourceQueryOptions(params.id));
		return { title: localizedValue(source.name) };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.pd_admin_source_edit_title),
	component: PardaSourceEditPage,
});
