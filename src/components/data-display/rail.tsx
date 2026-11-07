import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * A horizontal rail of items (posters, cards): a named region whose list scrolls with
 * CSS scroll-snap, so a swipe, a trackpad, the keyboard (each item is a link, and
 * focus scrolls it into view) and no JavaScript at all work. Previous and next buttons
 * show for fine pointers; they scroll by a page and only need JavaScript when pressed.
 * Nothing is measured before the visitor touches the rail.
 *
 *   <Rail title="Trending">{items.map((item) => <RailItem key={item.id} className="w-36">…</RailItem>)}</Rail>
 */
export function Rail({
	title,
	titleClassName,
	action,
	children,
	inset = "px-4 sm:px-6 lg:px-8",
	className,
	"data-testid": testId,
}: {
	title: string;
	/** The heading's look; it's an <h2>. */
	titleClassName?: string;
	/** Beside the heading: a "See all" link. */
	action?: ReactNode;
	/** <RailItem>s. */
	children: ReactNode;
	/** Padding at the edges, for the heading and the list's first and last item (and where they snap). */
	inset?: string;
	className?: string;
	"data-testid"?: string;
}) {
	const id = useId();
	const list = useRef<HTMLUListElement>(null);
	// Until the rail is touched, assume it starts at the beginning and runs past the edge.
	const [edges, setEdges] = useState({ start: true, end: false });

	const measure = () => {
		const node = list.current;
		if (!node) return;
		// scrollLeft is negative in right-to-left layouts.
		const offset = Math.abs(node.scrollLeft);
		const next = { start: offset <= 1, end: offset + node.clientWidth >= node.scrollWidth - 1 };
		if (next.start !== edges.start || next.end !== edges.end) setEdges(next);
	};

	const page = (direction: 1 | -1) => {
		const node = list.current;
		if (!node) return;
		const rtl = getComputedStyle(node).direction === "rtl";
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		node.scrollBy({ left: direction * (rtl ? -1 : 1) * node.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
	};

	return (
		<section
			aria-labelledby={`${id}-title`}
			className={cn("flex flex-col gap-3", className)}
			onPointerEnter={measure}
			data-testid={testId}
		>
			{/* At least the buttons' height, which only fine pointers get: as tall as RailSkeleton's heading everywhere. */}
			<div className={cn("flex min-h-8 items-end justify-between gap-4", inset)}>
				<h2 id={`${id}-title`} className={cn("font-semibold text-heading", titleClassName)}>
					{title}
				</h2>
				<div className="flex items-center gap-2">
					{action}
					<div className="hidden gap-1 pointer-fine:flex">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-controls={`${id}-list`}
							aria-label={m.rail_previous({ title })}
							disabled={edges.start}
							onClick={() => page(-1)}
						>
							<ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-controls={`${id}-list`}
							aria-label={m.rail_next({ title })}
							disabled={edges.end}
							onClick={() => page(1)}
						>
							<ChevronRightIcon aria-hidden className="rtl:rotate-180" />
						</Button>
					</div>
				</div>
			</div>
			<ul
				ref={list}
				id={`${id}-list`}
				onScroll={measure}
				className={cn(
					// relative: sr-only text inside is absolutely positioned and would otherwise widen the page.
					"relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden",
					inset,
					// Snap to the inset, not the viewport's edge.
					"scroll-px-4 sm:scroll-px-6 lg:scroll-px-8",
				)}
			>
				{children}
			</ul>
		</section>
	);
}

/**
 * A rail still loading, the same height as the rail it stands for (CLS 0): a heading
 * bar and `count` copies of an item's skeleton, each in a box of `itemClassName`.
 */
export function RailSkeleton({
	count = 6,
	item,
	itemClassName,
	inset = "px-4 sm:px-6 lg:px-8",
	className,
}: {
	count?: number;
	item: ReactNode;
	itemClassName: string;
	inset?: string;
	className?: string;
}) {
	return (
		<div aria-hidden className={cn("flex flex-col gap-3", className)} data-testid="rail-skeleton">
			<div className={cn("flex h-8 items-end", inset)}>
				<Skeleton className="h-6 w-40" />
			</div>
			<div className={cn("flex gap-3 overflow-hidden pb-1 sm:gap-4", inset)}>
				{Array.from({ length: count }, (_, index) => (
					// Identical placeholders: their position is their identity.
					// biome-ignore lint/suspicious/noArrayIndexKey: nothing reorders them.
					<div key={index} className={cn("shrink-0", itemClassName)}>
						{item}
					</div>
				))}
			</div>
		</div>
	);
}

/** One item of a rail: it snaps to the rail's start and never shrinks. Give it a width. */
export function RailItem({ children, className }: { children: ReactNode; className?: string }) {
	return <li className={cn("shrink-0 snap-start", className)}>{children}</li>;
}
