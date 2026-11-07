/**
 * GET /api/chaal/stream/events: the signed-in user's Lichess event stream, through our
 * server (src/server/chaal/stream.ts, decision 0256). A Nitro route: it streams for minutes,
 * outside the client route tree. The game and seek streams join it with online play (Task 77).
 */
import { defineHandler } from "nitro";
import { auth } from "../auth/auth";
import { chaalConnectDeps } from "../chaal/store";
import { eventStream } from "../chaal/stream";

export default defineHandler(async (event) => {
	const session = await auth.api.getSession({ headers: event.req.headers });
	const user = session ? { id: session.user.id, isGuest: session.user.isAnonymous === true } : null;
	return eventStream(await chaalConnectDeps(), user);
});
