import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter } from "@/components/filters/filters";
import { Pagination } from "@/components/navigation/pagination";
import { Breadcrumbs } from "@/components/page/breadcrumbs";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/page/skeletons";
import { useListQuery } from "@/hooks/use-list-query";
import { formatDate } from "@/lib/i18n/intl";
{{#localized}}
import { localizedValue } from "@/lib/i18n/localized";
{{/localized}}
import { m } from "@/paraglide/messages";
import { public__Pascal__DetailQueryOptions, public__Pascal__ListQueryOptions } from "../queries";
import { __UPPER___PUBLIC_PAGE_SIZE } from "../search";

const listRoute = getRouteApi("/_public/__name__/");
const detailRoute = getRouteApi("/_public/__name__/$slug");

const text = (value: {{#localized}}{ en: string; ne: string }{{/localized}}{{^localized}}string{{/localized}}) => {{#localized}}localizedValue(value){{/localized}}{{^localized}}value{{/localized}};

/** /__name__: the published rows, searchable, server-rendered (works without JavaScript). */
export function Public__Pascal__List() {
	const search = listRoute.useSearch();
	const { data, busy, error } = useListQuery(public__Pascal__ListQueryOptions(search));
	if (error && !data) throw error;
	if (!data) return <Public__Pascal__Pending />;
	return (
		<Page width="default" className="gap-8">
			<Breadcrumbs jsonLd />
			<PageHeader title={m.__snake___public_title()} description={m.__snake___public_description()}>
				<FilterBar values={search} label={m.crud_search()}>
					<SearchFilter label={m.crud_search()} hideLabel value={search.q} />
				</FilterBar>
			</PageHeader>
			{data.items.length === 0 ? (
				<EmptyState
					variant={search.q ? "no-matches" : "empty"}
					description={search.q ? m.__snake___public_no_results({ q: search.q }) : m.__snake___public_empty()}
				/>
			) : (
				<ul className="flex flex-col gap-4 transition-opacity aria-busy:opacity-60" aria-busy={busy || undefined}>
					{data.items.map((item) => (
						<li key={item.slug} className="rounded-lg border p-4">
							<Link
								to="/__name__/$slug"
								params={{ slug: item.slug }}
								className="font-medium text-lg underline-offset-4 hover:underline"
							>
								{text(item.title)}
							</Link>
							{text(item.notes) ? <p className="mt-1 line-clamp-2 text-muted-foreground">{text(item.notes)}</p> : null}
						</li>
					))}
				</ul>
			)}
			<Pagination page={data.page} pageCount={data.pageCount} layout="center" hideWhenSingle />
		</Page>
	);
}

/** The list's pendingComponent (a client-side navigation; SSR never shows it). */
export function Public__Pascal__Pending() {
	return (
		<Page width="default" className="gap-8" aria-busy="true">
			<PageHeaderSkeleton />
			<ListSkeleton
				count={Math.min(6, __UPPER___PUBLIC_PAGE_SIZE)}
				item={<div className="h-20 animate-pulse rounded-lg bg-muted" />}
			/>
		</Page>
	);
}

/** /__name__/$slug: one published row. */
export function Public__Pascal__Detail() {
	const { slug } = detailRoute.useParams();
	const { data: item } = useSuspenseQuery(public__Pascal__DetailQueryOptions(slug));
	return (
		<Page width="narrow" className="gap-6">
			<Breadcrumbs jsonLd />
			<article className="flex flex-col gap-4">
				<h1 className="text-display">{text(item.title)}</h1>
				<p className="text-muted-foreground text-sm">{formatDate(item.updatedAt, { dateStyle: "long" })}</p>
				{text(item.notes) ? <p className="whitespace-pre-line">{text(item.notes)}</p> : null}
			</article>
			<Link to="/__name__" className="text-sm underline underline-offset-4">
				{m.__snake___public_back()}
			</Link>
		</Page>
	);
}
