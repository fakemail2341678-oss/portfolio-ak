import { createFileRoute } from "@tanstack/react-router";
import { KharchaAdminSettingsPage } from "@/features/kharcha/admin/settings/settings-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/kharcha/settings: limits, receipts, currencies, sending and the default categories (PLAN Task 96). */
export const Route = createFileRoute("/_admin/admin/kharcha/settings")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { kharchaAdminSettingsQueryOptions } = await import("@/features/kharcha/admin/queries");
		await ensureQuery(context.queryClient, kharchaAdminSettingsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.kharcha_admin_settings_title) },
	head: titleHead(m.kharcha_admin_settings_title),
	component: KharchaAdminSettingsPage,
});
