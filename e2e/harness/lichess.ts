/**
 * Stands in for Lichess in e2e (decision 0255). The suite never calls Lichess: the
 * server under test points LICHESS_API_BASE, LICHESS_EXPLORER_BASE and
 * LICHESS_TABLEBASE_BASE here.
 *
 * - `/lichess/oauth`: an approval page (pick an account, Approve or Deny), then the code
 *   and state back to the redirect URI, as Lichess does. `/lichess/api/token` checks the
 *   PKCE verifier against the challenge, the redirect URI and the client id, and gives a
 *   token; DELETE revokes it.
 * - `/lichess/api/account`: the token's account; a revoked token gets a 401.
 * - `/lichess/api/stream/event`: the account's event stream. It opens with the account's
 *   current challenges and games, as Lichess restates them, then sends a keepalive every
 *   second. One stream per token, as Lichess: a new one closes the previous.
 * - Online play (Tasks 77 and 78, ./lichess-play.ts): challenges (kept open, open links, the
 *   AI), Board API games with clocks and a scripted AI, offers, endings and chat; seeks, the
 *   games in progress (`/api/account/playing`) and berserk in an arena game.
 * - Puzzles (Task 80, ./lichess-puzzles.ts): by id, batches (unseen ones for a token),
 *   posted solutions, the dashboard and replays, from a recorded pool.
 * - Everything else answers from tests/fixtures/lichess (`pnpm lichess:record`), by
 *   `lichessFixtureName`; the explorer asks for a token, as the real one does. A recorded
 *   stream (`.ndjson`: the player explorer, Task 75) is sent as ndjson and ends.
 *
 * Test controls: `POST /e2e/lichess/revoke` (every token of `{ account }`), `POST
 * /e2e/lichess/event` (`{ account, event }` to its open streams), `POST /e2e/lichess/drop`
 * (`{ account }`: its streams break), `GET /e2e/lichess/streams?account=` (how many it has
 * open), the rival's `POST /e2e/lichess/challenge`, `/respond` and `/act`, `GET
 * /e2e/lichess/games`, quick pairing's `POST /e2e/lichess/seek-accept`, `GET /e2e/lichess/seeks`
 * and `POST /e2e/lichess/arena` (Task 78), `GET /e2e/lichess/puzzle-solutions?account=` (Task 80),
 * and `DELETE /e2e/lichess`. Later tasks add the
 * rest (PLAN 13.5, "Fixtures").
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { type Account, createPlay } from "./lichess-play.ts";
import { createPlayers } from "./lichess-players.ts";
import { createPuzzles } from "./lichess-puzzles.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../../tests/fixtures/lichess");

/** The fake's accounts: the approval page offers both, so a flow can try one account on two site users. */
export const LICHESS_ACCOUNTS = {
	e2e_player: { id: "e2e_player", username: "E2E_Player", title: null },
	e2e_rival: { id: "e2e_rival", username: "E2E_Rival", title: "FM" },
} as const;
export type LichessAccountId = keyof typeof LICHESS_ACCOUNTS;

export type LichessHost = "api" | "explorer" | "tablebase";

/**
 * A recorded answer's file name, shared by `pnpm lichess:record`, this stand-in and the
 * tests: the host and path, then a short hash of the parameters when there are any (a FEN
 * is long, and Windows paths aren't).
 *
 *   api /api/puzzle/daily -> api_puzzle_daily.json
 *   tablebase /standard?fen=… -> tablebase_standard.3f9a1c02.json
 */
export function lichessFixtureName(host: LichessHost, pathname: string, params: Iterable<[string, string]> = []) {
	const sorted = [...params].sort(([a], [b]) => a.localeCompare(b));
	const base = `${host}_${pathname
		.replace(/^\/(api\/)?/, "")
		.replaceAll("/", "_")
		.replace(/[^\w-]/g, "")}`;
	if (sorted.length === 0) return `${base}.json`;
	const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 8);
	return `${base}.${hash}.json`;
}

