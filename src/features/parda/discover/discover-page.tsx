import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ActiveFilters, chipLabel, type FilterChip, rangeValue } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { type FilterOption, MultiSelectFilter, NumberRangeFilter, SelectFilter } from "@/components/filters/filters";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Pagination } from "@/components/navigation/pagination";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { GENRE_LABELS } from "../genres";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { DISCOVER_RUNTIMES, DISCOVER_SORTS, DISCOVER_STATUSES, type DiscoverSearch } from "../search";
import { HitGrid } from "../search/hit-grid";
import { pardaDiscoverQueryOptions } from "../search/queries";
import type { DiscoverPageData } from "../search/types";
import { statusLabel } from "../title/labels";
import { INSET } from "../title/title-sections";
import { DISCOVER_COMPANIES, DISCOVER_GENRES, DISCOVER_RATINGS } from "./options";

const route = getRouteApi("/_parda/app/parda/discover");

type Filters = DiscoverSearch;
type Ready = Extract<DiscoverPageData, { configured: true }>;

const SORT_LABELS: Readonly<Record<Filters["sort"], () => string>> = {
	popular: m.pd_discover_sort_popular,
	rating: m.pd_discover_sort_rating,
	newest: m.pd_discover_sort_newest,
	oldest: m.pd_discover_sort_oldest,
	title: m.pd_discover_sort_title,
};

/** TMDB's English statuses, which the title page already names. */
const STATUS_NAMES: Readonly<Record<NonNullable<Filters["status"]>, string>> = {
	returning: "Returning Series",
	production: "In Production",
	ended: "Ended",
	canceled: "Canceled",
};

/** The runtime bands' edges in minutes, as discover-requests.ts applies them. */
const RUNTIME_EDGES = { movie: [90, 150], series: [30, 60] } as const;

const genreName = (id: number) => GENRE_LABELS[id]?.() ?? String(id);

function runtimeLabel(type: Filters["type"], runtime: NonNullable<Filters["runtime"]>) {
	const [low, high] = RUNTIME_EDGES[type];
	if (runtime === "short") return m.pd_discover_runtime_under({ minutes: formatNumber(low) });
	if (runtime === "long") return m.pd_discover_runtime_over({ minutes: formatNumber(high) });
	return m.pd_discover_runtime_between({ from: formatNumber(low), to: formatNumber(high) });
}

const companyLabel = (type: Filters["type"]) => (type === "series" ? m.pd_discover_network() : m.pd_discover_studio());

const any: FilterOption = { value: "", label: "" };

function chipsOf(data: Ready): FilterChip[] {
	const { filters } = data;
	const chips: FilterChip[] = filters.genres.map((genre) => ({
		id: `genre-${genre}`,
		label: chipLabel(m.pd_discover_genres(), genreName(genre)),
		remove: { genres: filters.genres.filter((each) => each !== genre) },
	}));
	const years = rangeValue(
		filters.from === undefined ? undefined : formatNumber(filters.from, { useGrouping: false }),
		filters.to === undefined ? undefined : formatNumber(filters.to, { useGrouping: false }),
	);
	if (years)
		chips.push({
			id: "years",
			label: chipLabel(m.pd_discover_years(), years),
			remove: { from: undefined, to: undefined },
		});
	if (filters.rating !== undefined) {
		chips.push({
			id: "rating",
			label: chipLabel(m.pd_discover_rating(), m.pd_discover_rating_at_least({ score: formatNumber(filters.rating) })),
			remove: { rating: undefined },
		});
	}
	if (filters.runtime) {
		chips.push({
			id: "runtime",
			label: chipLabel(m.pd_discover_runtime(), runtimeLabel(filters.type, filters.runtime)),
			remove: { runtime: undefined },
		});
	}
	if (filters.language) {
		const name = data.languages.find((language) => language.code === filters.language)?.name ?? filters.language;
		chips.push({ id: "language", label: chipLabel(m.pd_discover_language(), name), remove: { language: undefined } });
	}
	if (filters.status) {
		chips.push({
			id: "status",
			label: chipLabel(m.pd_discover_status(), statusLabel(STATUS_NAMES[filters.status])),
			remove: { status: undefined },
		});
	}
	const company = DISCOVER_COMPANIES[filters.type].find((each) => each.id === filters.company);
	if (company) {
		chips.push({
			id: "company",
			label: chipLabel(companyLabel(filters.type), company.name),
			remove: { company: undefined },
		});
	}
	if (filters.keyword !== undefined) {
		chips.push({
			id: "keyword",
			label: chipLabel(m.pd_discover_keyword(), data.keyword ?? formatNumber(filters.keyword, { useGrouping: false })),
			remove: { keyword: undefined },
		});
	}
	return chips;
}

const CLEAR_ALL = {
	genres: undefined,
	from: undefined,
	to: undefined,
	rating: undefined,
	runtime: undefined,
	language: undefined,
	status: undefined,
	company: undefined,
	keyword: undefined,
};

