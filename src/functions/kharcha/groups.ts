import { createServerFn } from "@tanstack/react-start";
import {
	archiveGroupInputSchema,
	createGroupInputSchema,
	groupIdInputSchema,
	groupMemberInputSchema,
	newGroupMemberInputSchema,
	updateGroupInputSchema,
} from "@/features/kharcha/schema";
import type { GroupSummary, GroupTotals, GroupView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as groups from "@/server/kharcha/groups/service";
import * as totals from "@/server/kharcha/groups/totals";

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
	.validator(zodInput(groupIdInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.getGroup(context, data.groupId));

export const createKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createGroupInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.createGroup(context, data));

export const updateKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateGroupInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.updateGroup(context, data));

export const setKharchaGroupArchived = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(archiveGroupInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.archiveGroup(context, data.groupId, data.archived));

export const addKharchaGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupMemberInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.addMember(context, data.groupId, data.personId));

export const addKharchaNewGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(newGroupMemberInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.addNewMember(context, data));

export const removeKharchaGroupMember = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupMemberInputSchema))
	.handler(({ data, context }): Promise<GroupView> => groups.removeMember(context, data.groupId, data.personId));

export const leaveKharchaGroup = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupIdInputSchema))
	.handler(({ data, context }): Promise<void> => groups.leaveGroup(context, data.groupId));

/** A group's Totals tab (Task 91): spent per member and the caller's share per category, per currency. */
export const getKharchaGroupTotals = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(groupIdInputSchema))
	.handler(({ data, context }): Promise<GroupTotals> => totals.getGroupTotals(context, data.groupId));
