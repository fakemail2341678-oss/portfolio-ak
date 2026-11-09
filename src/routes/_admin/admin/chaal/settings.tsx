import { createFileRoute } from "@tanstack/react-router";
import { ChaalAdminSettingsPage } from "@/features/chaal/admin/settings/settings-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/chaal/settings: switches, connecting, online play, defaults, engine, notices, maintenance, purge (PLAN Task 79). */
export const Route = createFileRoute("/_admin/admin/chaal/settings")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { chaalAdminSettingsQueryOptions } = await import("@/features/chaal/admin/queries");
		await ensureQuery(context.queryClient, chaalAdminSettingsQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.ch_admin_settings_title) },
	head: titleHead(m.ch_admin_settings_title),
	component: ChaalAdminSettingsPage,
});
