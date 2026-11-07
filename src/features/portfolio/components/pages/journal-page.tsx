import { useSuspenseQuery } from "@tanstack/react-query";
import { m } from "@/paraglide/messages";
import { journalQueryOptions } from "../../queries";
import { PostLine } from "../journal/post-line";
import { SectionHeading } from "../primitives/section-heading";

/** /journal: every published article, newest first, as a line-up with excerpts. */
export function JournalPage() {
	const { data: posts } = useSuspenseQuery(journalQueryOptions());
	return (
		<div className="hm-container flex flex-col gap-[clamp(3rem,6vw,5rem)] pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(5rem,10vw,9rem)]">
			<SectionHeading
				as="h1"
				size="title"
				id="journal-title"
				title={m.portfolio_journal_heading()}
				intro={m.portfolio_journal_description()}
			/>
			<ul className="flex flex-col gap-4">
				{posts.map((post) => (
					<PostLine key={post.slug} post={post} headingLevel="h2" withExcerpt />
				))}
			</ul>
		</div>
	);
}
