import { createServerFn } from "@tanstack/react-start";
import type { ChaalConnection } from "@/features/chaal/schema";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as connect from "@/server/chaal/connect/service";

/**
 * The caller's Lichess connection (Task 71, decision 0256): what it is (never the token),
 * and disconnecting it. Anyone with a session, guests included; each acts on the caller's
 * own connection only (tests/server/chaal-access.test.ts). Connecting itself is a redirect
 * through /api/chaal/oauth/start, not a function.
 */

export const getChaalConnection = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<ChaalConnection | null> => connect.connectionView(context, context.user.id));

export const disconnectChaal = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<void> => connect.disconnect(context, context.user.id));
