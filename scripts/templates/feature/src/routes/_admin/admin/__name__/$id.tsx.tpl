import { createFileRoute } from "@tanstack/react-router";
import { __Pascal__EditPage } from "@/features/__name__/components/__name__-detail";
import { __camel__DetailQueryOptions } from "@/features/__name__/queries";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
{{#localized}}
import { localizedValue } from "@/lib/i18n/localized";
{{/localized}}
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/__name__/$id")({
	// Only UUIDs match; anything else falls through to the localized 404 ("new" is its own route).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "__name__:update"),
	// Only what the breadcrumb needs; the row itself travels in the Query cache.
	loader: async ({ context, params }) => {
		const row = await loadDetailOr404(context.queryClient, __camel__DetailQueryOptions(params.id));
		return { title: {{#localized}}localizedValue(row.title){{/localized}}{{^localized}}row.title{{/localized}} };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.__snake___edit_title),
	component: __Pascal__EditPage,
});
