import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArticlePage } from "@/features/portfolio/components/pages/article-page";
import { himalOgImage } from "@/features/portfolio/lib/og-image";
import { articleJsonLd } from "@/features/portfolio/lib/structured-data";
import { portfolioSlugParamSchema, previewSearchSchema } from "@/features/portfolio/search";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/journal/$slug")({
	params: { parse: (raw) => parseParams(portfolioSlugParamSchema, raw) },
	validateSearch: previewSearchSchema,
	loaderDeps: ({ search }) => ({ preview: search.preview === 1 }),
	loader: async ({ context, params, deps }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { postQueryOptions } = await import("@/features/portfolio/queries");
		const detail = await ensureQuery(context.queryClient, postQueryOptions(params.slug, deps.preview));
		if (!detail) throw notFound();
		const { title, excerpt, slug, publishedAt, tags, cover } = detail.post;
		return { title, excerpt, slug, publishedAt, tags, image: cover, preview: deps.preview };
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const tags = seo({
			title: loaderData.title,
			description: loaderData.excerpt,
			path: `/journal/${loaderData.slug}`,
			type: "article",
			// A preview may show a draft: never indexed.
			noindex: loaderData.preview,
			image: loaderData.image
				? { url: loaderData.image.og, width: 1200, height: 630, alt: loaderData.title }
				: himalOgImage(loaderData.title),
			jsonLd: articleJsonLd(loaderData),
		});
		return {
			...tags,
			meta: [...tags.meta, { property: "article:published_time", content: loaderData.publishedAt }],
		};
	},
	component: ArticlePage,
});
