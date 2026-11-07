import { cn } from "@/lib/utils";
import { PARDA_NAME } from "../brand";

/**
 * Parda's mark: a lit screen between two masks, at 2.4:1. The same drawing as
 * `public/parda/icon.svg`. Square, like everything in "Masking" (decision 0232).
 * Decorative: the name beside it, or the link around it, says what it is.
 */
export function PardaMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
			<rect width="24" height="24" className="fill-pd-ink dark:fill-pd-mask" />
			<rect x="3" y="7.25" width="18" height="7.5" className="fill-pd-subtitle" />
		</svg>
	);
}

/** The mark and the name, in wide display type: the wordmark of the top mask. */
export function PardaWordmark({ className }: { className?: string }) {
	return (
		<span className={cn("flex items-center gap-2.5", className)}>
			<PardaMark className="dark:outline dark:outline-white/15" />
			{/* The name is Latin in both languages: a brand (PARDA_NAME). */}
			<span lang="en" className="pd-display text-[1.375rem] leading-none tracking-tight">
				{PARDA_NAME}
			</span>
		</span>
	);
}
