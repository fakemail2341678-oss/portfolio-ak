import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type LinkOptions, useNavigate } from "@tanstack/react-router";
import { ClockIcon, HistoryIcon, SearchIcon, TrendingUpIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isAppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import type { HubTitle } from "../home/types";
import { formatYear } from "../kit/cards";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { pardaLinks } from "../links";
import { pardaRailQueryOptions } from "../queries";
import { QUERY_MAX } from "../search";
import { departmentLabel } from "../title/labels";
import { pardaSuggestQueryOptions } from "./queries";
import {
	clearRecentlyViewed,
	clearRecentSearches,
	type RecentlyViewed,
	recentlyViewed,
	recentSearches,
	rememberSearch,
} from "./recent";
import type { PersonHit, SearchHit } from "./types";

/** Fewer letters than this match too much to be worth a call. */
const MIN_QUERY = 2;
const TRENDING = 6;

const mediaLabel = (media: "movie" | "tv") =>
	media === "movie" ? m.pd_search_kind_movie() : m.pd_search_kind_series();

function Thumb({ imageBase, path, person }: { imageBase: string; path: string | null; person?: boolean }) {
	return (
		<TmdbImage
			image={tmdbImage(imageBase, path, person ? "profile" : "poster")}
			alt=""
			aspect="poster"
			sizes="2.5rem"
			className="w-10 shrink-0"
			fallback={person ? <UserRoundIcon aria-hidden className="size-4" /> : <span aria-hidden />}
		/>
	);
}

function Row({ title, detail }: { title: string; detail: string }) {
	return (
		<span className="flex min-w-0 flex-col gap-0.5">
			<span className="truncate font-medium">{title}</span>
			{detail ? <span className="truncate text-pd-muted text-xs">{detail}</span> : null}
		</span>
	);
}

const titleDetail = (title: HubTitle) => [mediaLabel(title.media), formatYear(title.year)].filter(Boolean).join(" · ");
const personDetail = (person: PersonHit) =>
	[person.department ? departmentLabel(person.department) : "", person.knownFor.join(", ")].filter(Boolean).join(" · ");

const hitLink = (hit: SearchHit): LinkOptions =>
	hit.media === "person" ? pardaLinks.person(hit.id) : pardaLinks.title(hit.media, hit.id, hit.slug);

const viewedLink = (item: RecentlyViewed): LinkOptions =>
	item.media === "person" ? pardaLinks.person(item.id) : pardaLinks.title(item.media, item.id, item.slug);

/**
 * Parda's search overlay (Task 66, decision 0239), opened by the header's Search, Ctrl/⌘ K
 * or `/`. Empty, it shows this browser's recent searches and titles, and what's trending;
 * typed, the first hits of TMDB's multi search after a pause, with "See all results" first,
 * so Enter opens the search page. The arrow keys move through everything (cmdk).
 * Loaded only when first opened.
 */
export default function SearchOverlay({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const locale = getLocale();
	const [typed, setTyped] = useState("");
	const q = useDebouncedValue(typed.trim(), 250);
	const searching = typed.trim().length >= MIN_QUERY;
	const suggest = useQuery({
		...pardaSuggestQueryOptions(locale, q),
		enabled: open && q.length >= MIN_QUERY,
		placeholderData: keepPreviousData,
	});
	const trending = useQuery({ ...pardaRailQueryOptions(locale, "home", "trending"), enabled: open && !searching });
	const [memory, setMemory] = useState<{ searches: string[]; viewed: RecentlyViewed[] }>({ searches: [], viewed: [] });
	// This browser's memory is read each time the overlay opens: a page may have added to it.
	useEffect(() => {
		if (open) setMemory({ searches: recentSearches(), viewed: recentlyViewed() });
	}, [open]);

	const close = () => {
		onOpenChange(false);
		setTyped("");
	};
	const go = (link: LinkOptions) => {
		close();
		void navigate(link);
	};
	const searchFor = (query: string) => {
		rememberSearch(query);
		go(pardaLinks.search(query));
	};

	const hits = searching ? (suggest.data?.hits ?? []) : [];
	const titles = hits.filter((hit): hit is HubTitle => hit.media !== "person");
	const people = hits.filter((hit): hit is PersonHit => hit.media === "person");
	const limited = isAppError(suggest.error) && suggest.error.code === "RATE_LIMITED";
	const imageBase = suggest.data?.imageBase ?? "";

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent
				className="top-[10%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
				showCloseButton={false}
				data-testid="parda-search-overlay"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{m.pd_search_overlay_title()}</DialogTitle>
					<DialogDescription>{m.pd_search_overlay_description()}</DialogDescription>
				</DialogHeader>
				<Command shouldFilter={false} loop label={m.pd_search_overlay_title()}>
					<CommandInput
						value={typed}
						onValueChange={setTyped}
						placeholder={m.pd_search_placeholder()}
						maxLength={QUERY_MAX}
						className="h-12 text-base"
						data-testid="parda-search-input"
					/>
					<CommandList className="max-h-[min(30rem,65dvh)] p-1">
						{typed.trim() ? (
							<>
								<CommandGroup>
									<CommandItem
										value="search-all"
										onSelect={() => searchFor(typed.trim())}
										data-testid="parda-search-all"
									>
										<SearchIcon aria-hidden />
										<span className="truncate">{m.pd_search_see_all({ q: typed.trim() })}</span>
									</CommandItem>
								</CommandGroup>
								{searching && suggest.isFetching && !suggest.data ? (
									<output className="block px-3 py-4 text-pd-muted text-sm">{m.pd_search_loading()}</output>
								) : null}
								{limited ? (
									<output className="block px-3 py-4 text-pd-muted text-sm">{m.pd_search_limited()}</output>
								) : null}
								{searching && suggest.data && hits.length === 0 && !limited ? (
									<output className="block px-3 py-4 text-pd-muted text-sm">{m.pd_search_no_match()}</output>
								) : null}
								{titles.length ? (
									<CommandGroup heading={m.pd_search_titles()} data-testid="parda-search-titles">
										{titles.map((hit) => (
											<CommandItem
												key={`${hit.media}:${hit.id}`}
												value={`${hit.media}:${hit.id}`}
												onSelect={() => go(hitLink(hit))}
											>
												<Thumb imageBase={imageBase} path={hit.poster} />
												<Row title={hit.title} detail={titleDetail(hit)} />
											</CommandItem>
										))}
									</CommandGroup>
								) : null}
								{people.length ? (
									<CommandGroup heading={m.pd_search_people()} data-testid="parda-search-people">
										{people.map((hit) => (
											<CommandItem
												key={`person:${hit.id}`}
												value={`person:${hit.id}`}
												onSelect={() => go(hitLink(hit))}
											>
												<Thumb imageBase={imageBase} path={hit.profile} person />
												<Row title={hit.name} detail={personDetail(hit)} />
											</CommandItem>
										))}
									</CommandGroup>
								) : null}
							</>
						) : (
							<>
								<CommandEmpty>{m.pd_search_overlay_description()}</CommandEmpty>
								{memory.searches.length ? (
									<CommandGroup heading={m.pd_search_recent_searches()} data-testid="parda-recent-searches">
										{memory.searches.map((query) => (
											<CommandItem key={query} value={`recent:${query}`} onSelect={() => searchFor(query)}>
												<HistoryIcon aria-hidden />
												<span className="truncate">{query}</span>
											</CommandItem>
										))}
										<CommandItem
											value="clear-searches"
											onSelect={() => {
												clearRecentSearches();
												setMemory((current) => ({ ...current, searches: [] }));
											}}
											className="text-pd-muted"
										>
											<XIcon aria-hidden />
											<span>{m.pd_search_clear_searches()}</span>
										</CommandItem>
									</CommandGroup>
								) : null}
								{memory.viewed.length ? (
									<CommandGroup heading={m.pd_search_recently_viewed()} data-testid="parda-recently-viewed">
										{memory.viewed.map((item) => (
											<CommandItem
												key={`${item.media}:${item.id}`}
												value={`viewed:${item.media}:${item.id}`}
												onSelect={() => go(viewedLink(item))}
											>
												<Thumb imageBase={item.imageBase} path={item.picture} person={item.media === "person"} />
												<Row
													title={item.name}
													detail={item.media === "person" ? m.pd_search_kind_person() : mediaLabel(item.media)}
												/>
											</CommandItem>
										))}
										<CommandItem
											value="clear-viewed"
											onSelect={() => {
												clearRecentlyViewed();
												setMemory((current) => ({ ...current, viewed: [] }));
											}}
											className="text-pd-muted"
										>
											<ClockIcon aria-hidden />
											<span>{m.pd_search_clear_viewed()}</span>
										</CommandItem>
									</CommandGroup>
								) : null}
								{trending.data?.titles?.length ? (
									<CommandGroup heading={m.pd_search_trending()} data-testid="parda-search-trending">
										{trending.data.titles.slice(0, TRENDING).map((title) => (
											<CommandItem
												key={`${title.media}:${title.id}`}
												value={`trending:${title.media}:${title.id}`}
												onSelect={() => go(pardaLinks.title(title.media, title.id, title.slug))}
											>
												<TrendingUpIcon aria-hidden />
												<Row title={title.title} detail={titleDetail(title)} />
											</CommandItem>
										))}
									</CommandGroup>
								) : null}
							</>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
