import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * A wide table's horizontal scroll, made a focusable, named region so keyboard users
 * can scroll it too (axe's scrollable-region-focusable), as DataTable's own. `relative`:
 * sr-only text inside is absolutely positioned and would otherwise widen the page.
 */
export function ScrollRegion({
	children,
	className,
	label,
	"data-testid": testId,
}: {
	children: ReactNode;
	className?: string;
	/** Its accessible name; by default "Scrollable table". */
	label?: string;
	"data-testid"?: string;
}) {
	const region = { tabIndex: 0, role: "region", "aria-label": label ?? m.table_scroll_region() } as const;
	return (
		<div
			className={cn(
				"relative overflow-x-auto focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
			{...region}
			data-testid={testId}
		>
			{children}
		</div>
	);
}
