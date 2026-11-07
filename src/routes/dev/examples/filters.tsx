import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { ActiveFilters, chipLabel, type FilterChip } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { BooleanFilter, SearchFilter, SelectFilter } from "@/components/filters/filters";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Badge } from "@/components/ui/badge";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { PRIORITY_LABELS } from "@/features/dev/examples/labels";
import { exampleTasksQueryOptions } from "@/features/dev/examples/queries";
import {
	EXAMPLE_PRIORITIES,
	EXAMPLE_SEARCH_DEFAULTS,
	type ExampleTaskSearch,
	exampleTaskSearchSchema,
} from "@/features/dev/examples/schema";
import { useListQuery } from "@/hooks/use-list-query";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { loadList } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Search params + filters: the URL is the state.
 * - validateSearch parses (and corrects) every param with the shared list helpers;
 * - stripSearchParams keeps default values out of links;
 * - the loader loads the list for the params (loadList: awaited on SSR, kept on
 *   screen while a new search loads);
 * - <FilterBar> is a GET form of native controls: it works without JavaScript and
 *   updates the URL (debounced for typing) with it.
 */
export const Route = createFileRoute("/dev/examples/filters")({
	validateSearch: exampleTaskSearchSchema,
	search: { middlewares: [stripSearchParams(EXAMPLE_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleTasksQueryOptions } = await import("@/features/dev/examples/queries");
		return loadList(context.queryClient, exampleTasksQueryOptions(deps), cause);
	},
	staticData: { breadcrumb: staticCrumb(m.examples_filters_title) },
	head: () => privateHead(m.examples_filters_title()),
	component: FiltersExample,
});

/** One chip per applied filter, each with the search change that removes it. */
function chips(search: ExampleTaskSearch): FilterChip[] {
	const result: FilterChip[] = [];
	if (search.q)
		result.push({ id: "q", label: chipLabel(m.examples_search(), `“${search.q}”`), remove: { q: undefined } });
	if (search.priority !== "all") {
		result.push({
			id: "priority",
			label: chipLabel(m.examples_priority(), PRIORITY_LABELS[search.priority]()),
			remove: { priority: undefined },
		});
	}
	if (search.done !== undefined) {
		result.push({
			id: "done",
			label: chipLabel(m.examples_status(), search.done ? m.examples_done() : m.examples_open()),
			remove: { done: undefined },
		});
	}
	return result;
}

function FiltersExample() {
	const search = Route.useSearch();
	const { data, busy, error } = useListQuery(exampleTasksQueryOptions(search));
	if (error && !data) throw error;
	if (!data) return null;
	return (
		<ExamplePage slug="filters">
			<Demo title={m.examples_filters_demo()} note={m.examples_filters_note()}>
				<FilterBar values={search} preserve={["sort"]}>
					<SearchFilter label={m.examples_search()} value={search.q} placeholder={m.examples_search_placeholder()} />
					<SelectFilter
						name="priority"
						label={m.examples_priority()}
						value={search.priority}
						options={[
							{ value: "all", label: m.examples_all() },
							...EXAMPLE_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority]() })),
						]}
					/>
					<BooleanFilter
						name="done"
						label={m.examples_status()}
						value={search.done}
						trueLabel={m.examples_done()}
						falseLabel={m.examples_open()}
					/>
				</FilterBar>
				<ActiveFilters chips={chips(search)} clearAll={{ q: undefined, priority: undefined, done: undefined }} />
				<p className="text-muted-foreground text-sm" aria-live="polite" data-testid="filters-count">
					{m.examples_results({ count: formatNumber(data.total) })}
				</p>
				{data.items.length === 0 ? (
					<EmptyState description={m.examples_no_results()} />
				) : (
					<ul
						className="divide-y rounded-md border transition-opacity aria-busy:opacity-60 motion-reduce:transition-none"
						aria-busy={busy || undefined}
						data-testid="filters-list"
					>
						{data.items.map((task) => (
							<li key={task.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
								<span className={task.done ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
								<Badge variant="secondary">{PRIORITY_LABELS[task.priority]()}</Badge>
							</li>
						))}
					</ul>
				)}
				<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
			</Demo>
		</ExamplePage>
	);
}
