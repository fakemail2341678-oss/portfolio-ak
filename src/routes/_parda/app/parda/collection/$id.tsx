import { createFileRoute, notFound } from "@tanstack/react-router";
import { idParamSchema } from "@/features/parda/search";
import { pardaContentHead } from "@/features/parda/title/head";
import { PardaCollectionPage } from "@/features/parda/title/parda-collection-page";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/collection/263: a franchise's titles, in release order (PLAN Task 63). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/collection/$id")({
	loader: async ({ context, params }) => {
		const parsed = idParamSchema.safeParse(params);
		if (!parsed.success) throw notFound();
		const { loadCollectionPage } = await import("@/features/parda/title/load");
		return loadCollectionPage(context.queryClient, getLocale(), parsed.data.id);
	},
	head: ({ loaderData }) => pardaContentHead(loaderData),
	component: PardaCollectionPage,
});
