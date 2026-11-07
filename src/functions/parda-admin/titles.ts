import { createServerFn } from "@tanstack/react-start";
import { type AdminTakedown, type AdminTakedownPage, takedownInput } from "@/features/parda/admin/schema";
import { pardaTakedownList } from "@/features/parda/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { pardaAdmin } from "@/server/parda/admin/context";
import * as takedowns from "@/server/parda/admin/takedowns";

/** /admin/parda/titles: the takedown list, read with `parda:read`, changed with `parda:moderate`, audited. */

export const listPardaTakedowns = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(pardaTakedownList.input))
	.handler(({ data, context }): Promise<AdminTakedownPage> => takedowns.listTakedowns(context, data));

export const blockPardaTitle = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:moderate"), withServices])
	.validator(zodInput(takedownInput))
	.handler(({ data, context }): Promise<AdminTakedown> => takedowns.blockTitle(pardaAdmin(context), data));

export const unblockPardaTitles = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:moderate"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => takedowns.unblockTitles(pardaAdmin(context), data.ids));
