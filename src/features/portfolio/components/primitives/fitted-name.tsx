import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";
import { fitEm, fitEmOfWords } from "../../lib/fit";

type FittedNameProps = {
	name: string;
	as?: "h1" | "p" | "span";
	id?: string | undefined;
	/** The words rise into place one after another on load (the hero). */
	animate?: boolean;
	className?: string | undefined;
};

/**
 * A name set as a monument: as wide as its container (which must be a size
 * container, `@container`), sized from the name's own length (lib/fit.ts) so
 * no script measures it and nothing shifts. On phones each word takes a line.
 */
export function FittedName({ name, as: Tag = "p", id, animate = false, className }: FittedNameProps) {
	const words = name.split(/\s+/).filter(Boolean);
	return (
		<Tag
			id={id}
			className={cn("hm-name", className)}
			style={cssVars({ "--hm-fit": fitEm(name), "--hm-fit-word": fitEmOfWords(name) })}
		>
			{words.map((word, position) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: a name may repeat a word; the order is the identity.
					key={position}
					className={cn(position < words.length - 1 && "md:me-[0.24em]", animate && "hm-name-in")}
					style={animate ? cssVars({ "--hm-i": position }) : undefined}
				>
					{word}
					{position < words.length - 1 ? <span className="sr-only"> </span> : null}
				</span>
			))}
		</Tag>
	);
}
