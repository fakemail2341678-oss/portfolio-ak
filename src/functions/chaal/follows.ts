import { createServerFn } from "@tanstack/react-start";
import { type FollowedPlayer, followInput } from "@/features/chaal/players/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as players from "@/server/chaal/players/service";

/**
 * Following players on Lichess (Task 81, decision 0271): the players the user follows, and
 * following or unfollowing one, with their own token (`follow:read`, `follow:write`, the
 * `social` switch). Anyone with a session, guests included; each acts with the caller's
 * own token only (tests/server/chaal-access.test.ts).
 */

export const getChaalFollowing = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<FollowedPlayer[]> => players.following(context, context.user.id));

export const followChaalPlayer = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(followInput))
	.handler(
		({ context, data }): Promise<void> => players.setFollowing(context, context.user.id, data.username, data.follow),
	);
