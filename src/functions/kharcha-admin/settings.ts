import { createServerFn } from "@tanstack/react-start";
import { type KharchaAdminSettings, updateKharchaSettingsInput } from "@/features/kharcha/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { getAdminSettings, updateAdminSettings } from "@/server/kharcha/admin/settings";

/** /admin/kharcha/settings (Task 96): read with `kharcha:read`, saved with `kharcha:configure`, audited. */

export const getKharchaAdminSettings = createServerFn({ method: "GET" })
	.middleware([requirePermission("kharcha:read"), withServices])
	.handler(({ context }): Promise<KharchaAdminSettings> => getAdminSettings(context));

export const updateKharchaSettings = createServerFn({ method: "POST" })
	.middleware([requirePermission("kharcha:configure"), withServices])
	.validator(zodInput(updateKharchaSettingsInput))
	.handler(({ data, context }): Promise<KharchaAdminSettings> => updateAdminSettings(context, data));
