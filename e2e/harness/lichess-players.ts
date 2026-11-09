/**
 * The fake Lichess's players (Task 81, decision 0271), for e2e. Profiles, leaderboards, the
 * history, details, activity, games and the search are recordings (`pnpm lichess:record
 * players`); this adds what needs an account:
 *
 * - `POST /api/rel/follow/{username}` and `/unfollow/{username}` (`follow:write`): remembered
 *   per account.
 * - `GET /api/rel/following` (`follow:read`): the followed players, as ndjson.
 * - `GET /api/user/{username}` with a token: the recording, plus `following`.
 * - `GET /api/crosstable/{a}/{b}`: no games between them.
 *
 * Test control: `GET /e2e/lichess/following?account=` lists whom an account follows.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

type Json = (response: ServerResponse, status: number, body: unknown) => void;

export function createPlayers({
	read,
	json,
	recordedName,
}: {
	read: (name: string) => string | undefined;
	json: Json;
	/** The recording's file name for an api path (`lichessFixtureName`). */
	recordedName: (pathname: string) => string;
}) {
	const follows = new Map<string, Set<string>>();
	const followed = (account: string) => {
		let set = follows.get(account);
		if (!set) {
			set = new Set();
			follows.set(account, set);
		}
		return set;
	};

	return {
		reset: () => follows.clear(),
		control(route: string, url: URL, response: ServerResponse): boolean {
			if (route !== "GET /e2e/lichess/following") return false;
			json(response, 200, { following: [...followed(url.searchParams.get("account") ?? "")] });
			return true;
		},
		/** Answers a players' path, or returns false for the recordings to answer. */
		serve(pathname: string, request: IncomingMessage, response: ServerResponse, account: string | null): boolean {
			const follow = pathname.match(/^\/api\/rel\/(follow|unfollow)\/([\w-]+)$/);
			if (follow && request.method === "POST") {
				if (!account) {
					json(response, 401, { error: "No such token" });
					return true;
				}
				const name = (follow[2] as string).toLowerCase();
				if (follow[1] === "follow") followed(account).add(name);
				else followed(account).delete(name);
				json(response, 200, { ok: true });
				return true;
			}
			if (pathname === "/api/rel/following" && request.method === "GET") {
				if (!account) {
					json(response, 401, { error: "No such token" });
					return true;
				}
				response.writeHead(200, { "content-type": "application/x-ndjson" });
				response.end(
					[...followed(account)].map((id) => `${JSON.stringify({ id, username: id, online: false })}\n`).join(""),
				);
				return true;
			}
			const crosstable = pathname.match(/^\/api\/crosstable\/([\w-]+)\/([\w-]+)$/);
			if (crosstable && request.method === "GET") {
				json(response, 200, { users: { [crosstable[1] as string]: 0, [crosstable[2] as string]: 0 }, nbGames: 0 });
				return true;
			}
			const user = pathname.match(/^\/api\/user\/([\w-]+)$/);
			if (user && account && request.method === "GET") {
				const body = read(recordedName(pathname));
				if (body === undefined) {
					json(response, 404, { error: "Not found" });
					return true;
				}
				const id = (user[1] as string).toLowerCase();
				json(response, 200, { ...(JSON.parse(body) as object), following: followed(account).has(id) });
				return true;
			}
			return false;
		},
	};
}
