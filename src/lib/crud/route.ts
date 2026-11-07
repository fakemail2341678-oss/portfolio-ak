import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { notFound, stripSearchParams } from "@tanstack/react-router";
import type { z } from "zod";
import { tableListInput } from "@/hooks/use-list-page";
import { isAppError } from "@/lib/errors";
import { ensureQuery, type LoaderQueryOptions, loadList } from "@/lib/query";
import { pageTitle } from "@/lib/seo";
import { setErrorStatus } from "@/lib/start/http-status";
import type { PreferencesStore } from "@/lib/stores/preferences";

/**
 * Values for a CRUD section's route options (docs/guides/crud.md). The route
 * object itself stays a literal `createFileRoute("…")({ … })`, so the router can
 * split its component out (decision 0151); these only fill its `search`,
 * `loader` and `head`. Routes only: setErrorStatus needs the Start runtime.
 *
 *   export const Route = createFileRoute("/_admin/admin/projects/")({
 *     ...listSearch(projectList.search, projectList.defaults),
 *     loaderDeps: ({ search }) => search,
 *     loader: (route) => listLoader(route, { tableId: PROJECTS_TABLE_ID, query: projectListQueryOptions }),
 *     head: titleHead(m.projects_title),
 *     component: ProjectList,
 *   });
 */

/**
 * A list route's search: `validateSearch` (the schema corrects bad values instead
 * of failing the page) and a middleware that keeps the defaults out of links
 * (`?page=1&sort=-updated` is just the list), so URLs stay short.
 */
export const listSearch = <TSchema extends z.ZodType>(
	schema: TSchema,
	defaults: Readonly<Record<string, unknown>>,
) => ({
	validateSearch: schema,
	search: {
		middlewares: [
			stripSearchParams<z.output<TSchema>>(
				Object.fromEntries(Object.entries(defaults).filter(([, value]) => value !== undefined)) as Partial<
					z.output<TSchema>
				>,
			),
		],
	},
});

/**
 * A list route's loader: the page for the URL's search (the page size from the
 * URL or the table's saved preference, tableListInput), awaited when entering
 * (SSR) and only prefetched when the search changes on the page (loadList).
 * `also` loads what the page needs besides (filter options).
 */
export async function listLoader<TInput extends { pageSize: number }, TPage, TKey extends QueryKey>(
	{
		context,
		deps,
		cause,
	}: {
		context: { queryClient: QueryClient; preferences: PreferencesStore };
		/** The route's list search (loaderDeps): the input, with the page size still optional. */
		deps: Omit<TInput, "pageSize"> & { pageSize?: number | undefined };
		cause: "enter" | "stay" | "preload";
	},
	{
		tableId,
		query,
		also,
	}: {
		tableId: string;
		query: (input: TInput) => LoaderQueryOptions<TPage, TKey>;
		also?: (queryClient: QueryClient) => Promise<unknown>;
	},
): Promise<void> {
	// tableListInput only fills in the page size, which is exactly what deps lacks.
	const input = tableListInput(deps, context.preferences.state, tableId) as unknown as TInput;
	await Promise.all([loadList(context.queryClient, query(input), cause), also?.(context.queryClient)]);
}

/**
 * A detail route's read: the record (into the Query cache, for the page's
 * useSuspenseQuery), or the localized 404 page when it doesn't exist; any other
 * failure keeps its HTTP status during SSR.
 */
export async function loadDetailOr404<TData, TKey extends QueryKey>(
	queryClient: QueryClient,
	options: LoaderQueryOptions<TData, TKey>,
): Promise<TData> {
	try {
		return await ensureQuery(queryClient, options);
	} catch (error) {
		if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
		await setErrorStatus(error);
		throw error;
	}
}

/** An admin page's `head`: its title (the admin layout already makes every page noindex). */
export const titleHead = (title: () => string) => () => ({ meta: [{ title: pageTitle(title()) }] });
