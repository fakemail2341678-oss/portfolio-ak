import { createServerFn } from "@tanstack/react-start";
import { type LabPlayer, type LabSource, labPlayerInput } from "@/features/parda/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as lab from "@/server/parda/admin/player-lab";

/** /admin/parda/player-lab: every source, enabled or not, filled for one title (`parda:configure`). */

export const listPardaLabSources = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:configure"), withServices])
	.handler(({ context }): Promise<LabSource[]> => lab.listLabSources(context));

export const openPardaLabPlayer = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(labPlayerInput))
	.handler(({ data, context }): Promise<LabPlayer> => lab.openLabPlayer(context, data));
