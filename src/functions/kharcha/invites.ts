import { createServerFn } from "@tanstack/react-start";
import { inviteInput, joinTokenInput } from "@/features/kharcha/schema";
import type { InviteResult, JoinedInvite } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as invites from "@/server/kharcha/invites/service";

/**
 * Kharcha's invites (docs/guides/kharcha.md "Invites and joining", decision 0284): signed in,
 * never a guest (the service refuses one), 20 a day; a friend the caller doesn't have is not
 * found. Taking an invite is the confirm on `/join/$token`; looking one up before signing in
 * is `src/functions/kharcha/join.ts`.
 */

export const inviteKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(inviteInput))
	.handler(({ data, context }): Promise<InviteResult> => invites.inviteFriend(context, data));

export const acceptKharchaInvite = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(joinTokenInput))
	.handler(({ data, context }): Promise<JoinedInvite> => invites.acceptInvite(context, data.token));
