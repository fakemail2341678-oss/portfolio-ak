import { createFileRoute, notFound } from "@tanstack/react-router";
import { curatedParamSchema } from "@/features/parda/search";
import { pardaContentHead } from "@/features/parda/title/head";
import { PardaCuratedPage } from "@/features/parda/title/parda-collection-page";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/c/best-of-2024: a collection the admin put together (PLAN Task 69). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/c/$slug")({
	loader: async ({ context, params }) => {
		const parsed = curatedParamSchema.safeParse(params);
		if (!parsed.success) throw notFound();
		const { loadCuratedPage } = await import("@/features/parda/title/load");
		return loadCuratedPage(context.queryClient, getLocale(), parsed.data.slug);
	},
	head: ({ loaderData }) => pardaContentHead(loaderData),
	component: PardaCuratedPage,
});
