import { StarIcon } from "lucide-react";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * TMDB's audience score (0–10), one decimal, in the page's numerals. A score from no
 * votes means nothing, so 0 renders nothing.
 */
export function RatingBadge({ rating, className }: { rating: number | null; className?: string }) {
	if (!rating) return null;
	const value = formatNumber(rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
	return (
		<span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
			<StarIcon aria-hidden className="size-3.5 fill-current text-pd-ink" />
			<span aria-hidden>{value}</span>
			<span className="sr-only">{m.pd_rating({ value })}</span>
		</span>
	);
}

/** A certificate as the region issues it ("PG-13", "TV-MA", "U/A 13+"): ruled, not filled, so it reads as a label and not a button. */
export function CertBadge({ certification, className }: { certification: string | null; className?: string }) {
	if (!certification) return null;
	return (
		<span
			className={cn(
				"inline-flex h-5 items-center border border-current px-1.5 font-medium text-[0.6875rem] uppercase leading-none tracking-wide",
				className,
			)}
		>
			<span className="sr-only">{m.pd_certificate()} </span>
			{certification}
		</span>
	);
}

/**
 * How much of a title has been watched: subtitle yellow on its dark track, the same
 * in both themes (decision 0232), flush under a picture.
 */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
	const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			aria-label={m.pd_progress({ percent: formatNumber(percent) })}
			className={cn("h-1 w-full bg-pd-track", className)}
		>
			<div className="h-full bg-pd-progress" style={{ width: `${percent}%` }} />
		</div>
	);
}
