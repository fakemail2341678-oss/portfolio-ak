import { crudCollection } from "@/lib/crud/collection";
import { chaalKeys } from "../keys";
import type { ChaalAdminBlock, ChaalAdminConnection } from "./schema";

/**
 * The admin lists' rows as TanStack DB collections (docs/guides/crud.md, "Writes").
 * Imported by components only, never by a route file or `queries.ts` (0189).
 */
export const chaalBlockRows = crudCollection<ChaalAdminBlock>("chaal-blocks", chaalKeys.adminBlocks());
export const chaalConnectionRows = crudCollection<ChaalAdminConnection>(
	"chaal-connections",
	chaalKeys.adminConnections(),
);
