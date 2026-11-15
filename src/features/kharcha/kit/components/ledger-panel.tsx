import type { ReactNode } from "react";
import { formatDayMonth } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";

/**
 * A page of the book: ruled lines, each dated left of the red margin rule. A thread, a
 * day's spending and a balance's history are all pages; the cards sit on its lines. The
 * margin runs the page's whole height, and below the last line the page stays ruled
 * (`kh-ruled`), so an empty end of a page still reads as paper.
 */
export function LedgerPage({
	children,
	className,
	...props
}: { children: ReactNode; className?: string } & Omit<React.ComponentProps<"ol">, "children" | "className">) {
	return (
		<ol
			className={cn(
				"kh-ruled relative bg-kh-page",
				"before:pointer-events-none before:absolute before:inset-y-0 before:z-10 before:start-[var(--kh-margin-x)] before:[border-inline-start:1.5px_solid_var(--kh-margin)]",
				"[--kh-margin-x:3.75rem] sm:[--kh-margin-x:5.5rem]",
				className,
			)}
			{...props}
		>
			{children}
		</ol>
	);
}

/**
 * One line: its day in the margin ("14 Oct", "असोज २८"), what happened beside it, ruled
 * under it. A line is at least one line of the ruling tall and grows with its text.
 */
export function LedgerLine({
	day,
	selected = false,
	children,
	className,
}: {
	/** `YYYY-MM-DD`; empty for a line that continues the one above. */
	day?: string;
	selected?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<li
			className={cn(
				"relative grid min-h-[var(--kh-line)] grid-cols-[var(--kh-margin-x)_minmax(0,1fr)] items-center border-kh-rule border-b",
				selected ? "bg-kh-sel" : "bg-kh-page",
				className,
			)}
			aria-current={selected ? "true" : undefined}
		>
			<span
				className={cn(
					"kh-figures pe-2 text-end text-[0.75rem] text-kh-muted sm:pe-3",
					selected && "font-semibold text-kh-mark",
				)}
			>
				{day ? <time dateTime={day}>{formatDayMonth(day)}</time> : null}
			</span>
			<div className="min-w-0 py-1.5 ps-3 pe-4 sm:ps-4 sm:pe-6">{children}</div>
		</li>
	);
}

/** A line written by the app ("Asha changed the amount from … to …"): quieter, in italics (upright in Devanagari, which has none). */
export function SystemLine({ children }: { children: ReactNode }) {
	return <p className="text-caption text-kh-muted italic [&:lang(ne)]:not-italic">{children}</p>;
}
