import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { CHAAL_PATHS, chaalLinks } from "../links";
import { chaalStatusQueryOptions } from "../queries";
import type { BroadcastsSearch } from "../search";
import { broadcastSearchQueryOptions, broadcastsQueryOptions, officialBroadcastsQueryOptions } from "./queries";
import type { BroadcastInfo, BroadcastRoundSummary, BroadcastTourSummary } from "./schema";
import { WatchHeader, WatchOff } from "./watch-header";

const route = getRouteApi("/_chaal/app/chaal/broadcasts/");

/**
 * /app/chaal/broadcasts (Task 82, decision 0272; indexable): Lichess's broadcasts of
 * tournaments played over the board: live now, coming up and the past a page at a time;
 * the official ones (`?view=official`); or a search by name (`?q=`). Each opens its rounds here.
 */
export function ChaalBroadcastsPage() {
	const search = route.useSearch();
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const off = status?.features.watch === false;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-broadcasts">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<WatchHeader current="broadcasts" title={m.ch_broadcasts_title()} intro={m.ch_broadcasts_intro()} />
				{off ? (
					<WatchOff />
				) : (
					<>
						<Toolbar search={search} />
						{search.q ? (
							<SearchResults q={search.q} page={search.page ?? 1} />
						) : search.view === "official" ? (
							<Official />
						) : (
							<Top page={search.page ?? 1} />
						)}
					</>
				)}
			</div>
		</main>
	);
}

/** Top or official, and the search: a form that works without JavaScript too. */
function Toolbar({ search }: { search: BroadcastsSearch }) {
	const navigate = useNavigate();
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
		void navigate(chaalLinks.broadcasts(q.length >= 2 ? { q } : {}));
	};
	const views = [
		{ key: "top", search: {}, label: m.ch_broadcasts_top(), current: !search.q && search.view !== "official" },
		{
			key: "official",
			search: { view: "official" as const },
			label: m.ch_broadcasts_official(),
			current: !search.q && search.view === "official",
		},
	];
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<ul className="flex gap-1" aria-label={m.ch_broadcasts_views()}>
				{views.map((view) => (
					<li key={view.key}>
						<Button asChild variant={view.current ? "default" : "ghost"} size="sm">
							<Link
								{...chaalLinks.broadcasts(view.search)}
								aria-current={view.current ? "page" : undefined}
								data-testid={`chaal-broadcasts-${view.key}`}
							>
								{view.label}
							</Link>
						</Button>
					</li>
				))}
			</ul>
			<search>
				<form
					method="get"
					action={localizeHref(CHAAL_PATHS.broadcasts)}
					onSubmit={submit}
					className="flex items-center gap-2"
				>
					<label htmlFor="chaal-broadcast-q" className="sr-only">
						{m.ch_broadcasts_search_label()}
					</label>
					<Input
						id="chaal-broadcast-q"
						name="q"
						type="search"
						defaultValue={search.q ?? ""}
						minLength={2}
						maxLength={60}
						placeholder={m.ch_broadcasts_search_placeholder()}
						className="sm:w-64"
						data-testid="chaal-broadcasts-q"
					/>
					<Button type="submit" variant="outline" size="icon" aria-label={m.ch_broadcasts_search()}>
						<SearchIcon aria-hidden />
					</Button>
				</form>
			</search>
		</div>
	);
}

function Top({ page }: { page: number }) {
	const list = useQuery(broadcastsQueryOptions(page));
	if (!list.data) return <Waiting error={list.isError ? list.error : null} retry={() => void list.refetch()} />;
	const { active, upcoming, past, next } = list.data;
	return (
		<div className="flex flex-col gap-8">
			{page === 1 ? (
				<>
					<BroadcastSection
						id="chaal-broadcasts-live"
						title={m.ch_broadcasts_live()}
						tours={active}
						empty={m.ch_broadcasts_live_none()}
					/>
					{upcoming.length > 0 ? (
						<BroadcastSection id="chaal-broadcasts-upcoming" title={m.ch_broadcasts_upcoming()} tours={upcoming} />
					) : null}
				</>
			) : null}
			<BroadcastSection
				id="chaal-broadcasts-past"
				title={m.ch_broadcasts_past()}
				tours={past}
				empty={m.ch_broadcasts_none()}
			>
				<Pager page={page} next={next} make={(to) => (to > 1 ? { page: to } : {})} />
			</BroadcastSection>
		</div>
	);
}

function Official() {
	const list = useQuery(officialBroadcastsQueryOptions());
	if (!list.data) return <Waiting error={list.isError ? list.error : null} retry={() => void list.refetch()} />;
	return (
		<BroadcastSection
			id="chaal-broadcasts-official"
			title={m.ch_broadcasts_official()}
			tours={list.data}
			empty={m.ch_broadcasts_none()}
		/>
	);
}

