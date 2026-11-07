import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";

/**
 * One number with its label: the dashboard's building block. `delta` is a change
 * over a period ("+4 this week"), green when it grows, red when it shrinks; `hint` is
 * a line of context under the value; `trend` draws the recent values as a sparkline
 * (decorative: say the trend in `delta` or `hint`). With `to`, the whole card is
 * one link to the section it counts. `format` prints the value (an amount of money) when a
 * plain number won't do.
 */
export function StatCard({
	label,
	value,
	icon: Icon,
	delta,
	hint,
	trend,
	to,
	format = (number) => formatNumber(number),
	className,
}: {
	label: string;
	value: number;
	icon?: LucideIcon;
	delta?: { value: number; label: string };
	hint?: ReactNode;
	/** Recent values, oldest first (at least two). */
	trend?: ReadonlyArray<number>;
	to?: LinkProps["to"];
	format?: (value: number) => string;
	className?: string;
}) {
	const tone = !delta || delta.value === 0 ? "text-muted-foreground" : delta.value > 0 ? "text-success" : "text-danger";
	return (
		<div
			className={cn(
				"relative flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs transition-colors",
				to && "focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-ring/40",
				className,
			)}
			data-figures
		>
			<div className="flex items-center justify-between gap-2 text-muted-foreground">
				<h3 className="font-medium text-body">
					{to ? (
						// Stretched over the card: the whole card is clickable, one link for screen readers.
						<Link to={to} className="outline-none after:absolute after:inset-0">
							{label}
						</Link>
					) : (
						label
					)}
				</h3>
				{Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
			</div>
			<p className="font-semibold text-display">{format(value)}</p>
			{delta || hint ? (
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption">
					{delta ? (
						<span className={cn("font-medium", tone)}>
							{formatNumber(delta.value, { signDisplay: "exceptZero" })} {delta.label}
						</span>
					) : null}
					{hint ? <span className="text-muted-foreground">{hint}</span> : null}
				</div>
			) : null}
			{trend ? (
				<Sparkline
					values={trend}
					tone={!delta || delta.value === 0 ? "muted" : delta.value > 0 ? "success" : "danger"}
				/>
			) : null}
		</div>
	);
}
