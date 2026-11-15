import { EXAMPLE_SEARCH_DEFAULTS, type ExampleTaskSearch } from "./schema";

/**
 * The rows the optimistic example shows: the first page, newest first. Here, not next to
 * its collection, because the route's loader reads it: route options are in every page's
 * JavaScript (0151), and the collection module would bring TanStack DB with it (0189).
 */
export const OPTIMISTIC_SEARCH: ExampleTaskSearch = { ...EXAMPLE_SEARCH_DEFAULTS, done: undefined };
