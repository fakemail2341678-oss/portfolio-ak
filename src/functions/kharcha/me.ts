import { createServerFn } from "@tanstack/react-start";
import { onboardingInput, profileInput } from "@/features/kharcha/schema";
import type { KharchaBalances, KharchaHome, KharchaMe, KharchaPulse } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as home from "@/server/kharcha/home/service";
import * as me from "@/server/kharcha/me/service";

/**
 * The caller in Kharcha (docs/guides/kharcha.md): anyone signed in, guests included
 * (`requireKharchaUser`). Their person is made on first use.
 */

export const getKharchaMe = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaMe> => me.getMe(context));

/** Polled by open pages: a change that touches the caller moves its `rev`; `unread` is the bell's (Task 92). */
export const getKharchaRev = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaPulse> => me.getPulse(context));

export const getKharchaBalances = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaBalances> => me.getBalances(context));

/** Home: to-dos, totals, this month against last, recent activity. */
export const getKharchaHome = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaHome> => home.getHome(context));

export const completeKharchaOnboarding = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(onboardingInput))
	.handler(({ data, context }): Promise<void> => me.completeOnboarding(context, data));

/** Settings → Profile (Task 91): the home currency, the time zone and the pay note. */
export const updateKharchaProfile = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(profileInput))
	.handler(({ data, context }): Promise<KharchaMe> => me.updateProfile(context, data));
