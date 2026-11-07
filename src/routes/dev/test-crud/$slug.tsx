import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useEffect, useRef } from "react";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { Page } from "@/components/page/page";
import { RichTextContent } from "@/components/rich-text-content";
import { Badge } from "@/components/ui/badge";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { publicTestCrudDetailQueryOptions } from "@/features/test-crud/queries";
import { testCrudSlugParamSchema } from "@/features/test-crud/search";
import { loaderTitleCrumb } from "@/lib/breadcrumbs";
import { isAppError } from "@/lib/errors";
import { formatCurrency, formatDate } from "@/lib/i18n/intl";
import { parseParams } from "@/lib/list/params";
import { track } from "@/lib/observability/analytics";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/dev/test-crud/$slug")({
	// Not a valid slug -> can't exist: the route doesn't match, so the localized 404
	// is served without a query.
	params: { parse: (raw) => parseParams(testCrudSlugParamSchema, raw) },
	loader: async ({ context, params }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { publicTestCrudDetailQueryOptions } = await import("@/features/test-crud/queries");
		try {
			const { title } = await ensureQuery(context.queryClient, publicTestCrudDetailQueryOptions(params.slug));
			// Only what head() and the breadcrumb need: the full item (with its body) already
			// travels to the browser in the Query cache, so returning it would send it twice.
			return { title };
		} catch (error) {
			// Missing and draft slugs are indistinguishable to the public: both 404.
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	staticData: { breadcrumb: loaderTitleCrumb },
	// A dev reference for public detail pages: private like all of /dev. A public page would
	// use seo() with its image and JSON-LD (docs/guides/seo.md, as the portfolio's case studies do).
	head: ({ loaderData }) => privateHead(loaderData?.title),
	component: PublicDetailPage,
});

function PublicDetailPage() {
	const { slug } = Route.useParams();
	const { data: item } = useSuspenseQuery(publicTestCrudDetailQueryOptions(slug));
	const phone = item.phone ? parsePhoneNumberFromString(item.phone) : undefined;

	// Once per item shown (StrictMode runs effects twice in dev). A no-op without analytics consent.
	const viewed = useRef<string | null>(null);
	useEffect(() => {
		if (viewed.current === item.slug) return;
		viewed.current = item.slug;
		track("test_crud_viewed", { slug: item.slug });
	}, [item.slug]);

	return (
		<Page width="narrow">
			<Breadcrumbs jsonLd />
			<article className="flex flex-col gap-6">
				<header className="flex flex-col gap-3">
					<h1 className="font-semibold text-3xl leading-tight tracking-tight sm:text-4xl">{item.title}</h1>
					<p className="text-muted-foreground text-sm">
						{m.test_crud_public_published_on({ date: formatDate(item.publishedAt, { dateStyle: "long" }) })}
					</p>
					{item.summary ? <p className="text-lg text-muted-foreground">{item.summary}</p> : null}
				</header>
				{item.image ? (
					<div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted">
						{/* The largest element on the page: load it first. */}
						<CloudImage
							image={item.image}
							variant="cover"
							loading="eager"
							fetchPriority="high"
							sizes="(min-width: 768px) 736px, 100vw"
							className="absolute inset-0 size-full object-cover"
						/>
					</div>
				) : null}
				<dl className="grid gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">{m.test_crud_public_price()}</dt>
						<dd className="font-medium text-base tabular-nums">{formatCurrency(item.price)}</dd>
					</div>
					{phone ? (
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">{m.test_crud_public_contact()}</dt>
							<dd>
								<a href={phone.getURI()} className="font-medium text-base underline-offset-4 hover:underline">
									{phone.formatInternational()}
								</a>
							</dd>
						</div>
					) : null}
					{item.tags.length > 0 ? (
						<div className="flex flex-col gap-1">
							<dt className="text-muted-foreground">{m.test_crud_public_tags()}</dt>
							<dd className="flex flex-wrap gap-1">
								{item.tags.map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
							</dd>
						</div>
					) : null}
				</dl>
				{item.body ? <RichTextContent html={item.body} className="max-w-none text-base" /> : null}
				{item.images.length > 1 ? (
					<section aria-labelledby="gallery-title" className="flex flex-col gap-3">
						<h2 id="gallery-title" className="font-semibold text-xl">
							{m.test_crud_public_gallery()}
						</h2>
						<ul className="grid gap-4 sm:grid-cols-2">
							{item.images.slice(1).map((image) => (
								<li key={image.id} className="relative aspect-[16/9] overflow-hidden rounded-lg border bg-muted">
									<CloudImage
										image={image}
										variant="cover"
										loading="lazy"
										sizes="(min-width: 768px) 360px, 100vw"
										className="absolute inset-0 size-full object-cover"
									/>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</article>
		</Page>
	);
}
