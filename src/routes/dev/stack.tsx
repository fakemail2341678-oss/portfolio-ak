import { Await, createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter } from "@/components/filters/filters";
import { Pagination } from "@/components/navigation/pagination";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/page/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { stackListQueryOptions } from "@/features/stack/queries";
import {
	STACK_PAGE_SIZE,
	STACK_SEARCH_DEFAULTS,
	type StackSort,
	type StackStats,
	stackSearchSchema,
} from "@/features/stack/schema";
import { getStackStats } from "@/functions/stack";
import { useListQuery } from "@/hooks/use-list-query";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { loadList } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/dev/stack")({
	validateSearch: stackSearchSchema,
	// Keep URLs clean: default values are removed from generated links.
	search: { middlewares: [stripSearchParams(STACK_SEARCH_DEFAULTS)] },
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps, cause }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { stackListQueryOptions } = await import("@/features/stack/queries");
		// SSR and entering: awaited, so the list is part of the HTML and hydrates the Query
		// cache. A new search keeps the current list until the new one arrives (loadList).
		await loadList(queryClient, stackListQueryOptions(deps), cause);
		// Not awaited: streamed to the client when ready (deferred).
		return { stats: getStackStats() };
	},
	staticData: { breadcrumb: staticCrumb(m.stack_title) },
	head: () => privateHead(m.stack_title()),
	pendingComponent: StackPending,
	component: StackPage,
});

const SORT_LABELS: Record<StackSort, () => string> = {
	name: m.stack_sort_name,
	"-name": m.stack_sort_name_desc,
	category: m.stack_sort_category,
};

function StackPage() {
	const search = Route.useSearch();
	const { data, busy, error } = useListQuery(stackListQueryOptions(search));
	const { stats } = Route.useLoaderData();
	if (error && !data) throw error;
	if (!data) return <StackPending />;

	return (
		<Page className="gap-8">
			<Breadcrumbs />
			<PageHeader size="display" title={m.stack_title()} description={m.stack_description()} />

			<section aria-labelledby="stack-stats" className="rounded-lg border p-4">
				<h2 id="stack-stats" className="font-medium">
					{m.stack_stats_title()}
				</h2>
				<Await
					promise={stats}
					fallback={
						<p className="text-muted-foreground" data-testid="stats-fallback">
							{m.stack_stats_loading()}
						</p>
					}
				>
					{(value: StackStats) => (
						<p data-testid="stats-value">
							{m.stack_stats_summary({ tools: formatNumber(value.tools), categories: formatNumber(value.categories) })}
						</p>
					)}
				</Await>
			</section>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<FilterBar
					values={search}
					preserve={["sort"]}
					submitLabel={m.stack_search_submit()}
					className="w-full max-w-md"
				>
					<SearchFilter
						label={m.stack_search_label()}
						value={search.q}
						placeholder={m.stack_search_placeholder()}
						className="flex-1 sm:w-auto"
					/>
				</FilterBar>

				<nav aria-label={m.stack_sort_label()} className="flex items-center gap-1 text-sm">
					<span className="mr-1 text-muted-foreground">{m.stack_sort_label()}</span>
					{(Object.keys(SORT_LABELS) as StackSort[]).map((sort) => (
						<Link
							key={sort}
							from={Route.fullPath}
							search={(prev) => ({ ...prev, sort, page: 1 })}
							aria-current={search.sort === sort ? "true" : undefined}
							className={cn(
								"rounded-md px-2 py-1 hover:bg-accent",
								search.sort === sort ? "bg-accent font-medium" : "text-muted-foreground",
							)}
						>
							{SORT_LABELS[sort]()}
						</Link>
					))}
				</nav>
			</div>

			<p className="text-muted-foreground text-sm" aria-live="polite" data-testid="stack-count">
				{m.stack_results({ count: formatNumber(data.total) })}
			</p>

			{data.items.length === 0 ? (
				<EmptyState
					variant="no-matches"
					description={m.stack_empty({ query: search.q })}
					primaryAction={
						<Button asChild variant="outline">
							<Link from={Route.fullPath} search={(prev) => ({ ...prev, q: "", page: 1 })}>
								{m.stack_clear_search()}
							</Link>
						</Button>
					}
				/>
			) : (
				<ul
					className="grid gap-4 transition-opacity aria-busy:opacity-60 motion-reduce:transition-none sm:grid-cols-2 lg:grid-cols-3"
					aria-busy={busy || undefined}
					data-testid="stack-list"
				>
					{data.items.map((item) => (
						<li key={item.id}>
							<Card className="h-full">
								<CardHeader>
									<CardTitle>{item.name}</CardTitle>
									<CardDescription>{item.categoryLabel}</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-1 flex-col justify-between gap-3">
									<p className="text-sm">{item.description}</p>
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm underline underline-offset-4"
									>
										{m.stack_visit()}
										<span className="sr-only"> — {item.name}</span>
									</a>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}

			<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
		</Page>
	);
}

/** Skeleton shown while a client-side navigation loads the list. */
function StackPending() {
	return (
		<Page className="gap-8" aria-busy="true">
			<output className="sr-only">{m.pending_loading()}</output>
			<PageHeaderSkeleton size="display" />
			<ListSkeleton
				count={STACK_PAGE_SIZE}
				item={<div className="h-40 w-full animate-pulse rounded-xl bg-muted" />}
				className="gap-4 sm:grid-cols-2 lg:grid-cols-3"
			/>
		</Page>
	);
}
