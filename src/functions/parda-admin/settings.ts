import { createServerFn } from "@tanstack/react-start";
import { type AdminSettings, playbackInput, settingsInput, sourceOrderModeInput } from "@/features/parda/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { pardaAdmin } from "@/server/parda/admin/context";
import * as settings from "@/server/parda/admin/settings";

/** /admin/parda/settings and the kill switch: read with `parda:read`, changed with `parda:configure`, audited. */

export const getPardaSettings = createServerFn({ method: "GET" })
	.middleware([requirePermission("parda:read"), withServices])
	.handler(({ context }): Promise<AdminSettings> => settings.getSettings(context));

export const updatePardaSettings = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(settingsInput))
	.handler(({ data, context }): Promise<AdminSettings> => settings.updateSettings(pardaAdmin(context), data));

export const setPardaPlayback = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(playbackInput))
	.handler(({ data, context }): Promise<AdminSettings> => settings.setPlayback(pardaAdmin(context), data));

/** The sources' order: automatic (the daily scores) or the admin's (decision 0238). */
export const setPardaSourceOrder = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.validator(zodInput(sourceOrderModeInput))
	.handler(({ data, context }): Promise<AdminSettings> => settings.setSourceOrder(pardaAdmin(context), data));

export const purgePardaCache = createServerFn({ method: "POST" })
	.middleware([requirePermission("parda:configure"), withServices])
	.handler(({ context }): Promise<AdminSettings> => settings.purgeCache(pardaAdmin(context)));
