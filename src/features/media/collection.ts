import { crudCollection } from "@/lib/crud/collection";
import { mediaKeys } from "./queries";
import type { MediaItemDto } from "./schema";

/**
 * The library's files as a TanStack DB collection (docs/guides/crud.md, "Writes"): deleting
 * changes it at once. Imported by components only, never by a route file (0189).
 */
export const mediaRows = crudCollection<MediaItemDto>("media", mediaKeys.lists());
