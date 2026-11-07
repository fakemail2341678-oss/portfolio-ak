import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChaalEvent } from "@/features/chaal/live/events";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { openPending } from "@/server/chaal/connect/oauth";
import * as connect from "@/server/chaal/connect/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import { createChaalControls } from "@/server/chaal/controls";
import { createChaalGuestData } from "@/server/chaal/guest-data";
import { createLichess } from "@/server/chaal/lichess/client";
import { accountAnswer } from "@/server/chaal/lichess/schemas";
import { eventStream } from "@/server/chaal/stream";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb } from "../utils/test-db";

/**
 * Connecting Lichess (PLAN 13.5, decision 0256) against PGlite and an in-memory Lichess:
 * the flow from start to a saved connection, the refusals, disconnecting, a 401 marking
 * the connection revoked, the guest claim and the event stream through our server. No
 * output ever holds a token.
 */

const ACCOUNTS: Record<string, { id: string; username: string; title: string | null }> = {
	player: { id: "player", username: "Player", title: null },
	rival: { id: "rival", username: "Rival", title: "FM" },
};

/** A small Lichess: tokens per account, revocation, the account and the event stream. */
function fakeLichess() {
	const tokens = new Map<string, { account: string; revoked: boolean }>();
	const state = { account: "player", issued: 0, streamOpen: true };
	const revoked: string[] = [];
	const exchanges: URLSearchParams[] = [];
	const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
	const fetcher = vi.fn<typeof fetch>(async (input, init) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const token = (init?.headers as Record<string, string> | undefined)?.authorization?.replace("Bearer ", "");
		const known = token ? tokens.get(token) : undefined;
		if (method === "POST" && url.pathname === "/api/token") {
			const form = new URLSearchParams(String(init?.body));
			exchanges.push(form);
			if (form.get("code") === "bad") return json(400, { error: "invalid_grant" });
			const value = `lio_${state.account}_${++state.issued}`;
			tokens.set(value, { account: state.account, revoked: false });
			return json(200, { token_type: "Bearer", access_token: value, expires_in: 31_536_000 });
		}
		if (method === "DELETE" && url.pathname === "/api/token") {
			if (token) revoked.push(token);
			if (known) known.revoked = true;
			return new Response(null, { status: 204 });
		}
		if (!known || known.revoked) return json(401, { error: "No such token" });
		if (url.pathname === "/api/account") return json(200, { ...ACCOUNTS[known.account], perfs: {} });
		if (url.pathname === "/api/stream/event") {
			const lines = readFileSync("tests/fixtures/lichess/events.ndjson", "utf8");
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(`${lines}\n`));
					if (!state.streamOpen) controller.close();
				},
			});
			return new Response(body, { headers: { "content-type": "application/x-ndjson" } });
		}
		return json(404, { error: "Not found" });
	});
	return { fetcher, tokens, revoked, exchanges, state };
}

let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
let lichess: ReturnType<typeof fakeLichess>;
const time = Date.UTC(2026, 10, 7, 12);

const deps = (overrides: Partial<connect.ConnectDeps> = {}): connect.ConnectDeps => ({
	db: env.db,
	lichess: createLichess(
		{
			apiBase: "https://lichess.test",
			explorerBase: "https://e.test",
			tablebaseBase: "https://t.test",
			userAgent: "t",
		},
		lichess.fetcher,
	),
	vault,
	controls: createChaalControls(env.db, () => time),
	now: () => time,
	...overrides,
});

const member = (id: string): connect.ChaalUser => ({ id, isGuest: false });
const guest = (id: string): connect.ChaalUser => ({ id, isGuest: true });
const REDIRECT = "https://app.test/api/chaal/oauth/callback";

/** Start, approve as `account` on Lichess, and come back: the whole flow, as the routes run it. */
async function connectAs(user: connect.ChaalUser, account = "player", context = deps()) {
	const start = await connect.startConnect(context, user, {
		returnTo: "/admin/chaal/lab",
		redirectUri: REDIRECT,
		clientId: "chaal",
	});
	if (start.kind !== "redirect") return start.result;
	const pending = await openPending(vault, start.cookie, time);
	lichess.state.account = account;
	return connect.completeConnect(context, user, {
		query: { code: "good", state: pending?.state },
		pending,
		redirectUri: REDIRECT,
		clientId: "chaal",
	});
}

const rowOf = async (db: Db, userId: string) =>
	(await db.select().from(schema.chConnection).where(eq(schema.chConnection.userId, userId)))[0];

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db
			.insert(schema.user)
			.values(
				["u1", "u2", "g1"].map((id) => ({ id, name: id, email: `${id}@example.com`, isAnonymous: id.startsWith("g") })),
			);
	});
	vault = await createVault(Buffer.alloc(32, 3).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	lichess = fakeLichess();
});

