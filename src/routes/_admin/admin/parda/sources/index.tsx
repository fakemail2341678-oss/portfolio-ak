import { createFileRoute } from "@tanstack/react-router";
import { PardaSourcesPage, PardaSourcesPending } from "@/features/parda/admin/sources/source-list";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/sources: every source in order, and the kill switch (PLAN Task 65). */
export const Route = createFileRoute("/_admin/admin/parda/sources/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaSettingsQueryOptions, pardaSourcesQueryOptions } = await import("@/features/parda/admin/queries");
		await Promise.all([
			ensureQuery(context.queryClient, pardaSourcesQueryOptions()),
			ensureQuery(context.queryClient, pardaSettingsQueryOptions()),
		]);
	},
	head: titleHead(m.pd_admin_sources_title),
	pendingComponent: PardaSourcesPending,
	component: PardaSourcesPage,
});
