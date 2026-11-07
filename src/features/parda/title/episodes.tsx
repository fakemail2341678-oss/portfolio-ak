import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, linkOptions } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Rail, RailItem } from "@/components/data-display/rail";
import { SearchLink } from "@/components/navigation/search-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { ProgressBar, RatingBadge } from "../kit/badges";
import { EpisodeCard, PersonCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { MarkButton } from "../library/title-progress";
import type { EpisodeProgress } from "../library/types";
import { pardaLinks } from "../links";
import { pardaSeasonQueryOptions } from "../queries";
import { episodeCode, formatTmdbDate } from "./title-hero";
import type { EpisodeRef, SeasonData, SeasonEpisode, SeasonSummary } from "./types";

const route = getRouteApi("/_parda/app/parda/$type/$id/");

const HEADING = "pd-display text-pd-head font-bold";
const INSET = "px-4 sm:px-6 lg:px-8";

/** An episode's sheet opens from the URL (`?episode=`), so a link can share it; the season's list stays put. */
const episodeLink = (episode: number) =>
	linkOptions({
		from: "/app/parda/$type/$id/",
		to: ".",
		search: (prev) => ({ ...prev, episode }),
		resetScroll: false,
	});

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "New episode": the latest one aired within the last week. */
export function NewEpisodeBanner({ latest, today }: { latest: EpisodeRef | null; today: string }) {
	if (!latest?.airDate) return null;
	const age = daysBetween(latest.airDate, today);
	if (age < 0 || age > 7) return null;
	return (
		<p className={cn(INSET, "flex items-center gap-3 bg-pd-ground-2 py-3 text-sm")} data-testid="new-episode-banner">
			<SparklesIcon aria-hidden className="size-4 shrink-0 text-pd-action" />
			<span>
				<span className="font-medium">{m.pd_new_episode()}</span>{" "}
				{m.pd_new_episode_detail({
					code: episodeCode(latest.season, latest.episode),
					name: latest.name,
					date: formatTmdbDate(latest.airDate),
				})}
			</span>
		</p>
	);
}

function SeasonPicker({
	seasons,
	current,
	imageBase,
	watched,
}: {
	seasons: ReadonlyArray<SeasonSummary>;
	current: number;
	imageBase: string;
	/** Finished episodes per season, for its bar. */
	watched: ReadonlyMap<number, number>;
}) {
	return (
		<Rail title={m.pd_seasons_heading()} titleClassName="sr-only" data-testid="season-picker">
			{seasons.map((season) => {
				const active = season.number === current;
				return (
					<RailItem key={season.number} className="w-28 sm:w-32">
						<SearchLink
							patch={{ season: season.number, page: undefined, episode: undefined }}
							resetScroll={false}
							aria-current={active ? "page" : undefined}
							className="group pd-press block outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground"
							data-testid="season-link"
						>
							<TmdbImage
								image={tmdbImage(imageBase, season.poster, "poster")}
								alt=""
								label={season.name}
								aspect="poster"
								sizes="8rem"
							/>
							{watched.get(season.number) ? (
								<ProgressBar value={Math.min(1, (watched.get(season.number) ?? 0) / Math.max(1, season.episodes))} />
							) : null}
							{/* The season shown is underlined in subtitle yellow, the one colour. */}
							<span className={cn("block h-1", active ? "bg-pd-action" : "bg-transparent")} aria-hidden />
							<span className="mt-2 flex flex-col gap-0.5">
								<span className="line-clamp-1 font-medium text-sm group-hover:underline group-hover:underline-offset-4">
									{season.name}
								</span>
								<span className="truncate text-pd-muted text-xs">
									{[
										season.year ? formatNumber(season.year, { useGrouping: false }) : null,
										m.pd_episode_count({ count: formatNumber(season.episodes) }),
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
							</span>
						</SearchLink>
					</RailItem>
				);
			})}
		</Rail>
	);
}

function EpisodeSheet({
	episode,
	season,
	imageBase,
	onClose,
}: {
	episode: SeasonEpisode | null;
	season: number;
	imageBase: string;
	onClose: () => void;
}) {
	return (
		<Sheet open={episode !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				side="right"
				className="w-full gap-0 overflow-y-auto border-0 bg-pd-mask p-0 text-pd-ink sm:max-w-md"
				data-testid="episode-sheet"
			>
				{episode ? (
					<>
						<TmdbImage
							image={tmdbImage(imageBase, episode.still, "still")}
							alt=""
							label={episodeCode(season, episode.number)}
							aspect="backdrop"
							sizes="28rem"
						/>
						<SheetHeader className="gap-1 p-4">
							<p className="text-pd-muted text-xs tabular-nums">{episodeCode(season, episode.number)}</p>
							<SheetTitle className="pd-display text-pd-ink text-xl">{episode.name}</SheetTitle>
							<p className="flex flex-wrap items-center gap-x-3 text-pd-muted text-xs">
								{episode.airDate ? <span>{formatTmdbDate(episode.airDate, "long")}</span> : null}
								{episode.runtime ? (
									<span>{m.pd_runtime_minutes({ minutes: formatNumber(episode.runtime) })}</span>
								) : null}
								<RatingBadge rating={episode.rating} className="text-pd-ink" />
							</p>
							<SheetDescription className="text-pd-muted text-sm leading-relaxed">
								{episode.overview || m.pd_title_no_overview()}
							</SheetDescription>
						</SheetHeader>
						<div className="flex flex-col gap-5 px-4 pb-8">
							{(
								[
									[m.pd_episode_directed(), episode.directors],
									[m.pd_episode_written(), episode.writers],
								] as const
							).map(([label, people]) =>
								people.length ? (
									<div key={label} className="flex flex-col gap-1 text-sm">
										<h3 className="text-pd-muted text-xs">{label}</h3>
										<p>
											{people.map((person, at) => (
												<span key={person.id}>
													{at > 0 ? ", " : null}
													<Link {...pardaLinks.person(person.id)} className="underline-offset-4 hover:underline">
														{person.name}
													</Link>
												</span>
											))}
										</p>
									</div>
								) : null,
							)}
							{episode.guests.length ? (
								<div className="flex flex-col gap-2">
									<h3 className="text-pd-muted text-xs">{m.pd_episode_guests()}</h3>
									<ul className="grid grid-cols-3 gap-3">
										{episode.guests.map((guest) => (
											<li key={guest.id}>
												<PersonCard
													name={guest.name}
													role={guest.role || null}
													profile={tmdbImage(imageBase, guest.profile, "profile")}
													link={pardaLinks.person(guest.id)}
													sizes="7rem"
												/>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}

function EpisodePager({ page, pageCount }: { page: number; pageCount: number }) {
	if (pageCount <= 1) return null;
	const step =
		"inline-flex h-9 items-center gap-1 border border-pd-muted/40 px-3 text-sm outline-none hover:bg-pd-ground-2 focus-visible:ring-[3px] focus-visible:ring-ring/50";
	return (
		<nav aria-label={m.pd_episodes_pages()} className={cn(INSET, "flex items-center justify-center gap-3")}>
			{page > 1 ? (
				<SearchLink patch={{ page: page - 1, episode: undefined }} resetScroll={false} rel="prev" className={step}>
					<ChevronLeftIcon aria-hidden className="size-4" />
					{m.pagination_previous()}
				</SearchLink>
			) : null}
			<span className="text-pd-muted text-sm tabular-nums">
				{m.pd_episodes_page({ page: formatNumber(page), count: formatNumber(pageCount) })}
			</span>
			{page < pageCount ? (
				<SearchLink patch={{ page: page + 1, episode: undefined }} resetScroll={false} rel="next" className={step}>
					{m.pagination_next()}
					<ChevronRightIcon aria-hidden className="size-4" />
				</SearchLink>
			) : null}
		</nav>
	);
}

type TitleRef = { media: "movie" | "tv"; id: number; slug: string };

function EpisodeList({
	data,
	title,
	progress,
	playable,
}: {
	data: Extract<SeasonData, { configured: true }>;
	title: TitleRef;
	progress: ReadonlyMap<string, EpisodeProgress>;
	playable: boolean;
}) {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	if (data.episodes === null) {
		return <p className={cn(INSET, "text-pd-muted text-sm")}>{m.pd_episodes_unavailable()}</p>;
	}
	if (data.episodes.length === 0) {
		return <p className={cn(INSET, "text-pd-muted text-sm")}>{m.pd_episodes_none()}</p>;
	}
	const open = data.episodes.find((episode) => episode.number === search.episode) ?? null;
	return (
		<>
			<ol className={cn(INSET, "flex flex-col gap-4")} data-testid="episode-list">
				{data.episodes.map((episode) => {
					const upcoming = episode.airDate !== null && episode.airDate > data.today;
					const own = progress.get(`${data.number}:${episode.number}`);
					return (
						<li key={episode.number} className="flex flex-col gap-1">
							<EpisodeCard
								item={{
									season: data.number,
									episode: episode.number,
									name: episode.name,
									still: tmdbImage(data.imageBase, episode.still, "still"),
									runtime: episode.runtime,
									airDate: episode.airDate,
									overview: episode.overview,
								}}
								link={episodeLink(episode.number)}
								{...(own && own.share > 0 ? { progress: own.share } : {})}
							/>
							{upcoming ? null : (
								<span className="flex flex-wrap items-center gap-1">
									{playable ? (
										<Button asChild variant="ghost" size="sm">
											<Link
												{...pardaLinks.watch(title.media, title.id, title.slug, {
													season: data.number,
													episode: episode.number,
												})}
												data-testid="episode-play"
											>
												<PlayIcon aria-hidden />
												{m.pd_action_play()}
												<span className="sr-only">{episodeCode(data.number, episode.number)}</span>
											</Link>
										</Button>
									) : null}
									<MarkButton
										title={title}
										target={{ scope: "episode", season: data.number, episode: episode.number }}
										watched={own?.finished ?? false}
									/>
								</span>
							)}
							{upcoming ? (
								<span className="w-fit bg-pd-ground-2 px-2 py-0.5 text-pd-muted text-xs" data-testid="episode-upcoming">
									{m.pd_episode_upcoming()}
								</span>
							) : null}
						</li>
					);
				})}
			</ol>
			<EpisodePager page={data.page} pageCount={data.pageCount} />
			<EpisodeSheet
				episode={open}
				season={data.number}
				imageBase={data.imageBase}
				onClose={() =>
					navigate({ search: (prev) => ({ ...prev, episode: undefined }), resetScroll: false, replace: true })
				}
			/>
		</>
	);
}

/**
 * A series' episodes (PLAN Task 63): the seasons as links (`?season`, specials last),
 * then the season's episodes a page at a time, each opening its sheet (`?episode`).
 * Each has its bar, Play and a watched mark; a season has its bar and mark (Task 64).
 */
export function Episodes({
	title,
	seasons,
	imageBase,
	progress,
	playable,
}: {
	title: TitleRef;
	seasons: ReadonlyArray<SeasonSummary>;
	imageBase: string;
	progress: ReadonlyArray<EpisodeProgress>;
	playable: boolean;
}) {
	const search = route.useSearch();
	const { data } = useSuspenseQuery(pardaSeasonQueryOptions(getLocale(), title.id, search.season, search.page));
	if (!data.configured) return null;
	const byEpisode = new Map(progress.map((each) => [`${each.season}:${each.episode}`, each]));
	const watched = new Map<number, number>();
	for (const each of progress) if (each.finished) watched.set(each.season, (watched.get(each.season) ?? 0) + 1);
	const seasonDone = data.total > 0 && (watched.get(data.number) ?? 0) >= data.total;
	return (
		<section
			id="episodes"
			aria-labelledby="episodes-heading"
			className="flex scroll-mt-20 flex-col gap-4"
			data-testid="title-episodes"
		>
			<div className={INSET}>
				<h2 id="episodes-heading" className={HEADING}>
					{m.pd_episodes_heading()}
				</h2>
			</div>
			{seasons.length > 1 ? (
				<SeasonPicker seasons={seasons} current={data.number} imageBase={imageBase} watched={watched} />
			) : null}
			<div className={cn(INSET, "flex flex-col gap-1")}>
				<h3 className="font-medium text-base" data-testid="season-heading">
					{data.name}
					<span className="ms-2 text-pd-muted text-sm">{m.pd_episode_count({ count: formatNumber(data.total) })}</span>
				</h3>
				{data.overview ? <p className="max-w-prose text-pd-muted text-sm leading-relaxed">{data.overview}</p> : null}
				<span className="flex flex-wrap items-center gap-3">
					{watched.get(data.number) ? (
						<span className="text-pd-muted text-xs" data-testid="season-watched">
							{m.pd_season_watched({
								count: formatNumber(watched.get(data.number) ?? 0),
								total: formatNumber(data.total),
							})}
						</span>
					) : null}
					<MarkButton
						title={title}
						target={{ scope: "season", season: data.number }}
						watched={seasonDone}
						label={seasonDone ? m.pd_mark_season_unwatched() : m.pd_mark_season_watched()}
					/>
				</span>
			</div>
			<EpisodeList data={data} title={title} progress={byEpisode} playable={playable} />
		</section>
	);
}
