import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { BookmarkIcon, HeartIcon, HistoryIcon, PlayIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Pagination } from "@/components/navigation/pagination";
import { SearchLink } from "@/components/navigation/search-link";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { toPosterItem } from "../home/title-rails";
import { ProgressBar } from "../kit/badges";
import { PersonCard, PosterCard } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { PARDA_PATHS, pardaLinks } from "../links";
import { isLibraryTab, LIBRARY_TABS, type LibraryQuery, type LibraryTab } from "../search";
import { episodeCode } from "../title/title-hero";
import { INSET } from "../title/title-sections";
import { ContinueGrid } from "./continue-rail";
import { pardaHistoryQueryOptions, pardaShelfQueryOptions, refreshLibrary } from "./queries";
import { CardListToggle } from "./save-buttons";
import type { HistoryEntry, LibraryFavouritesData, LibraryListData } from "./types";

/**
 * The library (PLAN Task 67, decision 0240): My List, ♥ (titles and people), Continue
 * watching and History, one tab each at /app/parda/library/$tab. Noindex. The tabs and
 * the list's filters are links, so the page works without JavaScript.
 */

const route = getRouteApi("/_parda/app/parda/library/$tab");

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
const SIZES = "(min-width: 1024px) 15vw, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw";

export const LIBRARY_TAB_LABELS: Readonly<Record<LibraryTab, () => string>> = {
	list: () => m.pd_my_list(),
	favourites: () => m.pd_library_favourites(),
	continue: () => m.pd_continue_watching(),
	history: () => m.pd_library_history(),
};

