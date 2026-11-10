import { createFileRoute } from "@tanstack/react-router";
import { CHAAL_NAME } from "@/features/chaal/brand";
import { chaalPageHead } from "@/features/chaal/head";
import { ChaalHome } from "@/features/chaal/home/chaal-home";
import { CHAAL_PATHS } from "@/features/chaal/links";
import { ensureQuery } from "@/lib/query";
import { m } from "@/paraglide/messages";

/** /app/chaal: Chaal's home (PLAN Tasks 73 and 84). Indexable. The layout's loader read the status; this one the curated sections. */
export const Route = createFileRoute("/_chaal/app/chaal/")({
	loader: async ({ context }) => {
		// On demand: the query and its server function stay out of every page's JavaScript (0194).
		const { chaalHomeQueryOptions } = await import("@/features/chaal/home/queries");
		await ensureQuery(context.queryClient, chaalHomeQueryOptions());
	},
	head: () => chaalPageHead(CHAAL_PATHS.home, m.ch_home_title(), m.ch_description(), CHAAL_NAME),
	component: ChaalHome,
});
