import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Pagination } from "@/components/navigation/pagination";
import { SearchLink } from "@/components/navigation/search-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import type { HubTitle } from "../home/types";
import { pardaLinks } from "../links";
import { QUERY_MAX, SEARCH_TABS, type SearchTab } from "../search";
import { INSET } from "../title/title-sections";
import { HitGrid } from "./hit-grid";
import { pardaSearchQueryOptions } from "./queries";
import { rememberSearch } from "./recent";
import type { SearchPageData } from "./types";

const route = getRouteApi("/_parda/app/parda/search");

const TAB_LABELS: Readonly<Record<SearchTab, () => string>> = {
	all: m.pd_search_tab_all,
	movies: m.pd_search_tab_movies,
	series: m.pd_search_tab_series,
	people: m.pd_search_tab_people,
};

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The search box: a GET form, so Enter searches without JavaScript too; with it, the router navigates. */
function SearchForm({ q, tab }: { q: string; tab: SearchTab }) {
	const navigate = useNavigate();
	const input = useRef<HTMLInputElement>(null);
	const id = useId();
	// Back and forward change the query under the box: show it, unless the viewer is typing.
	useEffect(() => {
		if (input.current && input.current !== document.activeElement) input.current.value = q;
	}, [q]);
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const next = (input.current?.value ?? "").trim().slice(0, QUERY_MAX);
		void navigate({ to: ".", search: { q: next, tab, page: undefined } });
	};
	return (
		<search className="w-full max-w-2xl">
			<form method="get" onSubmit={onSubmit} className="flex gap-2">
				<label htmlFor={id} className="sr-only">
					{m.pd_search_label()}
				</label>
				{tab === "all" ? null : <input type="hidden" name="tab" value={tab} />}
				<Input
					ref={input}
					id={id}
					name="q"
					type="search"
					defaultValue={q}
					maxLength={QUERY_MAX}
					placeholder={m.pd_search_placeholder()}
					autoComplete="off"
					enterKeyHint="search"
					className="h-11 text-base"
					data-testid="parda-search-field"
				/>
				<Button type="submit" className="h-11">
					<SearchIcon aria-hidden />
					<span className="max-sm:sr-only">{m.pd_search_submit()}</span>
				</Button>
			</form>
		</search>
	);
}

function Tabs({ tab }: { tab: SearchTab }) {
	return (
		<nav aria-label={m.pd_search_tabs_label()} className="-mb-px overflow-x-auto">
			<ul className="flex gap-1">
				{SEARCH_TABS.map((each) => (
					<li key={each}>
						<SearchLink
							patch={{ tab: each, page: undefined }}
							aria-current={each === tab ? "page" : undefined}
							className={cn(
								"block whitespace-nowrap px-3 py-2 text-pd-muted text-sm transition-colors hover:text-pd-ink aria-[current=page]:text-pd-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--pd-action)]",
								focusRing,
							)}
							data-testid={`parda-search-tab-${each}`}
						>
							{TAB_LABELS[each]()}
						</SearchLink>
					</li>
				))}
			</ul>
		</nav>
	);
}

function Suggestions({ titles, imageBase }: { titles: HubTitle[] | null; imageBase: string }) {
	if (!titles?.length) return null;
	return (
		<section aria-labelledby="search-suggestions" className="flex flex-col gap-4">
			<h2 id="search-suggestions" className="pd-display text-pd-head font-bold">
				{m.pd_search_trending()}
			</h2>
			<HitGrid hits={titles} imageBase={imageBase} data-testid="parda-search-suggestions" />
		</section>
	);
}

function Results({ data }: { data: Extract<SearchPageData, { configured: true }> }) {
	if (!data.q) {
		return (
			<>
				<p className="max-w-prose text-pd-muted">{m.pd_search_prompt()}</p>
				<Suggestions titles={data.suggestions} imageBase={data.imageBase} />
			</>
		);
	}
	if (data.hits === null) {
		if (data.limited) {
			return (
				<output className="block text-pd-muted" data-testid="parda-search-limited">
					{m.pd_search_limited()}
				</output>
			);
		}
		return (
			<output className="block text-pd-muted" data-testid="parda-search-unavailable">
				{m.pd_search_unavailable()}
			</output>
		);
	}
	if (data.hits.length === 0) {
		return (
			<>
				<div className="flex flex-col gap-3" data-testid="parda-search-empty">
					<output className="block font-medium text-lg">
						{data.page > 1 ? m.pd_search_past_end() : m.pd_search_nothing({ q: data.q })}
					</output>
					<ul className="list-disc ps-5 text-pd-muted text-sm">
						<li>{m.pd_search_tip_spelling()}</li>
						<li>{m.pd_search_tip_fewer()}</li>
						{data.tab === "all" ? null : <li>{m.pd_search_tip_all()}</li>}
					</ul>
					<Link
						{...pardaLinks.discover()}
						className={cn("self-start text-sm underline underline-offset-4 hover:text-pd-ink", focusRing)}
					>
						{m.pd_search_try_discover()}
					</Link>
				</div>
				<Suggestions titles={data.suggestions} imageBase={data.imageBase} />
			</>
		);
	}
	return (
		<>
			<output className="block text-pd-muted text-sm">
				{m.pd_search_count({ count: formatNumber(data.total), q: data.q })}
			</output>
			<HitGrid hits={data.hits} imageBase={data.imageBase} data-testid="parda-search-results" />
			<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
		</>
	);
}

/**
 * /app/parda/search (Task 66, decision 0239): TMDB's search in four tabs (all, movies,
 * series, people), 20 a page, up to TMDB's 500 pages; for nothing found, tips and what's
 * trending. Noindex. Each search shown is remembered in this browser for the overlay.
 */
export function PardaSearchPage() {
	const search = route.useSearch();
	const { data } = useSuspenseQuery(pardaSearchQueryOptions(getLocale(), search));
	useEffect(() => {
		if (search.q) rememberSearch(search.q);
	}, [search.q]);
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-search">
			<header className={cn(INSET, "flex flex-col gap-5 bg-pd-mask pt-8")}>
				<h1 className="pd-display text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">{m.pd_search_title()}</h1>
				<SearchForm q={search.q} tab={search.tab} />
				{data.configured && search.q ? <Tabs tab={search.tab} /> : <div className="h-2" />}
			</header>
			{data.configured ? (
				<div className={cn(INSET, "flex flex-col gap-6 pt-6 pb-12")}>
					<Results data={data} />
				</div>
			) : (
				<CatalogUnconfigured />
			)}
		</main>
	);
}
