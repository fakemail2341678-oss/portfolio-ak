import { createFileRoute } from "@tanstack/react-router";
import { PardaSettingsPage } from "@/features/parda/admin/settings/settings-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/settings: the kill switch, region, kids' cap, languages, banner and purge (PLAN Task 65). */
export const Route = createFileRoute("/_admin/admin/parda/settings")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaSettingsQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaSettingsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.pd_admin_settings_title) },
	head: titleHead(m.pd_admin_settings_title),
	component: PardaSettingsPage,
});
