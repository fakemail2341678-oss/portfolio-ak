import { createServerFn } from "@tanstack/react-start";
import { addFriendInput, personIdInput, updateFriendInput } from "@/features/kharcha/schema";
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

export const getKharchaFriend = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(personIdInput))
	.handler(({ data, context }): Promise<FriendView> => friends.getFriend(context, data.personId));

export const addKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(addFriendInput))
	.handler(({ data, context }): Promise<FriendView> => friends.addFriend(context, data));

export const updateKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateFriendInput))
	.handler(({ data, context }): Promise<FriendView> => friends.updateFriend(context, data));
