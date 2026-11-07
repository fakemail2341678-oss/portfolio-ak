import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { PaginationProps } from "@/components/navigation/pagination";
import type { SearchPatch } from "@/components/navigation/search-link";
import type { Paged } from "../lib/list/paging";
import { usePreferences, usePreferencesStore } from "../lib/stores/hooks";
import { PAGE_SIZES, type Preferences } from "../lib/stores/preferences";
import { useListQuery } from "./use-list-query";

/**
 * The page-level wiring every server-paginated table repeats: resolve the page
 * size, read the list, and drive <Pagination> with a rows-per-page picker that is
 * remembered per table. Pair with `tableListInput` in the route's loader.
 *
 *   // route
 *   loader: ({ context, deps, cause }) =>
 *     loadList(context.queryClient, projectListQueryOptions(tableListInput(deps, context.preferences.state, PROJECTS_TABLE_ID)), cause),
 *
 *   // component
 *   const { input, page, busy, pagination } = useListPage({ tableId: PROJECTS_TABLE_ID, search, query: projectListQueryOptions });
 *   …
 *   {page && pagination ? <><DataTable rows={page.items} busy={busy} … /><Pagination {...pagination} /></> : <DataTableSkeleton … />}
 */

/** Rows per page when neither the URL nor the user's saved preference says otherwise. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * A table's list input from its URL search: `?pageSize=` when present, otherwise
 * the size the user last picked for this table, otherwise DEFAULT_PAGE_SIZE.
 * The same function runs in the loader and the component, so SSR and hydration agree.
 */
export const tableListInput = <TSearch extends { pageSize?: number | undefined }>(
	search: TSearch,
	preferences: Preferences,
	tableId: string,
) => withPageSize(search, preferences.tables[tableId]?.pageSize);

const withPageSize = <TSearch extends { pageSize?: number | undefined }>(
	search: TSearch,
	saved: number | undefined,
): TSearch & { pageSize: number } => ({ ...search, pageSize: search.pageSize ?? saved ?? DEFAULT_PAGE_SIZE });

export function useListPage<
	TSearch extends { pageSize?: number | undefined },
	TPage extends Paged<unknown>,
	TKey extends QueryKey,
>({
	tableId,
	search,
	query,
}: {
	/** The table's preferences key (also given to <DataTable tableId>). */
	tableId: string;
	/** The route's list search params (drop UI-only params such as a dialog's `edit` first). */
	search: TSearch;
	/** The feature's list query options, e.g. `projectListQueryOptions`. */
	query: (input: TSearch & { pageSize: number }) => UseQueryOptions<TPage, Error, TPage, TKey>;
}) {
	const navigate = useNavigate();
	const store = usePreferencesStore();
	const input = withPageSize(
		search,
		usePreferences((preferences) => preferences.tables[tableId]?.pageSize),
	);
	const { data: page, busy, error } = useListQuery(query(input));
	// Nothing to show at all: let the route's error boundary render the error page.
	if (error && !page) throw error;

	const pagination: PaginationProps | null = page
		? {
				page: page.page,
				pageCount: page.pageCount,
				total: page.total,
				pageSize: {
					value: input.pageSize,
					options: PAGE_SIZES,
					onChange: (size) => {
						store.actions.setTablePageSize(tableId, size);
						void navigate({ to: ".", search: (prev: SearchPatch) => ({ ...prev, pageSize: size, page: undefined }) });
					},
				},
			}
		: null;

	return { input, page, busy, pagination };
}