function Tabs({ tab }: { tab: LibraryTab }) {
	return (
		<nav aria-label={m.pd_library_tabs_label()} className="-mb-px overflow-x-auto">
			<ul className="flex gap-1">
				{LIBRARY_TABS.map((each) => (
					<li key={each}>
						<Link
							{...pardaLinks.library(each)}
							aria-current={each === tab ? "page" : undefined}
							className={cn(
								"block whitespace-nowrap px-3 py-2 text-pd-muted text-sm transition-colors hover:text-pd-ink aria-[current=page]:text-pd-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--pd-action)]",
								focusRing,
							)}
							data-testid={`library-tab-${each}`}
						>
							{LIBRARY_TAB_LABELS[each]()}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** A set of links that each set one search field: the type filter and the order. */
function Choice<T extends string>({
	label,
	value,
	options,
	patch,
	testId,
}: {
	label: string;
	value: T;
	options: ReadonlyArray<{ value: T; label: string }>;
	patch: (value: T) => Partial<LibraryQuery>;
	testId: string;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2" data-testid={testId}>
			<span className="text-pd-muted text-xs">{label}</span>
			<ul className="flex flex-wrap gap-1">
				{options.map((option) => (
					<li key={option.value}>
						<SearchLink
							patch={{ ...patch(option.value), page: undefined }}
							aria-current={option.value === value ? "true" : undefined}
							className={cn(
								"block rounded-none border border-border px-3 py-1 text-sm hover:bg-pd-ground-2 aria-[current=true]:border-pd-action aria-[current=true]:bg-pd-ground-2",
								focusRing,
							)}
						>
							{option.label}
						</SearchLink>
					</li>
				))}
			</ul>
		</div>
	);
}

function ListControls({ query }: { query: LibraryQuery }) {
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
			<Choice
				label={m.pd_library_type_label()}
				value={query.type}
				options={[
					{ value: "all", label: m.pd_library_type_all() },
					{ value: "movie", label: m.pd_hub_movies() },
					{ value: "tv", label: m.pd_hub_series() },
				]}
				patch={(type) => ({ type: type === "all" ? undefined : type })}
				testId="library-type"
			/>
			<Choice
				label={m.pd_library_sort_label()}
				value={query.sort}
				options={[
					{ value: "added", label: m.pd_library_sort_added() },
					{ value: "title", label: m.pd_library_sort_title() },
					{ value: "year", label: m.pd_library_sort_year() },
				]}
				patch={(sort) => ({ sort: sort === "added" ? undefined : sort })}
				testId="library-sort"
			/>
		</div>
	);
}

function TitleGrid({ data, kind }: { data: LibraryListData; kind: "watchlist" | "favourite" }) {
	return (
		<ul className={GRID} data-testid={kind === "watchlist" ? "library-list" : "library-favourites"}>
			{data.titles.map((title) => (
				<li key={`${title.media}:${title.id}`}>
					<PosterCard
						item={toPosterItem(title, data.imageBase)}
						link={pardaLinks.title(title.media, title.id, title.slug)}
						sizes={SIZES}
						action={<CardListToggle kind={kind} title={{ media: title.media, id: title.id, title: title.title }} />}
					/>
				</li>
			))}
		</ul>
	);
}

function Shelf({ tab, query }: { tab: "list" | "favourites"; query: LibraryQuery }) {
	const { data } = useSuspenseQuery(pardaShelfQueryOptions(getLocale(), tab, query));
	const people = tab === "favourites" ? (data as LibraryFavouritesData).people : [];
	const filtered = query.type !== "all";
	if (data.total === 0 && people.length === 0 && !filtered) {
		return tab === "list" ? (
			<EmptyState
				icon={BookmarkIcon}
				title={m.pd_library_list_empty_title()}
				description={m.pd_library_list_empty()}
				primaryAction={
					<Button asChild>
						<Link {...pardaLinks.discover()}>{m.pd_nav_discover()}</Link>
					</Button>
				}
				data-testid="library-empty"
			/>
		) : (
			<EmptyState
				icon={HeartIcon}
				title={m.pd_library_favourites_empty_title()}
				description={m.pd_library_favourites_empty()}
				data-testid="library-empty"
			/>
		);
	}
	return (
		<div className="flex flex-col gap-8">
			{people.length ? (
				<section aria-labelledby="library-people" className="flex flex-col gap-4">
					<h2 id="library-people" className="pd-display text-pd-head font-bold">
						{m.pd_library_people()}
					</h2>
					<ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
						{people.map((person) => (
							<li key={person.id}>
								<PersonCard
									name={person.name}
									profile={tmdbImage(data.imageBase, person.portrait, "profile")}
									link={pardaLinks.person(person.id)}
								/>
							</li>
						))}
					</ul>
				</section>
			) : null}
			<section aria-labelledby="library-titles" className="flex flex-col gap-4">
				<div className="flex flex-col gap-3">
					<h2 id="library-titles" className={tab === "favourites" ? "pd-display text-pd-head font-bold" : "sr-only"}>
						{tab === "favourites" ? m.pd_library_titles() : m.pd_my_list()}
					</h2>
					<ListControls query={query} />
					<output className="block text-pd-muted text-sm">
						{m.pd_library_count({ count: formatNumber(data.total) })}
					</output>
				</div>
				{data.titles.length ? (
					<TitleGrid data={data} kind={tab === "list" ? "watchlist" : "favourite"} />
				) : (
					<p className="text-pd-muted">{m.pd_library_none_of_type()}</p>
				)}
				<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
			</section>
		</div>
	);
}

/** A TMDB-free day ("2026-11-05" in Parda's zone): named at noon UTC, so no zone moves it. */
const dayLabel = (day: string) => formatDate(`${day}T12:00:00Z`, { dateStyle: "full" });

function HistoryRow({
	entry,
	day,
	imageBase,
	onRemove,
}: {
	entry: HistoryEntry;
	day: string;
	imageBase: string;
	onRemove: () => void;
}) {
	const latest = entry.episodes[0];
	const episodes = entry.episodes.map((each) => episodeCode(each.season, each.episode));
	return (
		<li className="flex items-start gap-3 sm:gap-4" data-testid="history-entry">
			<Link
				{...pardaLinks.watch(entry.media, entry.id, entry.slug, latest ?? null)}
				className={cn("pd-press block w-32 shrink-0 sm:w-44", focusRing)}
				aria-label={m.pd_history_play({ title: entry.title })}
			>
				<TmdbImage
					image={tmdbImage(imageBase, entry.backdrop, "backdrop")}
					alt=""
					label={entry.title}
					aspect="backdrop"
					sizes="(min-width: 640px) 11rem, 8rem"
				/>
				<ProgressBar value={entry.share} />
			</Link>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Link
					{...pardaLinks.title(entry.media, entry.id, entry.slug)}
					className={cn("line-clamp-2 font-medium text-sm hover:underline hover:underline-offset-4", focusRing)}
				>
					{entry.title}
				</Link>
				<p className="line-clamp-2 text-pd-muted text-xs">
					{episodes.length ? episodes.join(" · ") : m.pd_history_movie()}
				</p>
				<p className="text-pd-muted text-xs">
					<time dateTime={entry.at}>{formatDate(entry.at, { timeStyle: "short" })}</time>
					<span className="sr-only">, {dayLabel(day)}</span>
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={onRemove}
				aria-label={m.pd_history_remove({ title: entry.title })}
				data-testid="history-remove"
			>
				<XIcon aria-hidden />
			</Button>
		</li>
	);
}

function History({ page }: { page: number }) {
	const { data } = useSuspenseQuery(pardaHistoryQueryOptions(getLocale(), page));
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [pending, setPending] = useState(false);
	const run = async (write: () => Promise<unknown>) => {
		setPending(true);
		try {
			await write();
			await refreshLibrary(queryClient);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	const remove = (entry: HistoryEntry, day: string) =>
		run(async () => {
			const { removePardaHistory } = await import("@/functions/parda/library");
			await removePardaHistory({ data: { media: entry.media, id: entry.id, day } });
		});
	const clear = async () => {
		const sure = await confirm({
			title: m.pd_history_clear_title(),
			description: m.pd_history_clear_description(),
			confirmLabel: m.pd_history_clear(),
			destructive: true,
		});
		if (!sure) return;
		await run(async () => {
			const { clearPardaHistory } = await import("@/functions/parda/library");
			await clearPardaHistory();
		});
	};
	if (data.days.length === 0) {
		return (
			<EmptyState
				icon={HistoryIcon}
				title={m.pd_history_empty_title()}
				description={page > 1 ? m.pd_history_past_end() : m.pd_history_empty()}
				data-testid="library-empty"
			/>
		);
	}
	return (
		<div className="flex flex-col gap-8">
			<div className="flex justify-end">
				<Button variant="outline" size="sm" onClick={() => void clear()} disabled={pending} data-testid="history-clear">
					<Trash2Icon aria-hidden />
					{m.pd_history_clear()}
				</Button>
			</div>
			{data.days.map((day) => (
				<section key={day.day} aria-labelledby={`history-${day.day}`} className="flex flex-col gap-4">
					<h2 id={`history-${day.day}`} className="font-medium text-pd-muted text-sm">
						{dayLabel(day.day)}
					</h2>
					<ul className="flex flex-col gap-4" data-testid="history-day">
						{day.entries.map((entry) => (
							<HistoryRow
								key={`${entry.media}:${entry.id}`}
								entry={entry}
								day={day.day}
								imageBase={data.imageBase}
								onRemove={() => void remove(entry, day.day)}
							/>
						))}
					</ul>
				</section>
			))}
			<Pagination
				page={data.page}
				pageCount={data.hasMore ? data.page + 1 : data.page}
				layout="center"
				hideWhenSingle
			/>
		</div>
	);
}

function SignedOut({ tab }: { tab: LibraryTab }) {
	return (
		<EmptyState
			icon={tab === "favourites" ? HeartIcon : tab === "history" ? HistoryIcon : BookmarkIcon}
			title={m.pd_library_signed_out_title()}
			description={tab === "continue" ? m.pd_library_signed_out_continue() : m.pd_library_signed_out()}
			primaryAction={
				<Button asChild>
					<Link {...(tab === "continue" ? pardaLinks.home() : pardaLinks.discover())}>
						{tab === "continue" ? m.pd_nav_home() : m.pd_nav_discover()}
					</Link>
				</Button>
			}
			secondaryAction={
				<Button asChild variant="ghost">
					<Link {...pardaLinks.signIn(PARDA_PATHS.library(tab))}>{m.pd_sign_in()}</Link>
				</Button>
			}
			data-testid="library-signed-out"
		/>
	);
}

function TabContent({ tab, query }: { tab: LibraryTab; query: LibraryQuery }) {
	switch (tab) {
		case "list":
		case "favourites":
			return <Shelf tab={tab} query={query} />;
		case "continue":
			return (
				<ContinueGrid
					empty={
						<EmptyState
							icon={PlayIcon}
							title={m.pd_library_continue_empty_title()}
							description={m.pd_library_continue_empty()}
							data-testid="library-empty"
						/>
					}
				/>
			);
		case "history":
			return <History page={query.page} />;
	}
}

export function PardaLibraryPage() {
	const { tab: param } = route.useParams();
	const query = route.useSearch();
	const tab: LibraryTab = isLibraryTab(param) ? param : "list";
	const { data: session } = useQuery(sessionQueryOptions());
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-library">
			<header className={cn(INSET, "flex flex-col gap-5 bg-pd-mask pt-8")}>
				<h1 className="pd-display text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">{m.pd_library_title()}</h1>
				<Tabs tab={tab} />
			</header>
			<div className={cn(INSET, "flex flex-col gap-6 pt-6 pb-12")}>
				{session ? <TabContent tab={tab} query={query} /> : <SignedOut tab={tab} />}
			</div>
		</main>
	);
}
