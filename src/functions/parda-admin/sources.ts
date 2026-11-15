import { createServerFn } from "@tanstack/react-start";
import {
	type AdminSource,
	sourceInputSchema,
	sourceOrderInputSchema,
	sourceStateInputSchema,
	sourceUpdateInputSchema,
} from "@/features/parda/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { pardaAdmin } from "@/server/parda/admin/context";
import * as sources from "@/server/parda/admin/sources";

/** /admin/parda/sources: read with `parda:read`, changed with `parda:configure`, every write audited. */

export const listPardaSources = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.handler(({ context }): Promise<AdminSource[]> => sources.listSources(context));

export const getPardaSource = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<AdminSource> => sources.getSource(context, data.id));

export const createPardaSource = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(sourceInputSchema))
	.handler(({ data, context }): Promise<AdminSource> => sources.createSource(pardaAdmin(context), data));

export const updatePardaSource = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(sourceUpdateInputSchema))
	.handler(({ data, context }): Promise<AdminSource> => sources.updateSource(pardaAdmin(context), data));

export const setPardaSourceState = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(sourceStateInputSchema))
	.handler(({ data, context }): Promise<AdminSource> => sources.setSourceState(pardaAdmin(context), data));

export const reorderPardaSources = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(sourceOrderInputSchema))
	.handler(({ data, context }): Promise<{ moved: number }> => sources.reorderSources(pardaAdmin(context), data.ids));

export const deletePardaSources = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => sources.deleteSources(pardaAdmin(context), data.ids));
