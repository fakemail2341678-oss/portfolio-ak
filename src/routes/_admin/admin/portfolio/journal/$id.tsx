import { createFileRoute } from "@tanstack/react-router";
import { PostEditPage } from "@/features/portfolio/admin/components/post-form";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { loadDetailOr404, titleHead } from "@/lib/crud/route";
import { idSchema } from "@/lib/crud/schema";
import { localizedValue } from "@/lib/i18n/localized";
import { parseParams } from "@/lib/list/params";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/portfolio/journal/$id")({
	params: { parse: (raw) => parseParams(idSchema, raw) },
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "portfolio:write"),
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { postDetailQueryOptions } = await import("@/features/portfolio/admin/queries");
		return {
			title: localizedValue((await loadDetailOr404(context.queryClient, postDetailQueryOptions(params.id))).title),
		};
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: titleHead(m.portfolio_admin_posts_edit),
	component: PostEditPage,
});
