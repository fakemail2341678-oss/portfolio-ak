import { createServerFn } from "@tanstack/react-start";
import { type ChaalAdminBlock, type ChaalAdminBlockPage, chaalBlockInput } from "@/features/chaal/admin/schema";
import { chaalBlockList } from "@/features/chaal/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as blocks from "@/server/chaal/admin/blocks";
import { chaalAdmin } from "@/server/chaal/admin/context";

/** /admin/chaal/blocks (Task 79): read with `chaal:read`; blocking and unblocking need `chaal:moderate`, audited. */

export const listChaalBlocks = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.validator(zodInput(chaalBlockList.input))
	.handler(({ data, context }): Promise<ChaalAdminBlockPage> => blocks.listBlocks(context, data));

export const blockChaal = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:moderate"), withServices])
	.validator(zodInput(chaalBlockInput))
	.handler(({ data, context }): Promise<ChaalAdminBlock> => blocks.createBlock(chaalAdmin(context), data));

export const unblockChaal = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:moderate"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => blocks.deleteBlocks(chaalAdmin(context), data.ids));
