/**
 * Chaal's streams through our server (src/server/chaal/stream.ts, decisions 0256 and 0266),
 * Nitro routes that stream for minutes outside the client route tree:
 * - GET /api/chaal/stream/events: the signed-in user's Lichess event stream;
 * - GET /api/chaal/stream/game/{id}: a game they play, through the Board API (Task 77);
 * - POST /api/chaal/stream/challenge: a real-time challenge kept open while it waits (Task 77).
 * The seek stream joins with quick pairing (Task 78).
 */
import { defineHandler } from "nitro";
import { auth } from "../auth/auth";
import { chaalConnectDeps } from "../chaal/store";
import { challengeStream, eventStream, gameStream, sameOrigin } from "../chaal/stream";

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});

/** A challenge's form is small: anything bigger isn't one. */
const MAX_BODY = 2_048;

export default defineHandler(async (event) => {
	const { pathname } = new URL(event.req.url);
	const session = await auth.api.getSession({ headers: event.req.headers });
	const user = session ? { id: session.user.id, isGuest: session.user.isAnonymous === true } : null;
	if (pathname === "/api/chaal/stream/events") return eventStream(await chaalConnectDeps(), user);
	const game = /^\/api\/chaal\/stream\/game\/([^/]+)$/.exec(pathname);
	if (game?.[1]) return gameStream(await chaalConnectDeps(), user, game[1]);
	if (pathname === "/api/chaal/stream/challenge") {
		if (event.req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
		if (!sameOrigin(event.req.headers, event.req.url)) return json(403, { error: "FORBIDDEN" });
		const text = await event.req.text();
		if (text.length > MAX_BODY) return json(400, { error: "BAD_REQUEST" });
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return json(400, { error: "BAD_REQUEST" });
		}
		return challengeStream(await chaalConnectDeps(), user, body);
	}
	return json(404, { error: "NOT_FOUND" });
});
