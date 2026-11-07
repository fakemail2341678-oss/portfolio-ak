import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";

/**
 * The public page of a project or post with `?preview=1`, in a new tab: a draft
 * shows there to holders of portfolio:read only, and the page is noindex
 * (decision 0176).
 */
export function PreviewLink({
	kind,
	slug,
	children,
	className,
}: {
	kind: "work" | "journal";
	slug: string;
	children: ReactNode;
	className?: string;
}) {
	const content = (
		<>
			{children}
			<ExternalLinkIcon aria-hidden className="size-3.5" />
			<span className="sr-only">{m.common_opens_new_tab()}</span>
		</>
	);
	return kind === "work" ? (
		<Link to="/work/$slug" params={{ slug }} search={{ preview: 1 }} target="_blank" className={className}>
			{content}
		</Link>
	) : (
		<Link to="/journal/$slug" params={{ slug }} search={{ preview: 1 }} target="_blank" className={className}>
			{content}
		</Link>
	);
}
