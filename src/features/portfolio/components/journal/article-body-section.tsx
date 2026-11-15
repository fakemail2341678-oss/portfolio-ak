import { RichTextContent } from "@/components/rich-text-content";
import type { SafeHtml } from "@/lib/safe-html";
import { cn } from "../../lib/cn";

/**
 * A journal article: rich-text HTML sanitized on the server (decision 0176),
 * at a reading measure, in the portfolio's reading type (`hm-prose`, styles/himal.css).
 */
export function ArticleBody({ html, className }: { html: SafeHtml; className?: string }) {
	return <RichTextContent html={html} unstyled className={cn("hm-measure hm-prose", className)} />;
}
