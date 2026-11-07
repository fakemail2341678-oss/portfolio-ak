import type { WatchPageData } from "../player/watch-types";

/** What the party's functions return (PLAN 12.5, "Watch party"; decision 0243). */

export type PartyState = "lobby" | "playing" | "paused" | "ended";

/** How to reach the party's channel. `relayUrl` is the e2e stand-in; null is the real service. */
export type PartyConnection = {
	token: string;
	channel: string;
	/** The member's id, which everyone in the channel knows them by. */
	clientId: string;
	relayUrl: string | null;
};

/** The state saved for late joiners and reloads; `at` is server time in ms. */
export type PartySnapshot = { state: PartyState; position: number; at: number };

export type PartyPageData =
	| { configured: false }
	| {
			configured: true;
			code: string;
			hostName: string;
			sourceId: string | null;
			snapshot: PartySnapshot;
			watch: Extract<WatchPageData, { configured: true }>;
	  };

export type PartyJoin = {
	memberId: string;
	name: string;
	/** Server time in ms: the longest-present member takes over from a host who left. */
	joinedAt: number;
	hostMemberId: string;
	sourceId: string | null;
	snapshot: PartySnapshot;
	connection: PartyConnection;
	now: number;
};

export type PartyPulse = { now: number; hostMemberId: string };
