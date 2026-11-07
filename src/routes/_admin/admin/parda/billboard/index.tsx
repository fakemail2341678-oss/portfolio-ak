import { createFileRoute } from "@tanstack/react-router";
import { PardaBillboardPage, PardaBillboardPending } from "@/features/parda/admin/curation/billboard-list";
import { pardaPageSearch } from "@/features/parda/admin/search";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/billboard: a page's slots (PLAN Task 69). */
export const Route = createFileRoute("/_admin/admin/parda/billboard/")({
	validateSearch: pardaPageSearch,
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaBillboardsQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaBillboardsQueryOptions());
	},
	head: titleHead(m.pd_admin_billboard_title),
	pendingComponent: PardaBillboardPending,
	component: PardaBillboardPage,
});
