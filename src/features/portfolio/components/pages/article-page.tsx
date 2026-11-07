import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, notFound } from "@tanstack/react-router";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { cssVars } from "../../lib/css-vars";
import { postQueryOptions } from "../../queries";
import { DraftNotice } from "../chrome/draft-notice";
import { ArticleBody } from "../journal/article-body";
import { TextLink } from "../primitives/links";

const route = getRouteApi("/_site/journal/$slug");

/** /journal/$slug: an article in the reading type (`?preview=1` shows a draft to someone who may read it). */
export function ArticlePage() {
	const { slug } = route.useParams();
	const { preview } = route.useLoaderDeps();
	const { data } = useSuspenseQuery(postQueryOptions(slug, preview));
	// The loader already threw for a missing slug; this narrows the type.
	if (!data) throw notFound();
	const { post, next, draft } = data;
	const published = formatDate(isoDateInstant(post.publishedAt), { dateStyle: "long" });

	return (
		<article aria-labelledby="article-title" lang={post.lang}>
			{draft ? <DraftNotice /> : null}
			{/* Reading progress: a line of ink across the top, driven by the page's scroll (CSS only). */}
			<div aria-hidden className="hm-progress fixed inset-x-0 top-0 z-50 h-1 origin-left bg-hm-ink" />

			<header className="hm-container hm-grid gap-y-8 pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(2.5rem,5vw,4rem)]">
				<div className="col-span-4 flex flex-col gap-6 md:col-span-8">
					<h1 id="article-title" className="hm-display hm-reveal text-hm-head">
						{post.title}
					</h1>
					<p className="hm-reveal text-hm-lead" style={cssVars({ "--hm-i": 1 })}>
						{post.excerpt}
					</p>
				</div>
				{/* The article's facts beside its title, where the first screen would otherwise stand empty. */}
				<dl
					className="hm-reveal col-span-4 flex flex-col gap-4 text-hm-body md:col-span-3 md:col-start-10 md:pt-3"
					style={cssVars({ "--hm-i": 2 })}
				>
					<div>
						<dt className="hm-meta">{m.portfolio_journal_published()}</dt>
						<dd>
							<time dateTime={post.publishedAt}>{published}</time>
						</dd>
					</div>
					<div>
						<dt className="hm-meta">{m.portfolio_journal_length()}</dt>
						<dd>{m.portfolio_journal_reading_time({ minutes: formatNumber(post.readingMinutes) })}</dd>
					</div>
					{post.tags.length > 0 ? (
						<div>
							<dt className="hm-meta">{m.portfolio_journal_tags()}</dt>
							<dd>{post.tags.join(", ")}</dd>
						</div>
					) : null}
				</dl>
			</header>

			<div className="hm-container pb-[clamp(5rem,10vw,9rem)]">
				<ArticleBody html={post.body} className="hm-reveal-each" />
				<p className="mt-[clamp(3rem,6vw,5rem)] text-hm-lead">
					<TextLink to="/journal">{m.portfolio_journal_all()}</TextLink>
				</p>
			</div>

			<nav aria-label={m.portfolio_journal_next()} className="hm-field-ridge">
				<Link
					to="/journal/$slug"
					params={{ slug: next.slug }}
					className="hm-focus group block py-[clamp(4rem,8vw,7rem)]"
				>
					<div className="hm-container flex flex-col gap-4">
						<p className="text-hm-lead text-hm-muted">{m.portfolio_journal_next()}</p>
						<p className="hm-display text-hm-head decoration-[0.05em] decoration-hm-accent underline-offset-[0.12em] group-hover:underline">
							{next.title}
						</p>
					</div>
				</Link>
			</nav>
		</article>
	);
}
