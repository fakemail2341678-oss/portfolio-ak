import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FollowingSchedule, InboxData } from "@/features/parda/schedule/types";
import { zodInput } from "@/functions/_lib/validator";
import { requirePardaViewer, withPardaServices } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { viewerToday } from "@/server/parda/catalog/context";
import * as alerts from "@/server/parda/notify/service";

/**
 * Parda's alerts (Task 68, decision 0241): the bell, marking alerts read, and the
 * schedule's half for the profile (its followed series). Each runs `requirePardaViewer`
 * then `withPardaServices`, and acts on the active profile only
 * (tests/server/parda-access.test.ts).
 */

const locale = z.enum(locales);

export const getPardaInbox = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ locale })))
	.handler(({ data, context }): Promise<InboxData> => alerts.inbox(context, data.locale));

/** The bell's alerts read: `ids` (those it showed), or every one when null. */
export const markPardaInboxRead = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ ids: z.array(z.uuid()).max(100).nullable() })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await alerts.markRead(context, data.ids);
		return { ok: true };
	});

/** The followed series' episodes in the next 14 days, from today in the viewer's zone. */
export const getPardaFollowing = createServerFn({ method: "GET" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ locale })))
	.handler(
		({ data, context }): Promise<FollowingSchedule> => alerts.followingSchedule(context, data.locale, viewerToday()),
	);
