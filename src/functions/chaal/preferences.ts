import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type ChaalPreferences, chaalPreferencesSchema } from "@/features/chaal/settings/preferences";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as preferences from "@/server/chaal/preferences";

/**
 * The caller's preferences (Task 73, decision 0259): read, save, and bring in this
 * browser's once a session exists. Anyone with a session, guests included; each acts on
 * the caller's own row only (tests/server/chaal-access.test.ts). Without a session the
 * page keeps them in the browser and calls none of these.
 */

export const getChaalPreferences = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalPreferences | null> => preferences.preferencesOf(context.db, context.user.id));

export const saveChaalPreferences = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(z.strictObject({ preferences: chaalPreferencesSchema })))
	.handler(
		({ context, data }): Promise<ChaalPreferences> =>
			preferences.savePreferences(context.db, context.user.id, data.preferences),
	);

export const importChaalPreferences = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(z.strictObject({ preferences: chaalPreferencesSchema })))
	.handler(
		({ context, data }): Promise<ChaalPreferences> =>
			preferences.importPreferences(context.db, context.user.id, data.preferences),
	);
