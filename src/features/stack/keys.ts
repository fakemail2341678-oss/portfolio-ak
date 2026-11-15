import { getLocale } from "@/paraglide/runtime";
import type { StackSearch } from "./schema";

/**
 * Query keys include the locale: results are translated on the server, so an
 * English and a Nepali result must never share a cache entry.
 */
export const stackKeys = {
	all: ["stack"] as const,
	list: (search: StackSearch) => [...stackKeys.all, getLocale(), "list", search] as const,
};
