/**
 * Chaal's streams through our server (src/server/chaal/stream.ts, decisions 0256, 0266 and
 * 0267), Nitro routes that stream for minutes outside the client route tree:
 * - GET /api/chaal/stream/events: the signed-in user's Lichess event stream;
 * - GET /api/chaal/stream/game/{id}: a game they play, through the Board API (Task 77);
 * - POST /api/chaal/stream/challenge: a real-time challenge kept open while it waits (Task 77);
 * - POST /api/chaal/stream/seek: a seek in the lobby on a clock, open while it waits (Task 78).
 */
import { AppError } from "@/lib/errors";
import { chaalConnectDeps } from "../chaal/store";
import { challengeStream, eventStream, gameStream, seekStream } from "../chaal/stream";
import { defineApiRoute } from "../http/api-route";

/** The streams a page opens with a POST of JSON: from our own pages only. */
const POSTED = { "/api/chaal/stream/challenge": challengeStream, "/api/chaal/stream/seek": seekStream } as const;
const isPosted = (pathname: string): pathname is keyof typeof POSTED => pathname in POSTED;

export default defineApiRoute({
	name: "chaal-stream",
	methods: ["GET", "POST"],
	// The stream itself says "sign in" to a visitor without a session: an event, not a 401.
	auth: "optional",
	sameOrigin: true,
	// A challenge's or a seek's form is small: anything bigger isn't one.
	bodyLimit: 2_048,
	// A stream stays open for minutes.
	timeoutMs: false,
	handler: async ({ request, url, user, json }) => {
		const { pathname } = url;
		if (isPosted(pathname)) {
			if (request.method !== "POST") throw new AppError("METHOD_NOT_ALLOWED", `${pathname} takes a POST`);
			return POSTED[pathname](await chaalConnectDeps(), user, await json());
		}
		if (request.method !== "GET") throw new AppError("METHOD_NOT_ALLOWED", `${pathname} takes a GET`);
		if (pathname === "/api/chaal/stream/events") return eventStream(await chaalConnectDeps(), user);
		const game = /^\/api\/chaal\/stream\/game\/([^/]+)$/.exec(pathname);
		if (game?.[1]) return gameStream(await chaalConnectDeps(), user, game[1]);
		throw new AppError("NOT_FOUND", "No such stream");
	},
}).nitro;
