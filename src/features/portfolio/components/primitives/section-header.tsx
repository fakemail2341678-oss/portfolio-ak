import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";

type SectionHeadingProps = {
	id: string;
	title: ReactNode;
	/** One sentence under the heading, shown with it. */
	intro?: ReactNode;
	as?: "h1" | "h2";
	size?: "head" | "title";
	className?: string | undefined;
};

/** A section's heading: what the section is, in display type, and at most one sentence under it. */
export function SectionHeading({ id, title, intro, as: Tag = "h2", size = "head", className }: SectionHeadingProps) {
	return (
		<div className={cn("flex flex-col gap-5", className)}>
			<Tag id={id} className={cn("hm-display hm-reveal", size === "title" ? "text-hm-title" : "text-hm-head")}>
				{title}
			</Tag>
			{intro ? (
				<p className="hm-reveal hm-measure text-hm-lead text-hm-muted" style={cssVars({ "--hm-i": 1 })}>
					{intro}
				</p>
			) : null}
		</div>
	);
}
