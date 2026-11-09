import { createServerFn } from "@tanstack/react-start";
import { type ChaalAdminSettings, chaalMaintenanceInput, chaalSettingsInput } from "@/features/chaal/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { chaalAdmin } from "@/server/chaal/admin/context";
import * as settings from "@/server/chaal/admin/settings";

/** /admin/chaal/settings (Task 79): read with `chaal:read`, changed with `chaal:configure`, every write audited. */

export const getChaalAdminSettings = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.handler(({ context }): Promise<ChaalAdminSettings> => settings.getSettings(chaalAdmin(context)));

export const updateChaalSettings = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:configure"), withServices])
	.validator(zodInput(chaalSettingsInput))
	.handler(({ data, context }): Promise<ChaalAdminSettings> => settings.updateSettings(chaalAdmin(context), data));

export const setChaalMaintenance = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:configure"), withServices])
	.validator(zodInput(chaalMaintenanceInput))
	.handler(({ data, context }): Promise<ChaalAdminSettings> => settings.setMaintenance(chaalAdmin(context), data));

export const purgeChaalCache = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:configure"), withServices])
	.handler(({ context }): Promise<ChaalAdminSettings> => settings.purgeCache(chaalAdmin(context)));
