import { m } from "@/paraglide/messages";
import type { PostSummary } from "../../types";
import { PostLine } from "../journal/post-line";
import { TextLink } from "../primitives/links";
import { SectionHeading } from "../primitives/section-heading";

/** The latest writing, as a line-up. */
export function JournalSection({ posts }: { posts: ReadonlyArray<PostSummary> }) {
	if (posts.length === 0) return null;
	return (
		<section id="journal" aria-labelledby="journal-title" className="hm-section">
			<div className="hm-container flex flex-col gap-[clamp(2.5rem,5vw,4rem)]">
				<SectionHeading id="journal-title" title={m.portfolio_journal_heading()} />
				<ul className="flex flex-col">
					{posts.map((post) => (
						<PostLine key={post.slug} post={post} />
					))}
				</ul>
				<p className="text-hm-lead">
					<TextLink to="/journal">{m.portfolio_journal_all()}</TextLink>
				</p>
			</div>
		</section>
	);
}
