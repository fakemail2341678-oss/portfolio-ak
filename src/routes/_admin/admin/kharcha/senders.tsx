import { createFileRoute } from "@tanstack/react-router";
import { KharchaSenderList } from "@/features/kharcha/admin/senders/sender-list";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/kharcha/senders: invites per sender as counts, and suspending a sender (PLAN Task 96). */
export const Route = createFileRoute("/_admin/admin/kharcha/senders")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kharchaSendersQueryOptions } = await import("@/features/kharcha/admin/queries");
		await ensureQuery(context.queryClient, kharchaSendersQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.kharcha_admin_senders_title) },
	head: titleHead(m.kharcha_admin_senders_title),
	component: KharchaSenderList,
});
