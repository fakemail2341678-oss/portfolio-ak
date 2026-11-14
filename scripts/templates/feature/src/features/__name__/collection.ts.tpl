import { crudCollection } from "@/lib/crud/collection";
import { __camel__Keys } from "./keys";
import type { __Pascal__ListItem } from "./schema";

/**
 * The list's rows as a TanStack DB collection (docs/guides/crud.md, "Writes"): a write
 * changes it at once. Imported by components only, never by a route file or `queries.ts`.
 */
export const __camel__Rows = crudCollection<__Pascal__ListItem>("__name__", __camel__Keys.lists());
