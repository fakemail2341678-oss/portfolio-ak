import { createServerFn } from "@tanstack/react-start";
import { groupIdInput, peopleInput, personIdInput } from "@/features/kharcha/schema";
import type { FriendThread, GroupThread, PeoplePage } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as threads from "@/server/kharcha/threads/service";

/**
 * Kharcha's people page and threads (docs/guides/kharcha.md "People and threads"): anyone
 * signed in, guests included; a group the caller was never in, or someone who isn't their
 * friend, is not found (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const listKharchaPeople = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(peopleInput))
	.handler(({ data, context }): Promise<PeoplePage> => threads.listPeople(context, data));

export const getKharchaGroupThread = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupIdInput))
	.handler(({ data, context }): Promise<GroupThread> => threads.getGroupThread(context, data.groupId));

export const getKharchaFriendThread = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(personIdInput))
	.handler(({ data, context }): Promise<FriendThread> => threads.getFriendThread(context, data.personId));
