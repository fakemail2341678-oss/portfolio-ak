import { createFileRoute } from "@tanstack/react-router";
import { KharchaOverviewPage } from "@/features/kharcha/admin/overview/overview-page";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/kharcha: the counts (PLAN Task 96), never anyone's amounts (0186). */
export const Route = createFileRoute("/_admin/admin/kharcha/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kharchaOverviewQueryOptions } = await import("@/features/kharcha/admin/queries");
		await ensureQuery(context.queryClient, kharchaOverviewQueryOptions());
	},
	head: titleHead(m.kharcha_admin_overview_title),
	component: KharchaOverviewPage,
});
