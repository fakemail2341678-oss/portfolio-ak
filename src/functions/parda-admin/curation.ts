import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type AdminBillboard,
	type AdminCollection,
	type AdminLayout,
	billboardInput,
	billboardOrderInput,
	billboardUpdateInput,
	collectionInput,
	collectionUpdateInput,
	layoutInput,
	type TitleOption,
	titleSearchInput,
} from "@/features/parda/admin/schema";
import { PARDA_PAGES } from "@/features/parda/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { pardaCurator } from "@/server/parda/admin/context";
import * as curation from "@/server/parda/admin/curation";

/** /admin/parda/billboard, /collections and /layout: read with `parda:read`, changed with `parda:curate`, every write audited. */

const layoutPage = z.strictObject({ page: z.enum(PARDA_PAGES) });

/** The title picker: it asks TMDB, so only someone who can curate may. */
export const searchPardaTitles = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(titleSearchInput))
	.handler(({ data, context }): Promise<TitleOption[]> => curation.searchTitles(pardaCurator(context), data.q));

export const listPardaBillboards = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.handler(({ context }): Promise<AdminBillboard[]> => curation.listBillboards(context));

export const getPardaBillboard = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<AdminBillboard> => curation.getBillboard(context, data.id));

export const createPardaBillboard = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(billboardInput))
	.handler(({ data, context }): Promise<AdminBillboard> => curation.createBillboard(pardaCurator(context), data));

export const updatePardaBillboard = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(billboardUpdateInput))
	.handler(({ data, context }): Promise<AdminBillboard> => curation.updateBillboard(pardaCurator(context), data));

export const reorderPardaBillboards = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(billboardOrderInput))
	.handler(({ data, context }): Promise<{ moved: number }> => curation.reorderBillboards(pardaCurator(context), data));

export const deletePardaBillboards = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(
		({ data, context }): Promise<{ deleted: number }> => curation.deleteBillboards(pardaCurator(context), data.ids),
	);

export const listPardaCollections = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.handler(({ context }): Promise<AdminCollection[]> => curation.listCollections(context));

export const getPardaAdminCollection = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<AdminCollection> => curation.getCollection(context, data.id));

export const createPardaCollection = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(collectionInput))
	.handler(({ data, context }): Promise<AdminCollection> => curation.createCollection(pardaCurator(context), data));

export const updatePardaCollection = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(collectionUpdateInput))
	.handler(({ data, context }): Promise<AdminCollection> => curation.updateCollection(pardaCurator(context), data));

export const deletePardaCollections = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(
		({ data, context }): Promise<{ deleted: number }> => curation.deleteCollections(pardaCurator(context), data.ids),
	);

export const getPardaLayout = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(layoutPage))
	.handler(({ data, context }): Promise<AdminLayout> => curation.getLayout(context, data.page));

export const savePardaLayout = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:curate"), withServices])
	.validator(zodInput(layoutInput))
	.handler(({ data, context }): Promise<AdminLayout> => curation.saveLayout(pardaCurator(context), data));
