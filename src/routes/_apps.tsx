import { createFileRoute } from "@tanstack/react-router";
import { AppsLayout } from "@/features/apps/components/apps-layout";
import { fontPreloads } from "@/lib/fonts";
import { ensureQuery } from "@/lib/query"; // @portfolio
import { NOINDEX } from "@/lib/seo";
import { getLocale } from "@/paraglide/runtime";

/**
 * The showcase apps under /apps (decision 0187): their own frame (the app header, the
 * guest banner, TanStack DB). Every page is private unless it says otherwise: the
 * gallery and each app's landing are indexable (seo()), what's inside an app isn't.
 */
export const Route = createFileRoute("/_apps")({
	// portfolio:start
	// The case study of each app, for the header's link back to it.
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { appCaseStudiesQueryOptions } = await import("@/features/portfolio/queries");
		return ensureQuery(context.queryClient, appCaseStudiesQueryOptions());
	},
	// portfolio:end
	head: () => ({ meta: [NOINDEX], links: fontPreloads(getLocale()) }),
	component: AppsLayout,
});
