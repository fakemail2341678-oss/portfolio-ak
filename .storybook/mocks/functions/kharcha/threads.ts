import { fn } from "storybook/test";
import type { FriendThread, GroupThread, PeoplePage } from "../../../../src/features/kharcha/types";
import { sampleKharchaFriendThread, sampleKharchaGroupThread, sampleKharchaPeople } from "../../kharcha";

// Stand-ins for src/functions/kharcha/threads.ts.
export const listKharchaPeople = fn(async (): Promise<PeoplePage> => sampleKharchaPeople).mockName("listKharchaPeople");
export const getKharchaGroupThread = fn(async (): Promise<GroupThread> => sampleKharchaGroupThread).mockName(
	"getKharchaGroupThread",
);
export const getKharchaFriendThread = fn(async (): Promise<FriendThread> => sampleKharchaFriendThread).mockName(
	"getKharchaFriendThread",
);
