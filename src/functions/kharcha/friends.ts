import { createServerFn } from "@tanstack/react-start";
import { addFriendInputSchema, friendEmailInputSchema, updateFriendInputSchema } from "@/features/kharcha/schema";
import type { FriendView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as friends from "@/server/kharcha/friends/service";

/**
 * Kharcha's friends (docs/guides/kharcha.md): anyone signed in, guests included
 * (`requireKharchaUser`); a person who isn't the caller's friend is not found
 * (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const listKharchaFriends = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<FriendView[]> => friends.listFriends(context));

export const addKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(addFriendInputSchema))
	.handler(({ data, context }): Promise<FriendView> => friends.addFriend(context, data));

export const updateKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateFriendInputSchema))
	.handler(({ data, context }): Promise<FriendView> => friends.updateFriend(context, data));

export const setKharchaFriendEmail = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(friendEmailInputSchema))
	.handler(({ data, context }): Promise<FriendView> => friends.setFriendEmail(context, data));
