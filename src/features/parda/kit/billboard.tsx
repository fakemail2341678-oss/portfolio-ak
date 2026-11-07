import { PauseIcon, PlayIcon } from "lucide-react";
import { type FocusEvent, type ReactNode, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CertBadge, RatingBadge } from "./badges";
import { formatYear } from "./cards";
import { preloadHero } from "./hero-preload";
import type { PardaImage } from "./image";

export type BillboardItem = {
	key: string;
	title: string;
	/** TMDB's tagline, often missing (and rarely in Nepali): then the picture carries no subtitle at all. */
	tagline: string;
	year: number | null;
	/** Minutes, for a movie. */
	runtime: number | null;
	/** For a series. */
	seasons?: number | null;
	certification: string | null;
	rating: number | null;
	backdrop: PardaImage | null;
	poster: PardaImage | null;
};

/**
 * How long a slide stays before the next, unless paused, held, or reduced motion is on;
 * shorter on phones, where a poster is taken in at a glance (decision 0249).
 */
const INTERVAL = 6000;
const PHONE_INTERVAL = 4000;

/** The title's box: the title's size and line height, two lines tall on phones and one from md. */
const TITLE_BOX = "flex h-[2lh] items-end text-pd-title leading-none md:h-[1lh] [&:lang(ne)]:leading-[1.2]";

/** The lower mask, under the picture at every width: the title, its facts and the actions. */
const LOWER =
	"flex flex-col gap-4 bg-pd-mask px-4 pt-4 pb-6 sm:px-6 md:flex-row md:items-end md:justify-between md:gap-8 lg:px-8";

/**
 * From lg the billboard is exactly the first screen under the top mask (3.75rem), whatever
 * the window's shape: the picture takes what the lower mask leaves (decision 0249).
 */
const FRAME = "relative flex flex-col bg-pd-mask lg:h-[calc(100svh_-_3.75rem)] lg:min-h-[32rem]";

/** Longer than this, a title takes two half-size lines from md, rather than one line that cuts it off. */
const LONG_TITLE = 22;

/**
 * The screen's shape (decision 0232): a poster between the masks on phones, 2.39:1 from `md`.
 * On a phone the poster is as tall as the height left over by the top mask, the lower mask
 * (two rows of actions, 15rem) and the tab bar, so Play is never under the tab bar on the
 * first screen; the masks close in at the sides instead (decision 0244). From lg the picture
 * fills what the frame leaves above the lower mask, cover-fit (0249).
 */
const SCREEN =
	"relative mx-auto aspect-[2/3] w-full overflow-hidden bg-pd-ground-2 max-md:max-w-[calc((100svh_-_22.5rem_-_env(safe-area-inset-bottom))*2/3)] md:aspect-[2.39/1] lg:aspect-auto lg:min-h-0 lg:flex-1";

function Picture({ item, priority, current }: { item: BillboardItem; priority: boolean; current: boolean }) {
	const narrow = item.poster ?? item.backdrop;
	const wide = item.backdrop ?? item.poster;
	if (priority) {
		// The first picture, in the shape each width shows (`md`, the screen's breakpoint).
		preloadHero(narrow, "(max-width: 767.98px)");
		preloadHero(wide, "(min-width: 768px)");
	}
	if (!narrow || !wide) {
		return (
			<div
				aria-hidden
				className={cn(
					"pd-move absolute inset-0 flex items-center justify-center bg-pd-mask p-8 text-center",
					current ? "opacity-100" : "opacity-0",
				)}
			>
				<span className="pd-display line-clamp-3 text-pd-muted text-pd-title">{item.title}</span>
			</div>
		);
	}
	return (
		<picture>
			<source media="(min-width: 768px)" srcSet={wide.srcSet} sizes="100vw" />
			<img
				src={narrow.src}
				srcSet={narrow.srcSet}
				sizes="100vw"
				alt=""
				width={narrow.width * 100}
				height={narrow.height * 100}
				loading={priority ? "eager" : "lazy"}
				decoding="async"
				{...(priority ? { fetchPriority: "high" as const } : {})}
				className={cn("pd-move absolute inset-0 size-full object-cover", current ? "opacity-100" : "opacity-0")}
			/>
		</picture>
	);
}

/**
 * The home's billboard (PLAN Task 61): one great picture between the masks, its
 * tagline as a subtitle over the scrim, and in the lower mask the title, its facts and
 * the actions; from lg it is exactly the first screen. It moves on every 6 s (4 s on
 * phones), and it stops (WCAG 2.2.2) when:
 * - the visible pause button is pressed (it stays paused until played again);
 * - a pointer rests on its lower mask, or focus is inside it (only while it is; 0250);
 * - the visitor prefers reduced motion (it never moves on its own, and the button is hidden);
 * - the tab is hidden.
 *
 * Only the current, previous and next pictures are in the page, so a slow connection
 * loads three, not all. The lower mask keeps one height whatever the title, so moving
 * on shifts nothing (CLS).
 */
