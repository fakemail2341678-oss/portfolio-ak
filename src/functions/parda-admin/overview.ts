import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AdminOverview } from "@/features/parda/admin/schema";
import { PARDA_OVERVIEW_RANGES } from "@/features/parda/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { getOverview } from "@/server/parda/admin/overview";

/** /admin/parda: the numbers, read with `parda:read`. */

const overviewInput = z.strictObject({ range: z.enum(PARDA_OVERVIEW_RANGES) });

export const getPardaOverview = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.validator(zodInput(overviewInput))
	.handler(({ data, context }): Promise<AdminOverview> => getOverview(context, data.range));
