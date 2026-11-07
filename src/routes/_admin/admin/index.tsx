import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/features/admin/components/dashboard";
import { ensureQuery } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { dashboardQueryOptions } = await import("@/features/admin/queries");
		return ensureQuery(context.queryClient, dashboardQueryOptions());
	},
	head: () => ({ meta: [{ title: pageTitle(m.admin_title()) }] }),
	component: Dashboard,
});
