import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { clientIpHash, trustedClientIp } from "../auth/client-ip";
import { serverEnv } from "../env";
import { createOutbound, type Outbound } from "./outbound";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's host only, 5 s, sent once (src/server/http/outbound.ts). */
const turnstile = createOutbound({ service: "turnstile", bases: [SITEVERIFY], timeoutMs: 5_000 });

/**
 * Checks a Turnstile token for a form of your own (Better Auth's captcha plugin
 * covers the auth endpoints, decision 0128). Tokens are single-use and expire
 * after five minutes. Recipe: docs/guides/recipes.md, "Contact form".
 */
export async function verifyTurnstile(
	secret: string,
	token: string | undefined,
	ip: string | undefined,
	fetcher: Outbound | typeof fetch = turnstile,
): Promise<boolean> {
	if (!token) return false;
	const body = new URLSearchParams({ secret, response: token });
	if (ip) body.set("remoteip", ip);
	try {
		const response = await fetcher(SITEVERIFY, { method: "POST", body });
		const result = (await response.json()) as { success?: unknown };
		return result.success === true;
	} catch {
		// Cloudflare unreachable: refuse rather than let the form through unchecked.
		return false;
	}
}

/**
 * What a public form's service needs from the request it came in (the contact form, a
 * published survey): the client's address for a rate limit, its keyed hash to store, and
 * the captcha check when Turnstile is configured (null: there is none).
 */
export const publicFormGuards = () => {
	const ip = trustedClientIp(getRequest());
	const secret = serverEnv.TURNSTILE_SECRET_KEY;
	return {
		ip,
		ipHash: clientIpHash(ip),
		verifyCaptcha: secret ? (token: string | undefined) => verifyTurnstile(secret, token, ip) : null,
	};
};