/** A recorded file's text, or undefined. */
export function readLichessFixture(name: string): string | undefined {
	const file = path.join(FIXTURES, name);
	return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

type Grant = {
	account: LichessAccountId;
	scopes: string;
	challenge: string;
	redirectUri: string;
	clientId: string;
};
type Token = { account: LichessAccountId; scopes: string; revoked: boolean };

const codes = new Map<string, Grant>();
const tokens = new Map<string, Token>();
const streams = new Map<string, ServerResponse>();

/** Sends an event to every open event stream of the account. */
const emit = (account: Account, event: unknown) => {
	for (const [value, stream] of streams) {
		if (tokens.get(value)?.account === account) stream.write(`${JSON.stringify(event)}\n`);
	}
};
const play = createPlay({ emit });
const puzzles = createPuzzles({ read: (name) => readLichessFixture(name) });
// Defined below with the other helpers; called only while serving.
const players = createPlayers({
	read: (name) => readLichessFixture(name),
	json: (response, status, body) => json(response, status, body),
	recordedName: (pathname) => lichessFixtureName("api", pathname),
});

/** The fake's own address, as the links it gives out (an open challenge's) carry it. */
const baseOf = (request: IncomingMessage) => `http://${request.headers.host ?? "127.0.0.1"}/lichess`;

const json = (response: ServerResponse, status: number, body: unknown) => {
	response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
	response.end(JSON.stringify(body));
};

const readBody = async (request: IncomingMessage) => {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
};

const bearer = (request: IncomingMessage) => {
	const header = request.headers.authorization ?? "";
	return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
};

/** The token's record, when it's known and not revoked. */
const tokenOf = (request: IncomingMessage) => {
	const value = bearer(request);
	const token = value ? tokens.get(value) : undefined;
	return value && token && !token.revoked ? { value, token } : null;
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The approval page: a complete document, so a flow can click through it like Lichess's. */
function approvalPage(url: URL) {
	const fields = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "scope", "state"]
		.map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(url.searchParams.get(name) ?? "")}">`)
		.join("");
	const options = Object.values(LICHESS_ACCOUNTS)
		.map((account) => `<option value="${account.id}">${account.username}</option>`)
		.join("");
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Lichess: authorize</title><link rel="icon" href="data:,"></head>
<body><main><h1>Authorize ${escapeHtml(url.searchParams.get("client_id") ?? "")}</h1>
<p>Scopes: <span id="scopes">${escapeHtml(url.searchParams.get("scope") ?? "")}</span></p>
<form method="post" action="/lichess/oauth/approve">${fields}
<label>Account <select name="account">${options}</select></label>
<button type="submit" name="decision" value="approve">Approve</button>
<button type="submit" name="decision" value="deny">Deny</button>
</form></main></body></html>`;
}

const withQuery = (base: string, params: Record<string, string>) => {
	const url = new URL(base);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
};

const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

/** Restates the account's challenges and games, then a keepalive every second, until the stream is replaced or the client goes. */
function openEventStream(response: ServerResponse, value: string, account: Account, base: string) {
	streams.get(value)?.end();
	streams.set(value, response);
	response.writeHead(200, { "content-type": "application/x-ndjson", "access-control-allow-origin": "*" });
	for (const event of play.restate(account, base)) response.write(`${JSON.stringify(event)}\n`);
	const keepalive = setInterval(() => response.write("\n"), 1_000);
	response.on("close", () => {
		clearInterval(keepalive);
		if (streams.get(value) === response) streams.delete(value);
	});
}

const HOSTS: ReadonlyArray<[prefix: string, host: LichessHost]> = [
	["/lichess-explorer", "explorer"],
	["/lichess-tablebase", "tablebase"],
	["/lichess", "api"],
];

/** Answers a fake Lichess request or a test control; false when `url` is neither. */
export async function serveLichess(url: URL, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
	const route = `${request.method} ${url.pathname}`;

	if (route === "DELETE /e2e/lichess") {
		play.reset();
		puzzles.reset();
		players.reset();
		codes.clear();
		tokens.clear();
		for (const stream of streams.values()) stream.end();
		streams.clear();
		json(response, 200, { ok: true });
		return true;
	}
	if (route === "POST /e2e/lichess/revoke") {
		const { account } = JSON.parse((await readBody(request)) || "{}") as { account?: string };
		for (const token of tokens.values()) if (token.account === account) token.revoked = true;
		json(response, 200, { ok: true });
		return true;
	}
	if (route === "POST /e2e/lichess/event") {
		const { account, event } = JSON.parse((await readBody(request)) || "{}") as { account?: string; event?: unknown };
		let sent = 0;
		for (const [value, stream] of streams) {
			if (tokens.get(value)?.account === account) {
				stream.write(`${JSON.stringify(event)}\n`);
				sent += 1;
			}
		}
		json(response, 200, { sent });
		return true;
	}

	if (route === "POST /e2e/lichess/drop") {
		const { account } = JSON.parse((await readBody(request)) || "{}") as { account?: Account };
		for (const [value, stream] of streams) if (tokens.get(value)?.account === account) stream.destroy();
		if (account) play.drop(account);
		json(response, 200, { ok: true });
		return true;
	}
	if (route === "GET /e2e/lichess/streams") {
		const account = url.searchParams.get("account") as Account | null;
		const events = [...streams.keys()].filter((value) => tokens.get(value)?.account === account).length;
		json(response, 200, { events, games: account ? play.gameStreams(account) : 0 });
		return true;
	}
	if (puzzles.control(route, url, response)) return true;
	if (players.control(route, url, response)) return true;
	if (url.pathname.startsWith("/e2e/lichess/")) {
		const body =
			request.method === "POST" ? (JSON.parse((await readBody(request)) || "{}") as Record<string, unknown>) : {};
		if (await play.control(route, body, response, baseOf(request))) return true;
	}

	const match = HOSTS.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
	if (!match) return false;
	const [prefix, host] = match;
	const pathname = url.pathname.slice(prefix.length) || "/";

	if (host === "api" && route === "GET /lichess/oauth") {
		response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		response.end(approvalPage(url));
		return true;
	}
	if (host === "api" && route === "POST /lichess/oauth/approve") {
		const form = new URLSearchParams(await readBody(request));
		const redirectUri = form.get("redirect_uri") ?? "";
		const state = form.get("state") ?? "";
		if (form.get("decision") !== "approve") {
			response.writeHead(302, { location: withQuery(redirectUri, { error: "access_denied", state }) });
			response.end();
			return true;
		}
		const code = `liu_${randomBytes(12).toString("base64url")}`;
		const account = (form.get("account") ?? "e2e_player") as LichessAccountId;
		codes.set(code, {
			account: account in LICHESS_ACCOUNTS ? account : "e2e_player",
			scopes: (form.get("scope") ?? "").split(" ").filter(Boolean).join(","),
			challenge: form.get("code_challenge") ?? "",
			redirectUri,
			clientId: form.get("client_id") ?? "",
		});
		response.writeHead(302, { location: withQuery(redirectUri, { code, state }) });
		response.end();
		return true;
	}
	if (host === "api" && route === "POST /lichess/api/token") {
		const form = new URLSearchParams(await readBody(request));
		const grant = codes.get(form.get("code") ?? "");
		codes.delete(form.get("code") ?? "");
		if (
			!grant ||
			form.get("grant_type") !== "authorization_code" ||
			challengeOf(form.get("code_verifier") ?? "") !== grant.challenge ||
			form.get("redirect_uri") !== grant.redirectUri ||
			form.get("client_id") !== grant.clientId
		) {
			json(response, 400, { error: "invalid_grant", error_description: "fake lichess refused the exchange" });
			return true;
		}
		const value = `lio_${randomBytes(18).toString("base64url").replace(/-/g, "_")}`;
		tokens.set(value, { account: grant.account, scopes: grant.scopes, revoked: false });
		json(response, 200, { token_type: "Bearer", access_token: value, expires_in: 31_536_000 });
		return true;
	}
	if (host === "api" && route === "DELETE /lichess/api/token") {
		const known = tokenOf(request);
		if (known) known.token.revoked = true;
		response.writeHead(204);
		response.end();
		return true;
	}
	if (host === "api" && route === "GET /lichess/api/account") {
		const known = tokenOf(request);
		if (!known) {
			json(response, 401, { error: "No such token" });
			return true;
		}
		const account = LICHESS_ACCOUNTS[known.token.account];
		json(response, 200, {
			...account,
			// The ratings a seek's range is read around (Task 78).
			perfs: { rapid: { rating: 1600, games: 12 }, classical: { rating: 1650, games: 3 } },
			createdAt: 1_700_000_000_000,
			url: `https://lichess.org/@/${account.username}`,
		});
		return true;
	}
	if (host === "api" && route === "GET /lichess/api/stream/event") {
		const known = tokenOf(request);
		if (!known) {
			json(response, 401, { error: "No such token" });
			return true;
		}
		openEventStream(response, known.value, known.token.account, baseOf(request));
		return true;
	}
	if (
		host === "api" &&
		(pathname.startsWith("/api/board/") || pathname.startsWith("/api/challenge") || pathname === "/api/account/playing")
	) {
		const known = tokenOf(request);
		if (!known) {
			json(response, 401, { error: "No such token" });
			return true;
		}
		if (await play.serve(pathname, request, response, known.token.account, baseOf(request))) return true;
	}

	// Puzzles (Task 80, ./lichess-puzzles.ts): by id, batches, solutions, the dashboard and replays.
	if (
		host === "api" &&
		(await puzzles.serve(
			pathname,
			url,
			request,
			response,
			tokenOf(request)?.token.account ?? null,
			bearer(request) !== null,
		))
	)
		return true;

	// Players (Task 81, ./lichess-players.ts): following, the players followed, a crosstable.
	if (host === "api" && players.serve(pathname, request, response, tokenOf(request)?.token.account ?? null))
		return true;

	if (request.method !== "GET") {
		json(response, 404, { error: "Not found" });
		return true;
	}
	// The explorer refuses calls without a token (any token, no scope), as the real one does.
	if (host === "explorer" && !bearer(request)) {
		json(response, 401, { error: "Unauthorized" });
		return true;
	}
	const name = lichessFixtureName(host, pathname, url.searchParams);
	const body = readLichessFixture(name);
	// A stream's recording (the player explorer) is ndjson: its lines, then the end.
	const stream = body === undefined ? readLichessFixture(name.replace(/\.json$/, ".ndjson")) : undefined;
	if (body === undefined && stream === undefined) {
		json(response, 404, { error: "Not recorded" });
		return true;
	}
	response.writeHead(200, {
		"content-type": stream === undefined ? "application/json" : "application/x-ndjson",
		"access-control-allow-origin": "*",
	});
	response.end(body ?? stream);
	return true;
}
