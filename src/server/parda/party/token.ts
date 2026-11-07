import "@tanstack/react-start/server-only";
import { createHmac } from "node:crypto";
import type { PartyConnection } from "@/features/parda/party/types";
import { serverEnv } from "@/server/env";

/**
 * The party's channel token (PLAN 12.5, "Realtime"; decision 0243): an Ably JWT, signed here
 * with the key's secret, so the key stays on the server and no server SDK is needed. It can
 * only reach this party's channel, under the member's id, for half an hour; renewing it
 * goes through the server, which checks the party is still alive and the caller still in it.
 */

export const PARTY_TOKEN_TTL_S = 1_800;

export type PartyRealtime = {
	/** `appId.keyId:secret`. */
	key: string;
	/** The e2e stand-in's address; null is the real service. */
	relayUrl: string | null;
};

/** Null without PARDA_REALTIME_KEY: the party's UI is hidden and its functions answer 404. */
export function partyRealtime(): PartyRealtime | null {
	const key = serverEnv.PARDA_REALTIME_KEY;
	return key ? { key, relayUrl: serverEnv.PARDA_REALTIME_URL ?? null } : null;
}

export const partyChannel = (code: string) => `parda-party:${code}`;

const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function mintPartyToken(key: string, party: { code: string; memberId: string }, now = Date.now()): string {
	const [keyName = "", secret = ""] = key.split(":");
	const issued = Math.floor(now / 1000);
	const head = encoded({ typ: "JWT", alg: "HS256", kid: keyName });
	const claims = encoded({
		iat: issued,
		exp: issued + PARTY_TOKEN_TTL_S,
		"x-ably-capability": JSON.stringify({ [partyChannel(party.code)]: ["publish", "subscribe", "presence"] }),
		"x-ably-clientId": party.memberId,
	});
	const signature = createHmac("sha256", secret).update(`${head}.${claims}`).digest("base64url");
	return `${head}.${claims}.${signature}`;
}

export const partyConnection = (
	realtime: PartyRealtime,
	party: { code: string; memberId: string },
	now?: number,
): PartyConnection => ({
	token: mintPartyToken(realtime.key, party, now),
	channel: partyChannel(party.code),
	clientId: party.memberId,
	relayUrl: realtime.relayUrl,
});
