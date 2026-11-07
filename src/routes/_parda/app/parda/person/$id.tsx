import { createFileRoute, notFound } from "@tanstack/react-router";
import { idParamSchema } from "@/features/parda/search";
import { pardaContentHead } from "@/features/parda/title/head";
import { PardaPersonPage } from "@/features/parda/title/parda-person-page";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda/person/287: a person's biography, what they're known for and their filmography (PLAN Task 63). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/person/$id")({
	loader: async ({ context, params }) => {
		const parsed = idParamSchema.safeParse(params);
		if (!parsed.success) throw notFound();
		const { loadPersonPage } = await import("@/features/parda/title/load");
		return loadPersonPage(context.queryClient, getLocale(), parsed.data.id);
	},
	head: ({ loaderData }) => pardaContentHead(loaderData),
	component: PardaPersonPage,
});
