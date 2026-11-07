import { fn } from "storybook/test";
import type { PartyConnection, PartyJoin, PartyPulse } from "../../../../src/features/parda/party/types";

// Stand-ins for src/functions/parda/party.ts: no realtime service in the workshop.
const connection: PartyConnection = { token: "", channel: "", clientId: "", relayUrl: null };

export const createPardaParty = fn(async () => ({ code: "" })).mockName("createPardaParty");
export const joinPardaParty = fn(
	async (): Promise<PartyJoin> => ({
		memberId: "",
		name: "",
		joinedAt: 0,
		hostMemberId: "",
		sourceId: null,
		snapshot: { state: "lobby", position: 0, at: 0 },
		connection,
		now: 0,
	}),
).mockName("joinPardaParty");
export const getPardaPartyToken = fn(async (): Promise<PartyConnection> => connection).mockName("getPardaPartyToken");
export const pulsePardaParty = fn(async (): Promise<PartyPulse> => ({ now: 0, hostMemberId: "" })).mockName(
	"pulsePardaParty",
);
export const leavePardaParty = fn(async () => ({ ok: true as const })).mockName("leavePardaParty");
export const setPardaPartySource = fn(async () => ({ ok: true as const })).mockName("setPardaPartySource");
export const takeOverPardaParty = fn(async () => ({ hostMemberId: "" })).mockName("takeOverPardaParty");
export const endPardaParty = fn(async () => ({ ok: true as const })).mockName("endPardaParty");
