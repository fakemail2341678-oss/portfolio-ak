import { createFileRoute, notFound } from "@tanstack/react-router";
import { CaseStudyPage } from "@/features/portfolio/components/pages/case-study-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { caseStudyJsonLd } from "@/features/portfolio/lib/structured-data";
import { portfolioSlugParamSchema, previewSearchSchema } from "@/features/portfolio/search";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/work/$slug")({
	// Not a slug -> can't exist: the route doesn't match and the 404 needs no query.
	params: { parse: (raw) => parseParams(portfolioSlugParamSchema, raw) },
	validateSearch: previewSearchSchema,
	loaderDeps: ({ search }) => ({ preview: search.preview === 1 }),
	loader: async ({ context, params, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { projectQueryOptions } = await import("@/features/portfolio/queries");
		const detail = await ensureQuery(context.queryClient, projectQueryOptions(params.slug, deps.preview));
		if (!detail) throw notFound();
		// Only what head() and the breadcrumb need; the full project is in the Query cache.
		const { title, summary, slug, year, client, stack, cover } = detail.project;
		return { title, summary, slug, year, client, stack, image: cover.image, preview: deps.preview };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) =>
		loaderData
			? seo({
					title: loaderData.title,
					description: loaderData.summary,
					path: `/work/${loaderData.slug}`,
					type: "article",
					// A preview may show a draft: never indexed.
					noindex: loaderData.preview,
					image: loaderData.image
						? { url: loaderData.image.og, width: 1200, height: 630, alt: loaderData.title }
						: himalOgImage(loaderData.title),
					jsonLd: caseStudyJsonLd(loaderData),
				})
			: {},
	component: CaseStudyPage,
});
