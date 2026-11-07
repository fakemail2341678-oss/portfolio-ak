import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DescriptionItem = { label: string; value: ReactNode; testId?: string };

/**
 * Facts about one thing as label/value pairs (a `<dl>`): a record's details in a
 * detail page's aside, what an example measured. `columns` puts labels beside
 * their values from `sm` (stacked on phones, where long values need the width);
 * `stacked` always puts the label above.
 */
export function DescriptionList({
	items,
	layout = "columns",
	className,
}: {
	items: ReadonlyArray<DescriptionItem>;
	layout?: "columns" | "stacked";
	className?: string;
}) {
	return (
		<dl
			className={cn(
				"grid min-w-0 gap-x-6 text-body",
				layout === "columns" ? "gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2" : "gap-y-3",
				className,
			)}
		>
			{items.map((item) => (
				<div key={item.label} className={layout === "columns" ? "contents" : "flex min-w-0 flex-col gap-0.5"}>
					<dt className="text-muted-foreground">{item.label}</dt>
					<dd
						data-testid={item.testId}
						className={cn("min-w-0 wrap-break-word", layout === "columns" && "mb-2 sm:mb-0")}
					>
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
