import { crudCollection } from "@/lib/crud/collection";
import { roleKeys, userKeys } from "./keys";
import type { RoleSummary, UserListItem } from "./schema";

/**
 * The roles and the users as TanStack DB collections (docs/guides/crud.md, "Writes"): the
 * roles list, the permission matrix and the users list change them at once. Imported by
 * components only, never by a route file or `queries.ts` (0189).
 */
export const roleRows = crudCollection<RoleSummary>("roles", roleKeys.lists());
export const userRows = crudCollection<UserListItem>("users", userKeys.lists());
