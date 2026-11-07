import { useId } from "react";
import { cn } from "@/lib/utils";
import { CHAAL_NAME, CHAAL_NAME_NE } from "../brand";

/**
 * Chaal's mark: four squares of a diagram in its heavy frame, the dark two hatched in ink
 * (decision 0259), in the board's own ink, which stays dark in both themes, as the diagram does.
 * The same drawing as `public/chaal/icon.svg`. Decorative: the name beside
 * it, or the link around it, says what it is.
 */
export function ChaalMark({ className }: { className?: string }) {
	const hatch = useId();
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
			<defs>
				<pattern id={hatch} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
					<rect width="0.9" height="2.4" className="fill-ch-frame" />
				</pattern>
			</defs>
			<rect x="1" y="1" width="22" height="22" className="fill-ch-paper stroke-ch-frame" strokeWidth="2" />
			<rect x="12" y="2" width="10" height="10" fill={`url(#${hatch})`} />
			<rect x="2" y="12" width="10" height="10" fill={`url(#${hatch})`} />
		</svg>
	);
}

/** The top bar's wordmark: the mark, the name, and चाल beside it, in display type. */
export function ChaalWordmark({ className }: { className?: string }) {
	return (
		<span className={cn("flex items-center gap-2.5", className)}>
			<ChaalMark />
			{/* A brand: Latin in both languages, with the Devanagari as its second half. */}
			<span lang="en" className="ch-display text-[1.375rem] tracking-tight">
				{CHAAL_NAME}
			</span>
			<span lang="ne" className="ch-display text-[1.375rem] text-ch-muted">
				{CHAAL_NAME_NE}
			</span>
		</span>
	);
}