export function Billboard({
	items,
	actions,
	className,
}: {
	items: ReadonlyArray<BillboardItem>;
	/** The slide's actions in the lower mask: Play, My list. */
	actions?: (item: BillboardItem) => ReactNode;
	className?: string;
}) {
	const id = useId();
	// The previous slide stays in the page while it fades out.
	const [{ index, previous }, setSlide] = useState<{ index: number; previous: number | null }>({
		index: 0,
		previous: null,
	});
	const [paused, setPaused] = useState(false);
	const [held, setHeld] = useState(false);
	const count = items.length;

	const show = (next: number) => {
		if (next !== index) setSlide({ index: next, previous: index });
	};

	useEffect(() => {
		if (count < 2 || paused || held) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const phone = window.matchMedia("(max-width: 767.98px)").matches;
		const timer = window.setInterval(
			() => {
				if (document.hidden) return;
				setSlide((slide) => ({ index: (slide.index + 1) % count, previous: slide.index }));
			},
			phone ? PHONE_INTERVAL : INTERVAL,
		);
		return () => window.clearInterval(timer);
	}, [count, paused, held]);

	const item = items[index];
	if (!item) return null;
	const mounted = new Set([index, previous, (index + 1) % count]);
	const length = item.runtime
		? m.pd_runtime_minutes({ minutes: formatNumber(item.runtime) })
		: item.seasons
			? item.seasons === 1
				? m.pd_season_one()
				: m.pd_seasons({ count: formatNumber(item.seasons) })
			: null;
	const moving = count > 1 && !paused && !held;

	const release = (event: FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
	};

	return (
		<section
			aria-roledescription={m.pd_billboard_role()}
			aria-label={m.pd_billboard_label()}
			className={cn(FRAME, className)}
			onFocus={() => setHeld(true)}
			onBlur={release}
			data-testid="billboard"
		>
			<div className={SCREEN}>
				{items.map((each, at) =>
					mounted.has(at) ? <Picture key={each.key} item={each} priority={at === 0} current={at === index} /> : null,
				)}
				{item.tagline ? (
					<p
						aria-hidden
						className="pd-scrim absolute inset-x-0 bottom-0 flex h-40 items-end justify-center px-6 pb-6 text-center"
					>
						<span className="line-clamp-2 max-w-3xl text-pd-sub text-pd-subtitle">{item.tagline}</span>
					</p>
				) : null}
			</div>
			{/*
			 * A pointer holds the slide only over the lower mask (title, actions, dots): from lg
			 * the picture is the whole first screen, so a resting cursor held it for good (0250).
			 */}
			<div
				className={LOWER}
				onPointerEnter={(event) => event.pointerType === "mouse" && setHeld(true)}
				onPointerLeave={() => setHeld(false)}
			>
				{/* The carousel pattern (WAI-ARIA APG): a slide is a group with a role description, not a fieldset. */}
				{/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form controls. */}
				<div
					id={`${id}-slide`}
					role="group"
					aria-roledescription={m.pd_billboard_slide()}
					aria-label={m.pd_billboard_position({ current: formatNumber(index + 1), total: formatNumber(count) })}
					aria-live={moving ? "off" : "polite"}
					className="flex min-w-0 flex-col gap-2"
				>
					{/*
					 * One box for every title, so the next slide moves nothing: two lines on phones,
					 * one from md, where a long title is set at half size in two lines instead.
					 */}
					<div className={TITLE_BOX}>
						<h2
							className={cn(
								"pd-display line-clamp-2 text-balance",
								item.title.length > LONG_TITLE ? "md:text-[0.5em]" : "md:line-clamp-1",
							)}
						>
							{item.title}
						</h2>
					</div>
					{item.tagline ? <p className="sr-only">{item.tagline}</p> : null}
					<p className="flex h-5 flex-wrap items-center gap-x-3 overflow-hidden text-pd-muted text-sm">
						{item.year ? <span>{formatYear(item.year)}</span> : null}
						{length ? <span>{length}</span> : null}
						<CertBadge certification={item.certification} />
						<RatingBadge rating={item.rating} className="text-pd-ink" />
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions?.(item)}
					{count > 1 ? (
						<div className="ms-auto flex items-center gap-1 md:ms-2">
							<Button
								variant="ghost"
								size="icon"
								className="motion-reduce:hidden"
								aria-label={paused ? m.pd_billboard_play() : m.pd_billboard_pause()}
								onClick={() => setPaused(!paused)}
								data-testid="billboard-pause"
							>
								{paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
							</Button>
							<ul className="flex items-center">
								{items.map((each, at) => (
									<li key={each.key}>
										<button
											type="button"
											aria-controls={`${id}-slide`}
											aria-current={at === index ? "true" : undefined}
											aria-label={m.pd_billboard_show({ current: formatNumber(at + 1), title: each.title })}
											onClick={() => show(at)}
											className="group flex size-6 items-center justify-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											<span className="block h-1 w-3 bg-pd-muted/50 group-hover:bg-pd-muted group-aria-[current=true]:w-5 group-aria-[current=true]:bg-pd-action" />
										</button>
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}

/** The billboard while it loads: the same screen and lower mask, so it hands over without a shift. */
export function BillboardSkeleton({ className }: { className?: string }) {
	return (
		<div aria-hidden className={cn(FRAME, className)} data-testid="billboard-skeleton">
			<Skeleton className={cn(SCREEN, "rounded-none")} />
			<div className={LOWER}>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className={TITLE_BOX}>
						<Skeleton className="h-[0.8lh] w-2/3" />
					</div>
					<Skeleton className="h-5 w-48" />
				</div>
				<Skeleton className="h-9 w-56" />
			</div>
		</div>
	);
}
