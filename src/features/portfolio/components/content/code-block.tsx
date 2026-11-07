import { cn } from "../../lib/cn";

type CodeBlockProps = {
	code: string;
	language: string;
	caption?: string | undefined;
	className?: string | undefined;
};

/**
 * A code sample as a figure, on the night field. Plain text (no highlighter
 * shipped to the browser); long lines scroll inside the block, never the page,
 * and the scrolling region is focusable for keyboard users.
 */
export function CodeBlock({ code, language, caption, className }: CodeBlockProps) {
	return (
		<figure className={cn("hm-field-night", className)}>
			<p className="px-5 pt-4 text-hm-muted text-hm-small">{language}</p>
			{/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable so keyboard users can scroll it (axe scrollable-region-focusable). */}
			<pre tabIndex={0} className="hm-focus overflow-x-auto px-5 pt-3 pb-5 font-hm-mono text-hm-small leading-relaxed">
				<code>{code}</code>
			</pre>
			{caption ? <figcaption className="bg-hm-ground-2 px-5 py-3 text-hm-small">{caption}</figcaption> : null}
		</figure>
	);
}
