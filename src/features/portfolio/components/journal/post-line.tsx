import { Link } from "@tanstack/react-router";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import type { PostSummary } from "../../types";

type PostLineProps = {
	post: PostSummary;
	headingLevel?: "h2" | "h3";
	/** Show the excerpt under the title (the journal page; the home page lists titles only). */
	withExcerpt?: boolean;
};

/**
 * One article in a line-up: title, date and reading time at one size, in
 * columns that line up down the list; the whole line is the link. On phones
 * the date and time drop under the title.
 */
export function PostLine({ post, headingLevel = "h3", withExcerpt = false }: PostLineProps) {
	const Heading = headingLevel;
	return (
		<li lang={post.lang} className="hm-reveal">
			<Link
				to="/journal/$slug"
				params={{ slug: post.slug }}
				className="hm-focus group grid grid-cols-1 gap-y-1.5 py-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-baseline md:gap-x-8"
			>
				<Heading className="font-hm-display font-semibold text-hm-lead decoration-2 decoration-hm-accent underline-offset-[0.2em] group-hover:underline">
					{post.title}
				</Heading>
				<time
					dateTime={post.publishedAt}
					className="whitespace-nowrap text-hm-body text-hm-muted tabular-nums md:text-hm-lead"
				>
					{formatDate(isoDateInstant(post.publishedAt), { dateStyle: "medium" })}
				</time>
				<span className="whitespace-nowrap text-hm-body text-hm-muted md:min-w-[7.5rem] md:text-right md:text-hm-lead">
					{m.portfolio_journal_reading_time({ minutes: formatNumber(post.readingMinutes) })}
				</span>
				{withExcerpt ? <p className="hm-measure pt-1 text-hm-body md:col-span-3">{post.excerpt}</p> : null}
			</Link>
		</li>
	);
}
