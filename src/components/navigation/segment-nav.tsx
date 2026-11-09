import { Link, type LinkOptions } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Links that pick one of a few views, kept in the URL (a range, a page): a segmented control
 * that works without JavaScript. Parda's overview and pages, Chaal's health (Task 79).
 */
export function SegmentNav<T extends string>({
	label,
	items,
	current,
	link,
	testId,
}: {
	label: string;
	items: ReadonlyArray<{ value: T; label: string }>;
	current: T;
	link: (value: T) => LinkOptions;
	testId: string;
}) {
	return (
		<nav aria-label={label} className="flex w-fit max-w-full flex-wrap rounded-md border p-0.5" data-testid={testId}>
			{items.map((item) => (
				<Link
					key={item.value}
					{...link(item.value)}
					resetScroll={false}
					aria-current={item.value === current ? "page" : undefined}
					className={cn(
						"rounded-sm px-3 py-1 text-caption outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
						item.value === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
					)}
					data-testid={`${testId}-${item.value}`}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}
