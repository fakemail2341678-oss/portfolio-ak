import { crudCollection } from "@/lib/crud/collection";
import { pardaAdminKeys } from "./keys";
import type { AdminBillboard, AdminCollection, AdminReport, AdminSource, AdminTakedown } from "./schema";

/**
 * The admin lists' rows as TanStack DB collections (docs/guides/crud.md, "Writes").
 * Imported by components only, never by a route file or `queries.ts` (0189).
 */
export const pardaSourceRows = crudCollection<AdminSource>("parda-sources", pardaAdminKeys.sources());
export const pardaTakedownRows = crudCollection<AdminTakedown>("parda-takedowns", pardaAdminKeys.takedowns());
export const pardaReportRows = crudCollection<AdminReport>("parda-reports", pardaAdminKeys.reports());
export const pardaBillboardRows = crudCollection<AdminBillboard>("parda-billboards", pardaAdminKeys.billboards());
export const pardaCollectionRows = crudCollection<AdminCollection>("parda-collections", pardaAdminKeys.collections());
