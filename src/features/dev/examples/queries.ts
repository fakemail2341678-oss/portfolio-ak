import { queryOptions } from "@tanstack/react-query";
import { getExampleSnapshot, getExampleTask, listExampleMessages, listExampleTasks } from "@/functions/examples";
import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTaskSearch } from "./schema";

export const exampleKeys = {
	all: ["examples"] as const,
	snapshot: () => [...exampleKeys.all, "snapshot"] as const,
	tasks: () => [...exampleKeys.all, "tasks"] as const,
	taskList: (search: ExampleTaskSearch) => [...exampleKeys.tasks(), "list", search] as const,
	task: (id: string) => [...exampleKeys.tasks(), "detail", id] as const,
};

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

/**
 * The rows the optimistic example shows: the first page, newest first. Here, not next to
 * its collection, because the route's loader reads it: route options are in every page's
 * JavaScript (0151), and the collection module would bring TanStack DB with it (0189).
 */
export const OPTIMISTIC_SEARCH: ExampleTaskSearch = { ...EXAMPLE_SEARCH_DEFAULTS, done: undefined };
