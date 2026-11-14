import { crudCollection } from "@/lib/crud/collection";
import { testCrudKeys } from "./keys";
import type { TestCrudListItem } from "./schema";

/**
 * The list's rows as a TanStack DB collection (docs/guides/crud.md, "Writes"): publishing
 * and deleting change it at once. Imported by components only, never by a route file or
 * `queries.ts` (TanStack DB stays out of the other pages' JavaScript, 0189).
 */
export const testCrudRows = crudCollection<TestCrudListItem>("test-crud", testCrudKeys.lists());
