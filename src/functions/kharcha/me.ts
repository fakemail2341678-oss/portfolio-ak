import { createServerFn } from "@tanstack/react-start";
import type { KharchaBalances, KharchaMe } from "@/features/kharcha/types";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as me from "@/server/kharcha/me/service";

/**
 * The caller in Kharcha (docs/guides/kharcha.md): anyone signed in, guests included
 * (`requireKharchaUser`). Their person is made on first use.
 */

export const getKharchaMe = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaMe> => me.getMe(context));

/** Polled by open pages: a change that touches the caller moves it. */
export const getKharchaRev = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<number> => me.getRev(context));

export const getKharchaBalances = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<KharchaBalances> => me.getBalances(context));
