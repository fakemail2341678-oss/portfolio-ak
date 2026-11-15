import { queryOptions } from "@tanstack/react-query";
import { getExampleSnapshot, getExampleTask, listExampleMessages, listExampleTasks } from "@/functions/examples";
import { exampleKeys } from "./keys";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTaskSearch } from "./schema";

/**
 * Loader + Query example. The loader awaits ensureQuery on the server; the
 * result is dehydrated into the page, so the component's useSuspenseQuery reads
 * it from the cache: no request while hydrating, none until it's stale.
 */
export const exampleSnapshotQueryOptions = () =>
	queryOptions({
		queryKey: exampleKeys.snapshot(),
		queryFn: () => getExampleSnapshot(),
		staleTime: 60_000,
	});

export const exampleTasksQueryOptions = (search: ExampleTaskSearch) =>
	queryOptions({
		queryKey: exampleKeys.taskList(search),
		queryFn: () => listExampleTasks({ data: search }),
	});

/** The components example's data: the first page of example tasks. */
export const kitComponentsQueryOptions = () => exampleTasksQueryOptions(EXAMPLE_SEARCH_DEFAULTS);

export const exampleTaskQueryOptions = (id: string) =>
	queryOptions({
		queryKey: exampleKeys.task(id),
		queryFn: () => getExampleTask({ data: { id } }),
	});

/** Idempotency example: the messages sent so far (refetched after each send). */
export const exampleMessagesQueryOptions = () =>
	queryOptions({
		queryKey: [...exampleKeys.all, "messages"] as const,
		queryFn: () => listExampleMessages(),
	});
