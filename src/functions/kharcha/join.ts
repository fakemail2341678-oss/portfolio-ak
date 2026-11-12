import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { joinTokenInput } from "@/features/kharcha/schema";
import type { JoinInvite } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { withPublicServices } from "@/middleware/services";
import { clientIpHash, trustedClientIp } from "@/server/auth/client-ip";
import * as invites from "@/server/kharcha/invites/service";

/**
 * `/join/$token`'s lookup (PLAN 14.5 "Functions", decision 0284): anyone holding the link,
 * no session. It shows who sent it, the group it came from and whether it is still open,
 * nothing else; an unknown token is NOT_FOUND (the page's 404). Rate limited per visitor.
 */
export const getKharchaInvite = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(joinTokenInput))
	.handler(
		({ data, context }): Promise<JoinInvite> =>
			invites.lookupInvite(context, data.token, clientIpHash(trustedClientIp(getRequest()))),
	);
