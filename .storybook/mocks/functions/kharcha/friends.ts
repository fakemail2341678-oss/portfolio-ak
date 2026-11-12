import { fn } from "storybook/test";
import type { FriendView } from "../../../../src/features/kharcha/types";
import { sampleKharchaFriends } from "../../kharcha";

// Stand-ins for src/functions/kharcha/friends.ts.
const [first] = sampleKharchaFriends;
const friend = async (): Promise<FriendView> => {
	if (!first) throw new Error("no sample friend");
	return first;
};
export const listKharchaFriends = fn(async (): Promise<FriendView[]> => sampleKharchaFriends).mockName(
	"listKharchaFriends",
);
export const getKharchaFriend = fn(friend).mockName("getKharchaFriend");
export const addKharchaFriend = fn(friend).mockName("addKharchaFriend");
export const updateKharchaFriend = fn(friend).mockName("updateKharchaFriend");
export const setKharchaFriendEmail = fn(friend).mockName("setKharchaFriendEmail");
