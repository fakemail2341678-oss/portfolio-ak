import type { SafeHtml } from "@/lib/safe-html";
import { cn } from "@/lib/utils";

/** Typography for editor output; shared by the editor surface and the read-only view so they look the same. */
export const richTextClass = cn(
	"text-sm leading-relaxed [&_*+*]:mt-2",
	"[&_h2]:font-semibold [&_h2]:text-lg [&_h3]:font-semibold [&_h3]:text-base",
	"[&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_li_p]:mt-0",
	"[&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground",
	"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
	"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono",
	"[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
	"[&_hr]:my-4 [&_hr]:border-border",
	// A mention (Taskline's comments): a member's name, set apart.
	"[&_.mention]:rounded [&_.mention]:bg-accent [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-accent-foreground",
);

/**
 * Renders sanitized rich text. The prop only accepts SafeHtml, which only
 * sanitizeRichText() on the server can produce, so this is the single
 * innerHTML sink in the app and it never receives raw input.
 */
export function RichTextContent({
	html,
	className,
	unstyled = false,
}: {
	html: SafeHtml;
	className?: string;
	/** Leave out the default typography (a section with its own, e.g. the portfolio's `pf-prose`). */
	unstyled?: boolean;
}) {
	return (
		<div
			className={unstyled ? className : cn(richTextClass, className)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: html is SafeHtml, produced only by the server-side sanitizer (src/server/rich-text/sanitize.ts).
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
