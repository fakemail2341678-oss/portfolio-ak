import { crudCollection } from "@/lib/crud/collection";
import { kharchaAdminKeys } from "./keys";
import type { KharchaSender } from "./schema";

/**
 * The senders as a TanStack DB collection (docs/guides/crud.md, "Writes"): suspending and
 * restoring change it at once. Imported by components only, never by a route file (0189).
 */
export const kharchaSenderRows = crudCollection<KharchaSender>("kharcha-senders", kharchaAdminKeys.senders());