function SearchResults({ q, page }: { q: string; page: number }) {
	const list = useQuery(broadcastSearchQueryOptions(q, page));
	if (!list.data) return <Waiting error={list.isError ? list.error : null} retry={() => void list.refetch()} />;
	return (
		<BroadcastSection
			id="chaal-broadcasts-results"
			title={m.ch_broadcasts_results({ q })}
			tours={list.data.results}
			empty={m.ch_broadcasts_results_none()}
		>
			<Pager page={page} next={list.data.next} make={(to) => (to > 1 ? { q, page: to } : { q })} />
		</BroadcastSection>
	);
}

function Waiting({ error, retry }: { error: unknown; retry: () => void }) {
	if (error)
		return (
			<div className="flex flex-col items-start gap-3" data-testid="chaal-broadcasts-error">
				<p className="text-ch-muted">{errorMessage(error)}</p>
				<Button type="button" variant="outline" onClick={retry}>
					{m.error_retry()}
				</Button>
			</div>
		);
	return <Skeleton className="h-[32rem] w-full rounded-none" />;
}

export function BroadcastSection({
	id,
	title,
	tours,
	empty,
	children,
}: {
	id: string;
	title: string;
	tours: ReadonlyArray<BroadcastTourSummary>;
	empty?: string;
	children?: ReactNode;
}) {
	if (tours.length === 0 && !empty) return null;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-2" data-testid={id}>
			<h2 id={id} className="ch-rule pt-3 font-semibold">
				{title}
			</h2>
			{tours.length === 0 ? (
				<p className="text-ch-muted text-sm">{empty}</p>
			) : (
				<ul className="flex flex-col">
					{tours.map((tour) => (
						<BroadcastRow key={`${tour.id}-${tour.round?.id ?? ""}`} tour={tour} />
					))}
				</ul>
			)}
			{children}
		</section>
	);
}

/** Pages of a list: Newer and Older, as links (the URL is the state). */
function Pager({ page, next, make }: { page: number; next: number | null; make: (page: number) => BroadcastsSearch }) {
	if (page <= 1 && next === null) return null;
	return (
		<nav aria-label={m.ch_broadcasts_pages()} className="flex gap-2 pt-2">
			{page > 1 ? (
				<Button asChild variant="outline" size="sm">
					<Link {...chaalLinks.broadcasts(make(page - 1))} data-testid="chaal-broadcasts-newer">
						{m.ch_broadcasts_newer()}
					</Link>
				</Button>
			) : null}
			{next !== null ? (
				<Button asChild variant="outline" size="sm">
					<Link {...chaalLinks.broadcasts(make(next))} data-testid="chaal-broadcasts-older">
						{m.ch_broadcasts_older()}
					</Link>
				</Button>
			) : null}
		</nav>
	);
}

/** "9-round Swiss · 90 min + 30 s · Bellevue": what a broadcast says about itself, as text. */
export const infoLine = (info: BroadcastInfo) =>
	[info.format, info.timeControl, info.location].filter(Boolean).join(" · ");

/** A round's state in words: live, when it starts, or when it finished. */
export function roundWhen(round: BroadcastRoundSummary): string {
	if (round.state === "ongoing") return m.ch_broadcast_round_live();
	if (round.state === "finished")
		return round.finishedAt
			? m.ch_broadcast_round_finished_on({ date: formatDate(round.finishedAt) })
			: m.ch_broadcast_round_finished();
	return round.startsAt
		? m.ch_broadcast_round_starts({ date: formatDateTime(round.startsAt) })
		: m.ch_broadcast_round_soon();
}

function BroadcastRow({ tour }: { tour: BroadcastTourSummary }) {
	const info = infoLine(tour.info);
	return (
		<li className="ch-hairline" data-testid="chaal-broadcast-row" data-tour={tour.id}>
			<Link
				{...chaalLinks.broadcast(tour.id, tour.round ? { round: tour.round.id } : {})}
				className="flex flex-col gap-0.5 py-3 hover:bg-ch-plate"
			>
				<span className="flex min-w-0 items-baseline gap-2">
					{tour.round?.state === "ongoing" ? (
						<span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-ch-ink" />
					) : null}
					<span className="font-semibold">{tour.name}</span>
					{tour.tier ? <span className="shrink-0 text-ch-muted text-xs">{m.ch_broadcast_official()}</span> : null}
				</span>
				{tour.round ? (
					<span className="text-ch-muted text-sm">
						{tour.round.name} · {roundWhen(tour.round)}
					</span>
				) : null}
				{info ? <span className="truncate text-ch-muted text-xs">{info}</span> : null}
			</Link>
		</li>
	);
}
