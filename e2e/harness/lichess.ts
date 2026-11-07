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
 * - `/lichess/api/stream/event`: the account's event stream. It opens with the recorded
 *   events (tests/fixtures/lichess/events.ndjson), then sends a keepalive every second.
 *   One stream per token, as Lichess: a new one closes the previous.
 * - Everything else answers from tests/fixtures/lichess (`pnpm lichess:record`), by
 *   `lichessFixtureName`; the explorer asks for a token, as the real one does.
 *
 * Test controls: `POST /e2e/lichess/revoke` (every token of `{ account }`), `POST
 * /e2e/lichess/event` (`{ account, event }` to its open streams), `DELETE /e2e/lichess`.
 * Later tasks add the game stream with a scripted opponent, seeks, the AI and the rest
 * (PLAN 13.5, "Fixtures").
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

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

/** Writes the recorded opening events, then a keepalive every second, until the stream is replaced or the client goes. */
function openEventStream(response: ServerResponse, value: string) {
	streams.get(value)?.end();
	streams.set(value, response);
	response.writeHead(200, { "content-type": "application/x-ndjson", "access-control-allow-origin": "*" });
	const opening = readLichessFixture("events.ndjson") ?? "";
	for (const line of opening.split("\n")) if (line.trim()) response.write(`${line}\n`);
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
			perfs: {},
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
		openEventStream(response, known.value);
		return true;
	}

	if (request.method !== "GET") {
		json(response, 404, { error: "Not found" });
		return true;
	}
	// The explorer refuses calls without a token (any token, no scope), as the real one does.
	if (host === "explorer" && !bearer(request)) {
		json(response, 401, { error: "Unauthorized" });
		return true;
	}
	const body = readLichessFixture(lichessFixtureName(host, pathname, url.searchParams));
	if (body === undefined) {
		json(response, 404, { error: "Not recorded" });
		return true;
	}
	response.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
	response.end(body);
	return true;
}
