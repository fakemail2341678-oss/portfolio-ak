import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pending-state placeholders. Routes render real content on the server, so these
 * only show during slow client-side navigations; they keep the page's footprint
 * so nothing jumps when the content arrives.
 */

/** Same shape as <PageHeader>: breadcrumb line, title, description and an optional extra row (search). */
export function PageHeaderSkeleton({
	size = "default",
	breadcrumbs = true,
	extra = false,
}: {
	size?: "default" | "display";
	breadcrumbs?: boolean;
	/** Reserve a row for a search form or filters under the title. */
	extra?: boolean;
}) {
	return (
		<div className="flex flex-col gap-4" aria-hidden>
			{breadcrumbs ? <div className="h-5 w-40 animate-pulse rounded bg-muted" /> : null}
			<div className="flex flex-col gap-1.5">
				<div className={cn("w-48 animate-pulse rounded-md bg-muted", size === "display" ? "h-10" : "h-8")} />
				<div className="h-5 w-full max-w-xl animate-pulse rounded bg-muted" />
			</div>
			{extra ? <div className="h-9 w-full max-w-lg animate-pulse rounded-md bg-muted" /> : null}
		</div>
	);
}

/** `count` copies of `item` in the list's own grid classes. */
export function ListSkeleton({ count, item, className }: { count: number; item: ReactNode; className?: string }) {
	return (
		<ul className={cn("grid gap-6", className)} aria-hidden>
			{Array.from({ length: count }, (_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list; items have no identity.
				<li key={index} className="flex">
					{item}
				</li>
			))}
		</ul>
	);
}
