import { createFileRoute } from "@tanstack/react-router";
import { PardaCollectionsPage, PardaCollectionsPending } from "@/features/parda/admin/curation/collection-list";
import { titleHead } from "@/lib/crud/route";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /admin/parda/collections: lists of titles the admin puts together (PLAN Task 69). */
export const Route = createFileRoute("/_admin/admin/parda/collections/")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { pardaCollectionsQueryOptions } = await import("@/features/parda/admin/queries");
		await ensureQuery(context.queryClient, pardaCollectionsQueryOptions());
	},
	head: titleHead(m.pd_admin_collections_title),
	pendingComponent: PardaCollectionsPending,
	component: PardaCollectionsPage,
});
