import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TestCrudEditPage } from "@/features/test-crud/components/test-crud-detail";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/test-crud/$id")({
	// Only UUIDs match this route; anything else falls through to the localized 404
	// without a server round trip ("new" is its own route and matches first).
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "test-crud:update"),
	// Only what the breadcrumb needs; the item itself travels in the Query cache.
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { testCrudDetailQueryOptions } = await import("@/features/test-crud/queries");
		return {
			title: (await loadDetailOr404(context.queryClient, testCrudDetailQueryOptions(params.id))).title,
		};
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.test_crud_edit_title),
	component: TestCrudEditPage,
});
