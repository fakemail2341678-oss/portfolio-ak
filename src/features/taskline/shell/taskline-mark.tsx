import { cn } from "@/lib/utils";
import { TASKLINE_NAME } from "../brand";

/**
 * Taskline's mark: three staggered bars on the accent tile, a row of tasks laid out
 * in time. The same drawing as `public/taskline/icon.svg` (which has the colours
 * baked in). Decorative: the name next to it, or the link around it, says what it is.
 */
export function TasklineMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
			<rect width="24" height="24" rx="6" className="fill-primary" />
			<g className="stroke-primary-foreground" strokeWidth="2.2" strokeLinecap="round">
				<path d="M5.5 8h7" />
				<path d="M8.5 12h8" opacity=".85" />
				<path d="M12 16h6.5" opacity=".7" />
			</g>
		</svg>
	);
}

/** The mark and the name: the wordmark of every Taskline header. */
export function TasklineWordmark({ className }: { className?: string }) {
	return (
		<span className={cn("flex min-w-0 items-center gap-2 font-semibold text-heading", className)}>
			<TasklineMark />
			<span className="truncate tracking-tight">{TASKLINE_NAME}</span>
		</span>
	);
}
