import { type DbClient, DbClient as TanStackDbClient } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

/**
 * TanStack DB wiring (see docs/decisions.md 0064 for when to use DB vs Query vs Store,
 * and 0189 for how it reaches a page).
 *
 * One DbClient per QueryClient, so per request on the server and one in the browser,
 * created on demand by the pages that use DB (`<DbScope>`), never by the router: its
 * runtime stays out of every other page. Feature collections are module-level
 * *descriptors* that the DbClient materializes, so server requests never share rows:
 *
 *   export const itemsCollection = collectionOptions("items", (client) =>
 *     queryCollectionOptions({
 *       id: "items",
 *       queryKey: itemKeys.all,                 // the loader's query: SSR'd rows are its start
 *       queryFn: () => listItems(),             // a server function
 *       queryClient: queryClientOf(client),
 *       getKey: (item) => item.id,
 *       onUpdate: async ({ transaction }) => { await updateItems(...) },  // throw => rollback
 *     }),
 *   );
 *
 * Live queries render on the server from the Query cache the loader filled
 * (`useLiveSuspenseQuery`), and the Query integration already sends that cache to the
 * browser, which builds the same rows from it: no stream of DB state is needed.
 */
const QUERY_CLIENT = "queryClient";

export const createDbClient = (queryClient: QueryClient): DbClient =>
	new TanStackDbClient({ [QUERY_CLIENT]: queryClient });

/** The request's QueryClient, for queryCollectionOptions({ queryClient }). */
export const queryClientOf = (client: DbClient) => client.requireDependency<QueryClient>(QUERY_CLIENT);

const clients = new WeakMap<QueryClient, DbClient>();

/**
 * The DbClient of a QueryClient, created the first time it's asked for. On the server,
 * pass `onRenderFinished` (the router's): the client's collections and live queries are
 * cleaned up once the page has rendered, as the official router integration does.
 */
export function dbClientFor(queryClient: QueryClient, onRenderFinished?: (listener: () => void) => void): DbClient {
	const existing = clients.get(queryClient);
	if (existing) return existing;
	const client = createDbClient(queryClient);
	clients.set(queryClient, client);
	if (onRenderFinished) {
		client._setSsrServerCleanupEnabled(true);
		onRenderFinished(() => {
			void client.cleanup().catch(() => undefined);
		});
	}
	return client;
}
