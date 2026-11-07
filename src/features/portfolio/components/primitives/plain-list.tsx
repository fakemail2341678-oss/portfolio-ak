import { cn } from "../../lib/cn";

/**
 * A short list set as running text (a stack, tags, outputs): items side by side
 * with space between them, no boxes. Still a list, so screen readers count it.
 */
export function PlainList({
	items,
	label,
	className,
}: {
	items: ReadonlyArray<string>;
	label?: string | undefined;
	className?: string | undefined;
}) {
	return (
		<ul aria-label={label} className={cn("flex flex-wrap gap-x-5 gap-y-1.5", className)}>
			{items.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}
