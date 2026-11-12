import { createServerFn } from "@tanstack/react-start";
import {
	archiveGroupInput,
	createGroupInput,
	groupIdInput,
	groupMemberInput,
	newGroupMemberInput,
	updateGroupInput,
} from "@/features/kharcha/schema";
import type { GroupSummary, GroupView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as groups from "@/server/kharcha/groups/service";

/**
 * Kharcha's groups and their members (docs/guides/kharcha.md): anyone signed in, guests
 * included (`requireKharchaUser`); the service resolves the group and the caller's place
 * in it (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const listKharchaGroups = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.handler(({ context }): Promise<GroupSummary[]> => groups.listGroups(context));

export const getKharchaGroup = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupIdInput))
	.handler(({ data, context }): Promise<GroupView> => groups.getGroup(context, data.groupId));

export const createKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createGroupInput))
	.handler(({ data, context }): Promise<GroupView> => groups.createGroup(context, data));

export const updateKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateGroupInput))
	.handler(({ data, context }): Promise<GroupView> => groups.updateGroup(context, data));

export const archiveKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(archiveGroupInput))
	.handler(({ data, context }): Promise<GroupView> => groups.archiveGroup(context, data.groupId, data.archived));

export const addKharchaGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupMemberInput))
	.handler(({ data, context }): Promise<GroupView> => groups.addMember(context, data.groupId, data.personId));

export const addKharchaNewGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(newGroupMemberInput))
	.handler(({ data, context }): Promise<GroupView> => groups.addNewMember(context, data));

export const removeKharchaGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupMemberInput))
	.handler(({ data, context }): Promise<GroupView> => groups.removeMember(context, data.groupId, data.personId));

export const leaveKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupIdInput))
	.handler(({ data, context }): Promise<void> => groups.leaveGroup(context, data.groupId));
