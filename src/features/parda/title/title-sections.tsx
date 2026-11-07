import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ExternalLinkIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type DescriptionItem, DescriptionList } from "@/components/data-display/description-list";
import { Rail, RailItem } from "@/components/data-display/rail";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { HEADING, POSTER_ITEM, POSTER_SIZES, toPosterItem } from "../home/title-rails";
import { PersonCard, PosterCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { CardListToggle } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { typeOfMedia } from "../search";
import { jobLabel, PROVIDER_ORDER, providerKindLabel } from "./labels";
import { formatTmdbDate } from "./title-hero";
import type {
	CreditPerson,
	KeyCrewMember,
	ExternalLinks as Links,
	ListTitle,
	TitleFacts,
	TitleReview,
	TitleVideo,
	WatchProviders,
} from "./types";
import { VideoCard } from "./video-dialog";

/**
 * The title page's sections below the hero (PLAN Task 63), each its own named region
 * with a display heading, each absent when TMDB has nothing for it.
 */

export const INSET = "px-4 sm:px-6 lg:px-8";

const linkText = "underline-offset-4 hover:underline";

/** A section with an inset heading. Rails bring their own heading row instead. */
export function Section({
	id,
	title,
	children,
	action,
	className,
}: {
	id: string;
	title: string;
	children: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<section
			aria-labelledby={`${id}-heading`}
			className={cn("flex flex-col gap-4", className)}
			data-testid={`title-${id}`}
		>
			<div className={cn(INSET, "flex min-h-8 items-end justify-between gap-4")}>
				<h2 id={`${id}-heading`} className={HEADING}>
					{title}
				</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

export function PosterRail({
	title,
	titles,
	imageBase,
	testId,
}: {
	title: string;
	titles: ReadonlyArray<ListTitle>;
	imageBase: string;
	testId: string;
}) {
	if (titles.length === 0) return null;
	return (
		<Rail title={title} titleClassName={HEADING} data-testid={testId}>
			{titles.map((each) => (
				<RailItem key={`${each.media}:${each.id}`} className={POSTER_ITEM}>
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

export const roleOf = (person: CreditPerson) =>
	person.episodes
		? person.role
			? m.pd_role_episodes({ role: person.role, count: formatNumber(person.episodes) })
			: m.pd_episode_count({ count: formatNumber(person.episodes) })
		: person.role || null;

export function CastRail({
	cast,
	imageBase,
	credits,
}: {
	cast: ReadonlyArray<CreditPerson>;
	imageBase: string;
	credits: ReturnType<typeof pardaLinks.credits>;
}) {
	if (cast.length === 0) return null;
	return (
		<Rail
			title={m.pd_cast_heading()}
			titleClassName={HEADING}
			action={
				<Link
					{...credits}
					className={cn(linkText, "inline-flex items-center gap-1 text-sm")}
					data-testid="title-credits-link"
				>
					{m.pd_cast_all()}
					<ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
				</Link>
			}
			data-testid="title-cast"
		>
			{cast.map((person) => (
				<RailItem key={person.id} className="w-28 lg:w-36">
					<PersonCard
						name={person.name}
						role={roleOf(person)}
						profile={tmdbImage(imageBase, person.profile, "profile")}
						link={pardaLinks.person(person.id)}
					/>
				</RailItem>
			))}
		</Rail>
	);
}

export function KeyCrew({ crew }: { crew: ReadonlyArray<KeyCrewMember> }) {
	if (crew.length === 0) return null;
	return (
		<Section id="crew" title={m.pd_crew_heading()}>
			<ul className={cn(INSET, "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4")}>
				{crew.map((person) => (
					<li key={person.id} className="flex min-w-0 flex-col">
						<Link {...pardaLinks.person(person.id)} className={cn(linkText, "truncate font-medium")}>
							{person.name}
						</Link>
						<span className="text-pd-muted text-sm">{person.jobs.map(jobLabel).join(", ")}</span>
					</li>
				))}
			</ul>
		</Section>
	);
}

const money = (amount: number) => `$${formatNumber(amount)}`;

export function TitleDetails({ title }: { title: TitleFacts }) {
	const dates: DescriptionItem[] =
		title.media === "movie"
			? title.releaseDate
				? [{ label: m.pd_details_released(), value: formatTmdbDate(title.releaseDate, "long") }]
				: []
			: [
					...(title.releaseDate
						? [{ label: m.pd_details_first_aired(), value: formatTmdbDate(title.releaseDate, "long") }]
						: []),
					...(title.lastAirDate
						? [{ label: m.pd_details_last_aired(), value: formatTmdbDate(title.lastAirDate, "long") }]
						: []),
					...(title.episodes ? [{ label: m.pd_details_episodes(), value: formatNumber(title.episodes) }] : []),
				];
	const items: DescriptionItem[] = [
		...dates,
		...(title.originalTitle && title.originalTitle !== title.title
			? [{ label: m.pd_details_original_title(), value: title.originalTitle }]
			: []),
		...(title.originalLanguage ? [{ label: m.pd_details_original_language(), value: title.originalLanguage }] : []),
		...(title.spokenLanguages.length
			? [{ label: m.pd_details_spoken_languages(), value: title.spokenLanguages.join(", ") }]
			: []),
		...(title.networks.length
			? [{ label: m.pd_details_networks(), value: title.networks.map((network) => network.name).join(", ") }]
			: []),
		...(title.companies.length ? [{ label: m.pd_details_companies(), value: title.companies.join(", ") }] : []),
		...(title.countries.length ? [{ label: m.pd_details_countries(), value: title.countries.join(", ") }] : []),
		...(title.budget > 0 ? [{ label: m.pd_details_budget(), value: money(title.budget) }] : []),
		...(title.revenue > 0 ? [{ label: m.pd_details_revenue(), value: money(title.revenue) }] : []),
		...(title.ratings.length
			? [
					{
						label: m.pd_details_ratings(),
						value: title.ratings.map((row) => `${row.country}: ${row.rating}`).join(" · "),
					},
				]
			: []),
		...(title.alternativeTitles.length
			? [
					{
						label: m.pd_details_also_known_as(),
						value: (
							<ul className="flex flex-col">
								{title.alternativeTitles.map((row) => (
									<li key={`${row.country}:${row.title}`}>
										{row.title} <span className="text-pd-muted">({row.country})</span>
									</li>
								))}
							</ul>
						),
					},
				]
			: []),
	];
	if (items.length === 0 && title.keywords.length === 0) return null;
	return (
		<Section id="details" title={m.pd_details_heading()}>
			<div className={cn(INSET, "flex flex-col gap-6")}>
				{items.length ? <DescriptionList items={items} className="max-w-4xl" /> : null}
				{/* Each keyword is Discover's list of titles with it (Task 66). */}
				{title.keywords.length ? (
					<div className="flex flex-col gap-2">
						<h3 className="text-pd-muted text-sm">{m.pd_details_keywords()}</h3>
						<ul className="flex flex-wrap gap-2" data-testid="title-keywords">
							{title.keywords.map((keyword) => (
								<li key={keyword.id}>
									<Link
										{...pardaLinks.discover({
											type: typeOfMedia(title.media),
											keyword: keyword.id,
										})}
										className="block bg-pd-ground-2 px-2 py-1 text-xs outline-none transition-colors hover:text-pd-ink focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										{keyword.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				) : null}
			</div>
		</Section>
	);
}

/** Where to watch legally (JustWatch's data, which TMDB asks us to credit), in the admin's region. */
export function WhereToWatch({ providers, imageBase }: { providers: WatchProviders | null; imageBase: string }) {
	if (!providers) return null;
	const base = imageBase.replace(/\/$/, "");
	return (
		<Section id="watch" title={m.pd_watch_heading()}>
			<div className={cn(INSET, "flex flex-col gap-4")}>
				{PROVIDER_ORDER.map((kind) =>
					providers[kind].length ? (
						<div key={kind} className="flex flex-col gap-2">
							<h3 className="text-pd-muted text-sm">{providerKindLabel(kind)}</h3>
							<ul className="flex flex-wrap gap-3">
								{providers[kind].map((provider) => (
									<li key={provider.id} className="flex items-center gap-2 text-sm">
										{provider.logo ? (
											<img
												src={`${base}/w92${provider.logo}`}
												alt=""
												width={32}
												height={32}
												loading="lazy"
												className="size-8 bg-pd-ground-2"
											/>
										) : null}
										{provider.name}
									</li>
								))}
							</ul>
						</div>
					) : null,
				)}
				<p className="text-pd-muted text-xs">
					{m.pd_watch_justwatch()}{" "}
					{providers.link ? (
						<a href={providers.link} target="_blank" rel="noopener" className={cn(linkText, "text-pd-ink")}>
							{m.pd_watch_more()}
							<span className="sr-only"> ({m.pd_opens_new_tab()})</span>
						</a>
					) : null}
				</p>
			</div>
		</Section>
	);
}

export function Videos({ videos, title }: { videos: ReadonlyArray<TitleVideo>; title: string }) {
	if (videos.length === 0) return null;
	return (
		<Rail title={m.pd_videos_heading()} titleClassName={HEADING} data-testid="title-videos">
			{videos.map((video) => (
				<RailItem key={video.key} className="w-64">
					<VideoCard video={video} title={title} />
				</RailItem>
			))}
		</Rail>
	);
}

/** The franchise a title belongs to: its backdrop between the masks, and a link to the collection in order. */
export function FranchiseBanner({
	collection,
	imageBase,
}: {
	collection: TitleFacts["collection"];
	imageBase: string;
}) {
	if (!collection) return null;
	return (
		<section aria-labelledby="franchise-heading" className={INSET} data-testid="title-franchise">
			<Link
				{...pardaLinks.collection(collection.id)}
				className="group pd-press grid overflow-hidden bg-pd-mask outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
			>
				<TmdbImage
					image={tmdbImage(imageBase, collection.backdrop, "backdrop")}
					alt=""
					label={collection.name}
					aspect="backdrop"
					sizes="(min-width: 768px) 40vw, 100vw"
				/>
				<span className="flex flex-col justify-center gap-2 p-5 md:p-8">
					<span className="text-pd-muted text-sm">{m.pd_franchise_part_of()}</span>
					<span id="franchise-heading" className="pd-display text-pd-head font-bold">
						{collection.name}
					</span>
					<span className="inline-flex items-center gap-1 text-sm group-hover:underline group-hover:underline-offset-4">
						{m.pd_franchise_view()}
						<ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
					</span>
				</span>
			</Link>
		</section>
	);
}

/** Reviews, collapsed: each opens in place, and a cut one links to the rest where it was written. */
export function Reviews({ reviews }: { reviews: ReadonlyArray<TitleReview> }) {
	if (reviews.length === 0) return null;
	return (
		<Section id="reviews" title={m.pd_reviews_heading()}>
			<ul className={cn(INSET, "flex max-w-4xl flex-col gap-2")}>
				{reviews.map((review) => (
					<li key={review.id}>
						<details className="group bg-pd-ground-2" data-testid="title-review">
							<summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
								<span className="font-medium">{review.author}</span>
								{review.rating !== null ? (
									<span className="inline-flex items-center gap-1 text-sm">
										<StarIcon aria-hidden className="size-3.5 fill-current text-pd-ink" />
										{m.pd_review_rating({ rating: formatNumber(review.rating) })}
									</span>
								) : null}
								{review.date ? <span className="text-pd-muted text-sm">{formatTmdbDate(review.date)}</span> : null}
								<span className="ms-auto text-pd-muted text-sm group-open:hidden">{m.pd_review_read()}</span>
								<span className="ms-auto hidden text-pd-muted text-sm group-open:inline">{m.pd_review_hide()}</span>
							</summary>
							<div className="flex flex-col gap-3 px-4 pb-4">
								<p className="whitespace-pre-line text-sm leading-relaxed" lang="en">
									{review.content}
									{review.cut ? "…" : null}
								</p>
								{review.url ? (
									<a href={review.url} target="_blank" rel="noopener" className={cn(linkText, "w-fit text-sm")}>
										{m.pd_review_on_tmdb()}
										<span className="sr-only"> ({m.pd_opens_new_tab()})</span>
									</a>
								) : null}
							</div>
						</details>
					</li>
				))}
			</ul>
		</Section>
	);
}

/** Links out: whatever the catalogue knows, or nothing (Parda names no catalogue provider, 0249). */
export function ExternalLinks({ links }: { links: Links }) {
	const items: Array<[string, string | null]> = [
		["IMDb", links.imdb],
		["Wikidata", links.wikidata],
		[m.pd_link_homepage(), links.homepage],
		["Instagram", links.instagram],
		["Facebook", links.facebook],
		["X", links.twitter],
	];
	if (!items.some(([, href]) => href)) return null;
	return (
		<Section id="links" title={m.pd_links_heading()}>
			<ul className={cn(INSET, "flex flex-wrap gap-x-6 gap-y-2")}>
				{items.map(([label, href]) =>
					href ? (
						<li key={label}>
							<a
								href={href}
								target="_blank"
								rel="noopener"
								className={cn(linkText, "inline-flex items-center gap-1 text-sm")}
							>
								{label}
								<ExternalLinkIcon aria-hidden className="size-3.5" />
								<span className="sr-only"> ({m.pd_opens_new_tab()})</span>
							</a>
						</li>
					) : null,
				)}
			</ul>
		</Section>
	);
}
