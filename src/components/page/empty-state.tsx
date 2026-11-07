import { type LucideIcon, SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * What a list shows when it has nothing to show, in one of two situations:
 * - `empty` (default): nothing exists yet. Say what will appear here and offer to
 *   create the first one (`primaryAction`), maybe with a way to learn more (`secondaryAction`).
 * - `no-matches`: things exist, but the filters hide them all. Offer to clear the
 *   filters; it shows a "no results" icon unless you pass another.
 */
export function EmptyState({
	variant = "empty",
	icon,
	title,
	description,
	primaryAction,
	secondaryAction,
	className,
	...props
}: {
	variant?: "empty" | "no-matches";
	icon?: LucideIcon;
	title?: ReactNode;
	description: ReactNode;
	/** The next useful step: "Create the first item", "Clear filters". */
	primaryAction?: ReactNode;
	/** A quieter alternative: "Import a CSV", "Read the guide". */
	secondaryAction?: ReactNode;
	className?: string;
	"data-testid"?: string;
}) {
	const Icon = icon ?? (variant === "no-matches" ? SearchXIcon : undefined);
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 text-center",
				variant === "empty" ? "py-12" : "py-8",
				className,
			)}
			data-variant={variant}
			{...props}
		>
			{Icon ? (
				<div className="flex size-10 items-center justify-center rounded-lg bg-surface-1 text-muted-foreground">
					<Icon className="size-5" aria-hidden />
				</div>
			) : null}
			<div className="flex max-w-md flex-col gap-1">
				{title ? <p className="text-heading">{title}</p> : null}
				<p className="text-body text-muted-foreground">{description}</p>
			</div>
			{primaryAction || secondaryAction ? (
				<div className="mt-1 flex flex-wrap justify-center gap-2">
					{primaryAction}
					{secondaryAction}
				</div>
			) : null}
		</div>
	);
}
