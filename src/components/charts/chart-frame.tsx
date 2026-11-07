import { ClientOnly } from "@tanstack/react-router";
import { type ReactNode, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import type { ChartProps } from "./types";

const ASPECTS = {
	/** Area and bar charts: wide on desktops, a little taller on phones. */
	wide: "aspect-[2/1] sm:aspect-[5/2]",
	/** Donuts. */
	square: "mx-auto aspect-square w-full max-w-64",
} as const;

/**
 * The box every chart renders in. Its size comes from a fixed aspect ratio, never
 * from the chart, so the server renders a skeleton of exactly the chart's size and
 * nothing moves when Recharts (loaded on demand, in the browser only) draws into it.
 *
 * The drawing is hidden from screen readers; they get the same numbers as a table
 * (visually hidden, server-rendered), captioned by `label`.
 */
export function ChartFrame({
	label,
	data,
	index,
	series,
	format = (value) => formatNumber(value),
	aspect,
	className,
	children,
}: ChartProps & { aspect: keyof typeof ASPECTS; children: ReactNode }) {
	const skeleton = <Skeleton className="size-full" />;
	return (
		<figure className={cn("relative min-w-0", className)} data-chart-frame>
			<div className={cn("w-full", ASPECTS[aspect])} aria-hidden>
				<ClientOnly fallback={skeleton}>
					<Suspense fallback={skeleton}>{children}</Suspense>
				</ClientOnly>
			</div>
			{/* The wrapper clips: a table can't be narrower than its content, and sr-only text doesn't wrap. */}
			<div className="sr-only">
				<table>
					<caption>{label}</caption>
					<thead>
						<tr>
							<td />
							{series.map((each) => (
								<th key={each.key} scope="col">
									{each.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.map((row) => (
							<tr key={String(row[index])}>
								<th scope="row">{row[index]}</th>
								{series.map((each) => {
									const value = row[each.key];
									return (
										<td key={each.key}>{typeof value === "number" ? format(value) : value === null ? "–" : value}</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</figure>
	);
}