describe("connecting Lichess", () => {
	it("start sends the browser to Lichess with a PKCE challenge, and the callback saves a sealed token for that user", async () => {
		const start = await connect.startConnect(deps(), member("u1"), {
			returnTo: "/admin/chaal/lab",
			redirectUri: REDIRECT,
			clientId: "chaal",
		});
		if (start.kind !== "redirect") throw new Error("expected a redirect");
		const authorize = new URL(start.location);
		expect(authorize.pathname).toBe("/oauth");
		expect(authorize.searchParams.get("scope")).toContain("board:play");
		const pending = await openPending(vault, start.cookie, time);
		expect(authorize.searchParams.get("state")).toBe(pending?.state);

		const result = await connect.completeConnect(deps(), member("u1"), {
			query: { code: "good", state: pending?.state },
			pending,
			redirectUri: REDIRECT,
			clientId: "chaal",
		});
		expect(result).toBe("connected");
		// The verifier sent with the code is the one behind the challenge the browser carried.
		const exchange = lichess.exchanges[0];
		expect(
			createHash("sha256")
				.update(exchange?.get("code_verifier") ?? "")
				.digest("base64url"),
		).toBe(authorize.searchParams.get("code_challenge"));
		expect(exchange?.get("redirect_uri")).toBe(REDIRECT);

		const row = await rowOf(env.db, "u1");
		expect(row).toMatchObject({ lichessId: "player", username: "Player", revokedAt: null });
		expect(row?.token).not.toContain("lio_");
		expect(await vault.open(row?.token ?? "", "token")).toBe("lio_player_1");
		expect(row?.expiresAt?.getTime()).toBe(time + 31_536_000_000);

		const view = await connect.connectionView(deps(), "u1");
		expect(view).toMatchObject({ username: "Player", revoked: false, needsScopesFor: [] });
		expect(JSON.stringify(view)).not.toMatch(/lio_|v1\./);
	});

	it("refuses a callback without its cookie, with another state or for another user, and reports a denial", async () => {
		const start = await connect.startConnect(deps(), member("u1"), {
			returnTo: "/app/chaal",
			redirectUri: REDIRECT,
			clientId: "c",
		});
		if (start.kind !== "redirect") throw new Error("expected a redirect");
		const pending = await openPending(vault, start.cookie, time);
		const finish = (
			user: connect.ChaalUser,
			query: { code?: string; state?: string; error?: string },
			from = pending,
		) => connect.completeConnect(deps(), user, { query, pending: from, redirectUri: REDIRECT, clientId: "c" });
		expect(await finish(member("u1"), { code: "good", state: pending?.state }, null)).toBe("expired");
		expect(await finish(member("u1"), { code: "good", state: "another" })).toBe("failed");
		expect(await finish(member("u2"), { code: "good", state: pending?.state })).toBe("failed");
		expect(await finish(member("u1"), { error: "access_denied", state: pending?.state })).toBe("denied");
		expect(await finish(member("u1"), { code: "bad", state: pending?.state })).toBe("failed");
		expect(lichess.exchanges).toHaveLength(1);
		expect(await rowOf(env.db, "u1")).toBeUndefined();
	});

	it("a Lichess account belongs to one user: a second one is refused and the new token revoked", async () => {
		expect(await connectAs(member("u1"), "player")).toBe("connected");
		expect(await connectAs(member("u2"), "player")).toBe("taken");
		expect(lichess.revoked).toEqual(["lio_player_2"]);
		expect(await rowOf(env.db, "u2")).toBeUndefined();
		expect((await rowOf(env.db, "u1"))?.lichessId).toBe("player");
	});

	it("a new connection replaces the user's earlier one, the same account or another, and revokes the old token", async () => {
		await connectAs(member("u1"), "player");
		expect(await connectAs(member("u1"), "rival")).toBe("connected");
		expect(lichess.revoked).toEqual(["lio_player_1"]);
		expect(await rowOf(env.db, "u1")).toMatchObject({ lichessId: "rival", title: "FM" });
		// Reconnecting the same account (to grant new scopes): the earlier token is revoked too, and the row starts fresh.
		await env.db.update(schema.chConnection).set({ revokedAt: new Date(0) });
		expect(await connectAs(member("u1"), "rival")).toBe("connected");
		expect(lichess.revoked).toEqual(["lio_player_1", "lio_rival_2"]);
		expect((await rowOf(env.db, "u1"))?.revokedAt).toBeNull();
		expect(await vault.open((await rowOf(env.db, "u1"))?.token ?? "", "token")).toBe("lio_rival_3");
	});

	it("is off without a key, for guests when the admin says so, and for a blocked user or Lichess account", async () => {
		expect(await connectAs(member("u1"), "player", deps({ vault: null }))).toBe("off");
		await env.db.insert(schema.chSettings).values({ id: 1, guestsMayConnect: false });
		expect(await connectAs(guest("g1"))).toBe("off");
		await env.db.update(schema.chSettings).set({ guestsMayConnect: true });
		expect(await connectAs(guest("g1"))).toBe("connected");

		await env.db.insert(schema.chBlock).values({ userId: "u1", reason: "test" });
		expect(await connectAs(member("u1"), "rival")).toBe("blocked");
		await env.db.insert(schema.chBlock).values({ lichessId: "rival", reason: "test" });
		expect(await connectAs(member("u2"), "rival")).toBe("blocked");
		expect(lichess.revoked).toContain("lio_rival_2");
	});

	it("disconnect revokes the token at Lichess and forgets the connection, even when Lichess can't be reached", async () => {
		await connectAs(member("u1"));
		await connect.disconnect(deps(), "u1");
		expect(lichess.revoked).toEqual(["lio_player_1"]);
		expect(await rowOf(env.db, "u1")).toBeUndefined();

		await connectAs(member("u1"));
		lichess.fetcher.mockRejectedValueOnce(new Error("offline"));
		await connect.disconnect(deps(), "u1");
		expect(await rowOf(env.db, "u1")).toBeUndefined();
	});

	it("a 401 from Lichess marks the connection revoked: the view says reconnect, and the token isn't sent again", async () => {
		await connectAs(member("u1"));
		const token = lichess.tokens.get("lio_player_1");
		if (token) token.revoked = true;
		const read = () =>
			connect.withToken(deps(), "u1", "play", (value) =>
				deps().lichess.json(
					{ endpoint: "account", path: "/api/account", token: value, lane: "user:u1" },
					accountAnswer,
				),
			);
		await expect(read()).rejects.toMatchObject({ code: "FORBIDDEN", reason: "lichess-reconnect" });
		expect((await rowOf(env.db, "u1"))?.revokedAt).not.toBeNull();
		expect((await connect.connectionView(deps(), "u1"))?.revoked).toBe(true);
		const calls = lichess.fetcher.mock.calls.length;
		await expect(read()).rejects.toMatchObject({ reason: "lichess-reconnect" });
		expect(lichess.fetcher.mock.calls.length).toBe(calls);
	});

	it("a token sealed with a key that was removed can't be used: the connection needs a reconnect", async () => {
		await connectAs(member("u1"));
		const otherKey = await createVault(Buffer.alloc(32, 4).toString("base64"));
		await expect(connect.withToken(deps({ vault: otherKey }), "u1", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		expect((await rowOf(env.db, "u1"))?.revokedAt).not.toBeNull();
	});
});

describe("the guest claim", () => {
	it("moves a guest's connection to the account that has none", async () => {
		await connectAs(guest("g1"));
		await env.db.transaction((tx) => createChaalGuestData(vi.fn()).claim(tx, "g1", "u1"));
		expect((await rowOf(env.db, "u1"))?.lichessId).toBe("player");
		expect(await rowOf(env.db, "g1")).toBeUndefined();
	});

	it("keeps the account's own connection, drops the guest's and revokes its token", async () => {
		await connectAs(member("u1"), "rival");
		await connectAs(guest("g1"), "player");
		const revoke = vi.fn(async () => {});
		await env.db.transaction((tx) => createChaalGuestData(revoke).claim(tx, "g1", "u1"));
		expect((await rowOf(env.db, "u1"))?.lichessId).toBe("rival");
		expect(await rowOf(env.db, "g1")).toBeUndefined();
		expect(revoke).toHaveBeenCalledTimes(1);
		const [sealed] = revoke.mock.calls[0] as unknown as [string];
		expect(await vault.open(sealed, "token")).toBe("lio_player_2");
	});
});

describe("the event stream through our server", () => {
	const read = async (response: Response) => {
		const lines: string[] = [];
		if (!response.body) return lines;
		for await (const line of ndjsonLines(response.body)) lines.push(line);
		return lines;
	};

	it("passes Lichess's events on, mapped (unknown ones dropped), and closes itself with a reconnect before the time limit", async () => {
		await connectAs(member("u1"));
		const response = await eventStream(deps(), member("u1"), { windowMs: 50 });
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/x-ndjson");
		const lines = await read(response);
		expect(lines[0]).toBe("");
		const events = lines.map((line) => parseLine(line) as ChaalEvent | undefined).filter(Boolean);
		expect(events.map((event) => event?.type)).toEqual(["challenge", "gameStart", "gameFinish", "reconnect"]);
		expect(lines.join("\n")).not.toMatch(/lio_|fullId|aFutureEvent/);
	});

	it("when Lichess ends the stream, it asks the browser to reconnect in a second", async () => {
		await connectAs(member("u1"));
		lichess.state.streamOpen = false;
		const lines = await read(await eventStream(deps(), member("u1"), { windowMs: 5_000 }));
		expect(parseLine(lines.at(-1) ?? "")).toEqual({ type: "reconnect", afterMs: 1_000 });
	});

	it("is refused without a session, for a blocked user, without a connection, and with a token Lichess revoked", async () => {
		expect((await eventStream(deps(), null)).status).toBe(401);
		expect(await (await eventStream(deps(), member("u2"))).json()).toEqual({
			error: "FORBIDDEN",
			reason: "lichess-reconnect",
		});
		await connectAs(member("u1"));
		const token = lichess.tokens.get("lio_player_1");
		if (token) token.revoked = true;
		const refused = await eventStream(deps(), member("u1"));
		expect(refused.status).toBe(403);
		expect((await rowOf(env.db, "u1"))?.revokedAt).not.toBeNull();
		await env.db.insert(schema.chBlock).values({ userId: "u2", reason: "test" });
		expect((await eventStream(deps(), member("u2"))).status).toBe(403);
	});
});
