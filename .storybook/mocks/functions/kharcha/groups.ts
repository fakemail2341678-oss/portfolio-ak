import { fn } from "storybook/test";
import type { GroupSummary, GroupView } from "../../../../src/features/kharcha/types";
import { sampleKharchaGroup, sampleKharchaGroups } from "../../kharcha";

// Stand-ins for src/functions/kharcha/groups.ts.
const group = async (): Promise<GroupView> => sampleKharchaGroup;
export const listKharchaGroups = fn(async (): Promise<GroupSummary[]> => sampleKharchaGroups).mockName(
	"listKharchaGroups",
);
export const getKharchaGroup = fn(group).mockName("getKharchaGroup");
export const createKharchaGroup = fn(group).mockName("createKharchaGroup");
export const updateKharchaGroup = fn(group).mockName("updateKharchaGroup");
export const archiveKharchaGroup = fn(group).mockName("archiveKharchaGroup");
export const addKharchaGroupMember = fn(group).mockName("addKharchaGroupMember");
export const addKharchaNewGroupMember = fn(group).mockName("addKharchaNewGroupMember");
export const removeKharchaGroupMember = fn(group).mockName("removeKharchaGroupMember");
export const leaveKharchaGroup = fn(async (): Promise<void> => {}).mockName("leaveKharchaGroup");
