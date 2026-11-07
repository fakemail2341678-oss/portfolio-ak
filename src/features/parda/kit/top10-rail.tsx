import { Link } from "@tanstack/react-router";
import { Rail, RailItem, RailSkeleton } from "@/components/data-display/rail";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { formatYear, type PardaLink, type PosterCardItem } from "./cards";
import { TmdbImage } from "./tmdb-image";

const ITEM = "w-36 sm:w-44 lg:w-48";

/**
 * Today's Top 10 (PLAN Task 62): posters in order, each with its rank in wide display
 * type in the lower mask under it, beside the title. The rank sits below the picture,
 * never over it or beside it, like every caption in Masking.
 */
export function Top10Rail({
	title,
	items,
	className,
}: {
	title: string;
	/** At most ten, in rank order. */
	items: ReadonlyArray<{ key: string; item: PosterCardItem; link: PardaLink }>;
	className?: string;
}) {
	return (
		<Rail
			title={title}
			titleClassName="pd-display text-pd-head font-bold"
			className={className}
			data-testid="top10-rail"
		>
			{items.slice(0, 10).map(({ key, item, link }, index) => (
				<RailItem key={key} className={ITEM}>
					<Link
						{...link}
						className="group pd-press block outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground"
					>
						<TmdbImage
							image={item.poster}
							alt=""
							label={item.title}
							aspect="poster"
							sizes="(min-width: 1024px) 12rem, (min-width: 640px) 11rem, 9rem"
						/>
						<span className="flex h-20 items-start gap-3 bg-pd-mask px-3 py-2.5">
							<span aria-hidden className="pd-display text-[2.5rem] text-pd-ink tabular-nums leading-none">
								{formatNumber(index + 1)}
							</span>
							<span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
								<span className="sr-only">{m.pd_top10_rank({ rank: formatNumber(index + 1) })}</span>
								<span className="line-clamp-2 font-medium text-sm leading-snug group-hover:underline group-hover:underline-offset-4">
									{item.title}
								</span>
								<span className="text-pd-muted text-xs">{formatYear(item.year)}</span>
							</span>
						</span>
					</Link>
				</RailItem>
			))}
		</Rail>
	);
}

export function Top10RailSkeleton({ className }: { className?: string }) {
	return (
		<RailSkeleton
			count={10}
			itemClassName={ITEM}
			className={className}
			item={
				<>
					<Skeleton className="aspect-[2/3] w-full" />
					<div className="h-20 bg-pd-mask" />
				</>
			}
		/>
	);
}
