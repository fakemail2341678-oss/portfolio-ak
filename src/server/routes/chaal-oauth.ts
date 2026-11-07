/**
 * GET /api/chaal/oauth/start?return=… and GET /api/chaal/oauth/callback: connecting a
 * Lichess account to the session's user, guest or member (PLAN 13.5, decision 0256).
 * Nitro routes, outside the client route tree. Start needs a session (a Chaal page starts
 * a scoped guest first); its state and code verifier travel in a sealed HttpOnly cookie
 * for 10 minutes. Both end in a redirect to the return path with `?lichess=<result>`.
 */
import { defineHandler } from "nitro";
import { safeReturnPath } from "../../features/chaal/links";
import { auth } from "../auth/auth";
import {
	callbackQuery,
	OAUTH_COOKIE,
	OAUTH_COOKIE_PATH,
	OAUTH_TTL_SECONDS,
	openPending,
	redirectUriFor,
	withResult,
} from "../chaal/connect/oauth";
import { type ChaalUser, completeConnect, startConnect } from "../chaal/connect/service";
import { chaalConnectDeps } from "../chaal/store";
import { serverEnv } from "../env";
import { log } from "../log";

const secure = serverEnv.BETTER_AUTH_URL.startsWith("https:");

const cookieHeader = (value: string, maxAge: number) =>
	[
		`${OAUTH_COOKIE}=${value}`,
		`Path=${OAUTH_COOKIE_PATH}`,
		`Max-Age=${maxAge}`,
		"HttpOnly",
		"SameSite=Lax",
		...(secure ? ["Secure"] : []),
	].join("; ");

const readCookie = (header: string | null, name: string) =>
	header
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name}=`))
		?.slice(name.length + 1);

const redirect = (location: string, cookie?: string) =>
	new Response(null, {
		status: 302,
		headers: { location, "cache-control": "no-store", ...(cookie ? { "set-cookie": cookie } : {}) },
	});

async function sessionUser(headers: Headers): Promise<ChaalUser | null> {
	const session = await auth.api.getSession({ headers });
	return session ? { id: session.user.id, isGuest: session.user.isAnonymous === true } : null;
}

export default defineHandler(async (event) => {
	const url = new URL(event.req.url);
	const deps = await chaalConnectDeps();
	const redirectUri = redirectUriFor(serverEnv.BETTER_AUTH_URL);
	const clientId = serverEnv.LICHESS_CLIENT_ID;
	const user = await sessionUser(event.req.headers);

	if (url.pathname.endsWith("/start")) {
		const returnTo = safeReturnPath(url.searchParams.get("return"));
		if (!user) return redirect(withResult(returnTo, "no-session"));
		const start = await startConnect(deps, user, { returnTo, redirectUri, clientId });
		if (start.kind === "refused") return redirect(withResult(returnTo, start.result));
		return redirect(start.location, cookieHeader(start.cookie, OAUTH_TTL_SECONDS));
	}

	// The callback: the cookie is spent whatever happens.
	const clear = cookieHeader("", 0);
	const pending = deps.vault
		? await openPending(deps.vault, readCookie(event.req.headers.get("cookie"), OAUTH_COOKIE), Date.now())
		: null;
	const returnTo = pending?.returnTo ?? safeReturnPath(null);
	if (!user) return redirect(withResult(returnTo, "no-session"), clear);
	const query = callbackQuery.safeParse(Object.fromEntries(url.searchParams));
	const result = query.success
		? await completeConnect(deps, user, { query: query.data, pending, redirectUri, clientId })
		: "failed";
	log("info", "chaal connect result", { result });
	return redirect(withResult(returnTo, result), clear);
});
