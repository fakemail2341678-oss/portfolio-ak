import "@tanstack/react-start/server-only";
import { z } from "zod";
import { CHAAL_OAUTH_CALLBACK, CONNECT_RESULT_PARAM, type ConnectResult, safeReturnPath } from "@/features/chaal/links";
import type { Vault } from "./vault";

/**
 * Lichess's OAuth (PLAN 13.4 and 13.5; decision 0256): the authorization code flow with
 * PKCE (`S256` only), a public client with no secret. The state, the code verifier, who
 * started it, where to return and the scopes asked for travel in a sealed, HttpOnly,
 * SameSite=Lax cookie for 10 minutes, never in the URL.
 */

export const OAUTH_COOKIE = "ch_oauth";
export const OAUTH_TTL_SECONDS = 600;
/** The cookie is sent only to the two OAuth routes. */
export const OAUTH_COOKIE_PATH = "/api/chaal/oauth";

const randomUrlSafe = (bytes: number) =>
	Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

/** 32 random bytes: a 43-character verifier (RFC 7636 allows 43–128). */
export const newVerifier = () => randomUrlSafe(32);
export const newState = () => randomUrlSafe(16);

/** `BASE64URL(SHA256(code_verifier))`, as Lichess asks. */
export async function challengeOf(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return Buffer.from(new Uint8Array(digest)).toString("base64url");
}

export const pendingSchema = z.object({
	state: z.string().min(16),
	verifier: z.string().min(43).max(128),
	userId: z.string().min(1),
	returnTo: z.string(),
	scopes: z.array(z.string()),
	/** When it started, in ms. */
	at: z.number(),
});
export type OAuthPending = z.infer<typeof pendingSchema>;

export const sealPending = (vault: Vault, pending: OAuthPending) => vault.seal(JSON.stringify(pending), "oauth-state");

/** The pending flow from the cookie, or null when there's none, it was changed, or it's older than 10 minutes. */
export async function openPending(vault: Vault, cookie: string | undefined, now: number): Promise<OAuthPending | null> {
	if (!cookie) return null;
	try {
		const parsed = pendingSchema.safeParse(JSON.parse(await vault.open(cookie, "oauth-state")));
		if (!parsed.success || now - parsed.data.at > OAUTH_TTL_SECONDS * 1000 || parsed.data.at > now + 60_000) {
			return null;
		}
		return { ...parsed.data, returnTo: safeReturnPath(parsed.data.returnTo) };
	} catch {
		return null;
	}
}

export type AuthorizeInput = {
	apiBase: string;
	clientId: string;
	redirectUri: string;
	challenge: string;
	state: string;
	scopes: ReadonlyArray<string>;
};

/** Where the browser goes to approve: Lichess's `/oauth` page. */
export function authorizeUrl({ apiBase, clientId, redirectUri, challenge, state, scopes }: AuthorizeInput): string {
	const url = new URL(`${apiBase.replace(/\/$/, "")}/oauth`);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("code_challenge", challenge);
	if (scopes.length > 0) url.searchParams.set("scope", scopes.join(" "));
	url.searchParams.set("state", state);
	return url.toString();
}

/** The callback's address: this app's origin, so Lichess sends the browser back here. */
export const redirectUriFor = (appUrl: string) => new URL(CHAAL_OAUTH_CALLBACK, appUrl).toString();

/** The return path with the outcome added (`?lichess=connected`), replacing an earlier one. */
export function withResult(returnTo: string, result: ConnectResult): string {
	const url = new URL(safeReturnPath(returnTo), "http://chaal.invalid");
	url.searchParams.set(CONNECT_RESULT_PARAM, result);
	return `${url.pathname}${url.search}${url.hash}`;
}

/** The callback's query: a code, or Lichess's error; and the state either way. */
export const callbackQuery = z.object({
	code: z.string().min(1).max(512).optional(),
	state: z.string().max(256).optional(),
	error: z.string().max(128).optional(),
});
export type CallbackQuery = z.infer<typeof callbackQuery>;
