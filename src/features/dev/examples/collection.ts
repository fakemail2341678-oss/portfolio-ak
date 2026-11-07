import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { listExampleTasks, setExampleTasksDone } from "@/functions/examples";
import { queryClientOf } from "@/lib/tanstack-db";
import { exampleKeys, exampleTasksQueryOptions, OPTIMISTIC_SEARCH } from "./queries";
import type { ExampleTask } from "./schema";

/** Pass as `collection.update(id, { metadata }, …)` to make the server refuse (shows the rollback). */
export type ExampleUpdateMetadata = { fail: boolean };

/**
 * TanStack DB collection over the example task list (the pattern of
 * src/features/test-crud/collection.ts, reduced to one handler):
 * - the same query key as the loader, so SSR'd rows are its initial state;
 * - `collection.update` shows at once; `onUpdate` calls the server and, if it
 *   throws, TanStack DB rolls the change back and `isPersisted.promise` rejects.
 */
export const exampleTasksCollection = collectionOptions("examples:tasks", (client) => {
	const queryClient = queryClientOf(client);
	return queryCollectionOptions({
		id: "examples:tasks",
		queryKey: exampleTasksQueryOptions(OPTIMISTIC_SEARCH).queryKey,
		queryFn: () => listExampleTasks({ data: OPTIMISTIC_SEARCH }),
		select: (page) => page.items,
		queryClient,
		getKey: (task: ExampleTask) => task.id,
		onUpdate: async ({ transaction }) => {
			for (const mutation of transaction.mutations) {
				const { fail = false } = (mutation.metadata ?? {}) as Partial<ExampleUpdateMetadata>;
				const done = mutation.changes.done;
				if (done !== undefined) await setExampleTasksDone({ data: { ids: [String(mutation.key)], done, fail } });
			}
			// The other examples show the same tasks.
			await queryClient.invalidateQueries({ queryKey: exampleKeys.tasks() });
			return { refetch: false };
		},
	});
});
