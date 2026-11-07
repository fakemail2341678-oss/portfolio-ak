import { useSuspenseQuery } from "@tanstack/react-query";
import { CatchBoundary, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { Rail, RailItem, RailSkeleton } from "@/components/data-display/rail";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { GENRE_LABELS } from "../genres";
import { PosterCard, type PosterCardItem, PosterCardSkeleton } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { Top10Rail, Top10RailSkeleton } from "../kit/top10-rail";
import { CardListToggle } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { pardaRailQueryOptions } from "../queries";
import type { PardaPage } from "../search";
import { railLabel } from "./rail-labels";
import type { HubRailHead, HubRailTitles, HubTitle } from "./types";

/** A poster rail's item, and the widths its pictures are chosen for. */
export const POSTER_ITEM = "w-36 sm:w-40 lg:w-44";
export const POSTER_SIZES = "(min-width: 1024px) 11rem, (min-width: 640px) 10rem, 9rem";
/** Rail headings in display type; the Top 10 sets its own the same way. */
export const HEADING = "pd-display text-pd-head font-bold";

/** A title as the kit's poster shows it: pictures from TMDB's paths, genre names from our messages. */
export function toPosterItem(title: HubTitle, imageBase: string): PosterCardItem {
	return {
		title: title.title,
		year: title.year,
		poster: tmdbImage(imageBase, title.poster, "poster"),
		backdrop: tmdbImage(imageBase, title.backdrop, "backdrop"),
		overview: title.overview,
		genres: title.genres.flatMap((genre) => {
			const label = GENRE_LABELS[genre];
			return label ? [label()] : [];
		}),
		rating: title.rating,
	};
}

/** A rail Discover can show in full links there (Task 66); a curated collection links to its page (Task 69). */
function SeeAll({ head, title }: { head: HubRailHead; title: string }) {
	if (!head.more && !head.collection) return null;
	return (
		<Link
			{...(head.collection ? pardaLinks.curated(head.collection) : pardaLinks.discover(head.more))}
			className="text-pd-muted text-sm underline-offset-4 outline-none hover:text-pd-ink hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
			data-testid="rail-see-all"
		>
			{m.pd_rail_see_all()}
			<span className="sr-only">: {title}</span>
		</Link>
	);
}

const titleKey = (title: HubTitle) => `${title.media}:${title.id}`;

/** A rail TMDB couldn't answer: its heading and one line, in the space its posters would take (CLS). */
function RailUnavailable({ title }: { title: string }) {
	return (
		<section className="flex flex-col gap-3" data-testid="rail-unavailable">
			<div className="flex min-h-8 items-end px-4 sm:px-6 lg:px-8">
				<h2 className={HEADING}>{title}</h2>
			</div>
			<div className="relative px-4 pb-1 sm:px-6 lg:px-8">
				{/* Holds a poster's height, so the page below doesn't move. */}
				<PosterCardSkeleton className={`${POSTER_ITEM} invisible`} />
				<p className="absolute inset-0 flex items-center px-4 text-pd-muted text-sm sm:px-6 lg:px-8">
					{m.pd_rail_unavailable()}
				</p>
			</div>
		</section>
	);
}

/** One rail of titles: the Top 10, or posters. Nothing when the list is empty (a takedown, a quiet day). */
export function TitleRail({
	head,
	titles,
	imageBase,
}: {
	head: HubRailHead;
	titles: HubRailTitles;
	imageBase: string;
}) {
	const title = railLabel(head.label);
	if (titles === null) return <RailUnavailable title={title} />;
	if (titles.length === 0) return null;
	if (head.kind === "top10") {
		return (
			<Top10Rail
				title={title}
				items={titles.slice(0, 10).map((each) => ({
					key: titleKey(each),
					item: toPosterItem(each, imageBase),
					link: pardaLinks.title(each.media, each.id, each.slug),
				}))}
			/>
		);
	}
	return (
		<Rail title={title} titleClassName={HEADING} action={<SeeAll head={head} title={title} />} data-testid="title-rail">
			{titles.map((each) => (
				<RailItem key={titleKey(each)} className={POSTER_ITEM}>
					<PosterCard
						item={toPosterItem(each, imageBase)}
						link={pardaLinks.title(each.media, each.id, each.slug)}
						sizes={POSTER_SIZES}
						action={<CardListToggle title={{ media: each.media, id: each.id, title: each.title }} />}
					/>
				</RailItem>
			))}
		</Rail>
	);
}

export function TitleRailSkeleton({ kind }: { kind: HubRailHead["kind"] }) {
	if (kind === "top10") return <Top10RailSkeleton />;
	return <RailSkeleton count={8} itemClassName={POSTER_ITEM} item={<PosterCardSkeleton />} />;
}

function LoadedRail({ page, head }: { page: PardaPage; head: HubRailHead }) {
	const { data } = useSuspenseQuery(pardaRailQueryOptions(getLocale(), page, head.id));
	return <TitleRail head={head} titles={data.titles} imageBase={data.imageBase} />;
}

/**
 * A rail after the first ones: the loader started its request without waiting, the
 * server sends the page with this skeleton, and the rail streams into the same response
 * (PLAN Task 62). A failure in the browser stays inside the rail.
 */
export function StreamedRail({ page, head }: { page: PardaPage; head: HubRailHead }) {
	return (
		<CatchBoundary
			getResetKey={() => `${page}:${head.id}`}
			errorComponent={() => <RailUnavailable title={railLabel(head.label)} />}
		>
			<Suspense fallback={<TitleRailSkeleton kind={head.kind} />}>
				<LoadedRail page={page} head={head} />
			</Suspense>
		</CatchBoundary>
	);
}
