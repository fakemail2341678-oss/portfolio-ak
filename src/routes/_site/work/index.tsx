import { createFileRoute } from "@tanstack/react-router";
import { WorkPage } from "@/features/portfolio/components/pages/work-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { collectionPageJsonLd } from "@/features/portfolio/lib/structured-data";
import { workSearchSchema } from "@/features/portfolio/search";
import { staticCrumb } from "@/lib/breadcrumbs";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_site/work/")({
	validateSearch: workSearchSchema,
	// Every published project in one read; the discipline filter is applied on the page.
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { workQueryOptions } = await import("@/features/portfolio/queries");
		return ensureQuery(context.queryClient, workQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.portfolio_nav_work) },
	// A filtered view is the same page: noindex, canonical to the full list.
	head: ({ match: { search } }) =>
		seo({
			title: m.portfolio_work_title(),
			image: himalOgImage(m.portfolio_work_title()),
			description: m.portfolio_work_description(),
			path: "/work",
			noindex: search.discipline !== undefined,
			jsonLd: collectionPageJsonLd({
				name: m.portfolio_work_title(),
				description: m.portfolio_work_description(),
				path: "/work",
			}),
		}),
	component: WorkPage,
});
