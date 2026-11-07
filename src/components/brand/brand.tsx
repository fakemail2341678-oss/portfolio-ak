import { clientEnv } from "@/lib/env/client";
import { cn } from "@/lib/utils";

/**
 * The product mark: three contour rings in the accent colour, the shapes of the
 * contour art (./contour-art.tsx) at icon size. Decorative: the name next to it,
 * or the link around it, carries the meaning.
 */
export function BrandMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6 shrink-0 text-primary", className)}>
			<rect width="24" height="24" rx="6" className="fill-accent-subtle" />
			<path
				d="M12 4.6c4.4-.2 7.6 3 7.3 7.1-.3 4.3-3.6 7.3-7.6 7-3.9-.2-6.9-3.5-6.6-7.4.3-3.8 3.1-6.5 6.9-6.7Z"
				stroke="currentColor"
				strokeWidth="1.3"
				opacity=".45"
			/>
			<path
				d="M12.2 7.4c2.6-.1 4.6 1.9 4.4 4.4-.2 2.6-2.3 4.4-4.8 4.2-2.4-.2-4.1-2.1-3.9-4.5.2-2.3 2-4 4.3-4.1Z"
				stroke="currentColor"
				strokeWidth="1.3"
				opacity=".75"
			/>
			<path
				d="M12.3 10.1c1.1 0 1.9.9 1.8 1.9-.1 1.1-1 1.8-2 1.7-1-.1-1.7-.9-1.6-1.9.1-1 .8-1.7 1.8-1.7Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Mark plus the product name (VITE_APP_TITLE, the same in every locale). */
export function BrandName({ className }: { className?: string }) {
	return (
		<span className={cn("flex min-w-0 items-center gap-2 font-semibold text-heading", className)}>
			<BrandMark />
			<span className="truncate">{clientEnv.VITE_APP_TITLE}</span>
		</span>
	);
}
