import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChaalOverview } from "@/features/chaal/admin/schema";
import { CHAAL_OVERVIEW_RANGES } from "@/features/chaal/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { getOverview } from "@/server/chaal/admin/overview";

/** /admin/chaal (Task 84): the numbers, read with `chaal:read`. */

export const getChaalOverview = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.validator(zodInput(z.strictObject({ range: z.enum(CHAAL_OVERVIEW_RANGES) })))
	.handler(({ data, context }): Promise<ChaalOverview> => getOverview(context.db, data.range));
