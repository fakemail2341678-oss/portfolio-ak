import { fn } from "storybook/test";
import type { FollowedPlayer } from "../../../../src/features/chaal/players/schema";

// Stand-ins for src/functions/chaal/follows.ts: a player who follows two others.
export const followingList: FollowedPlayer[] = [
	{ id: "north_star", username: "North_Star", title: "GM", online: true },
	{ id: "pokhara64", username: "Pokhara64", title: null, online: false },
];

export const getChaalFollowing = fn(async (): Promise<FollowedPlayer[]> => followingList).mockName("getChaalFollowing");
export const followChaalPlayer = fn(async (): Promise<void> => {}).mockName("followChaalPlayer");
