import { Link, type LinkOptions } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { PardaPage } from "../search";
import { PAGE_LABELS } from "./labels";
import { PARDA_PAGES } from "./search";

/**
 * Links that pick one of a few views, kept in the URL: the overview's range, and the page
 * a billboard or a layout belongs to. Works without JavaScript.
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

/** Which of Parda's pages (the home or a hub) a list or a layout shows. */
export function PageNav({
	label,
	current,
	link,
}: {
	label: string;
	current: PardaPage;
	link: (page: PardaPage) => LinkOptions;
}) {
	return (
		<SegmentNav
			label={label}
			items={PARDA_PAGES.map((page) => ({ value: page, label: PAGE_LABELS[page]() }))}
			current={current}
			link={link}
			testId="parda-page-nav"
		/>
	);
}