/** The filters: one GET form (FilterBar), so every choice works without JavaScript. */
function DiscoverFilters({ data, values }: { data: Ready; values: Filters }) {
	const { filters } = data;
	const type = filters.type;
	const anyLabel = m.filters_any();
	return (
		<FilterBar values={values} preserve={["keyword"]} label={m.pd_discover_filters()} className="w-full">
			<SelectFilter
				name="type"
				label={m.pd_discover_type()}
				value={type}
				options={[
					{ value: "movie", label: m.pd_search_kind_movie() },
					{ value: "series", label: m.pd_search_kind_series() },
				]}
				className="w-32"
			/>
			<MultiSelectFilter
				name="genres"
				label={m.pd_discover_genres()}
				value={filters.genres.map(String)}
				options={DISCOVER_GENRES[type].map((genre) => ({ value: String(genre), label: genreName(genre) }))}
			/>
			<NumberRangeFilter
				label={m.pd_discover_years()}
				names={["from", "to"]}
				value={[filters.from, filters.to]}
				min={1874}
				step={1}
			/>
			<SelectFilter
				name="rating"
				label={m.pd_discover_rating()}
				value={filters.rating === undefined ? "" : String(filters.rating)}
				options={[
					{ ...any, label: anyLabel },
					...DISCOVER_RATINGS.map((score) => ({
						value: String(score),
						label: m.pd_discover_rating_at_least({ score: formatNumber(score) }),
					})),
				]}
				className="w-32"
			/>
			<SelectFilter
				name="runtime"
				label={m.pd_discover_runtime()}
				value={filters.runtime ?? ""}
				options={[
					{ ...any, label: anyLabel },
					...DISCOVER_RUNTIMES.map((runtime) => ({ value: runtime, label: runtimeLabel(type, runtime) })),
				]}
			/>
			<SelectFilter
				name="language"
				label={m.pd_discover_language()}
				value={filters.language ?? ""}
				options={[
					{ ...any, label: anyLabel },
					...data.languages.map((language) => ({ value: language.code, label: language.name })),
				]}
			/>
			{type === "series" ? (
				<SelectFilter
					name="status"
					label={m.pd_discover_status()}
					value={filters.status ?? ""}
					options={[
						{ ...any, label: anyLabel },
						...DISCOVER_STATUSES.map((status) => ({ value: status, label: statusLabel(STATUS_NAMES[status]) })),
					]}
				/>
			) : null}
			<SelectFilter
				name="company"
				label={companyLabel(type)}
				value={filters.company === undefined ? "" : String(filters.company)}
				options={[
					{ ...any, label: anyLabel },
					...DISCOVER_COMPANIES[type].map((company) => ({ value: String(company.id), label: company.name })),
				]}
				className="w-48"
			/>
			<SelectFilter
				name="sort"
				label={m.pd_discover_sort()}
				value={filters.sort}
				options={DISCOVER_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort]() }))}
			/>
		</FilterBar>
	);
}

function DiscoverResults({ data }: { data: Ready }) {
	if (data.titles === null) {
		return (
			<output className="block text-pd-muted" data-testid="parda-discover-unavailable">
				{m.pd_discover_unavailable()}
			</output>
		);
	}
	if (data.titles.length === 0) {
		return (
			<output className="block text-pd-muted" data-testid="parda-discover-empty">
				{data.page > 1 ? m.pd_search_past_end() : m.pd_discover_empty()}
			</output>
		);
	}
	return (
		<>
			<HitGrid hits={data.titles} imageBase={data.imageBase} data-testid="parda-discover-results" />
			<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
		</>
	);
}

/**
 * /app/parda/discover (Task 66, decision 0239): TMDB's discover under Parda's filters
 * (type, genres, years, score, runtime, language, a series' status, network or studio,
 * sort), 20 a page up to TMDB's 500. Indexable; the address holds every filter, so a
 * genre rail's "See all" and a title's keywords link straight to a filtered page.
 */
export function PardaDiscoverPage() {
	const search = route.useSearch();
	const { data } = useSuspenseQuery(pardaDiscoverQueryOptions(getLocale(), search));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-discover">
			<header className={cn(INSET, "flex flex-col gap-2 bg-pd-mask pt-8 pb-6")}>
				<h1 className="pd-display text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">{m.pd_discover_title()}</h1>
				<p className="max-w-prose text-pd-muted">{m.pd_discover_lead()}</p>
			</header>
			{data.configured ? (
				<div className={cn(INSET, "flex flex-col gap-6 pt-6 pb-12")}>
					<DiscoverFilters data={data} values={search} />
					<ActiveFilters chips={chipsOf(data)} clearAll={CLEAR_ALL} />
					<DiscoverResults data={data} />
				</div>
			) : (
				<CatalogUnconfigured />
			)}
		</main>
	);
}
