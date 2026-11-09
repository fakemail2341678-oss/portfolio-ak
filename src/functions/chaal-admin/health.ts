import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChaalHealth, ChaalPing } from "@/features/chaal/admin/schema";
import { CHAAL_HEALTH_RANGES } from "@/features/chaal/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as health from "@/server/chaal/admin/health";
import { chaalLichess } from "@/server/chaal/store";

/** /admin/chaal/health (Task 79): the calls, cooldowns and errors with `chaal:read`; "Test Lichess" with `chaal:configure`. */

export const getChaalHealth = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.validator(zodInput(z.strictObject({ range: z.enum(CHAAL_HEALTH_RANGES) })))
	.handler(({ data, context }): Promise<ChaalHealth> => health.healthState(context.db, data.range));

export const pingChaalLichess = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:configure")])
	.handler((): Promise<ChaalPing> => health.pingLichess(chaalLichess));
