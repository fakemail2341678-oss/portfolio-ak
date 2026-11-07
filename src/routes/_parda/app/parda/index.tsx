import { createFileRoute } from "@tanstack/react-router";
import { pardaPageHead } from "@/features/parda/home/head";
import { PardaHome } from "@/features/parda/home/parda-page";
import { getLocale } from "@/paraglide/runtime";

/** /app/parda: Parda's home, its billboard and rails (PLAN Task 62). Indexable. */
export const Route = createFileRoute("/_parda/app/parda/")({
	loader: async ({ context }) => {
		const { loadPardaPage } = await import("@/features/parda/home/load");
		return loadPardaPage(context.queryClient, getLocale(), "home", Boolean(context.session));
	},
	head: () => pardaPageHead("home"),
	component: PardaHome,
});
