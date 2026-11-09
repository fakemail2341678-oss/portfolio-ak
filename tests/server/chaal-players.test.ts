import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import type { ChaalPublic } from "@/server/chaal/context";
import { createChaalControls, DEFAULT_CHAAL_SETTINGS } from "@/server/chaal/controls";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import * as players from "@/server/chaal/players/service";
import * as schema from "@/server/db/schema";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";
import { createTestDb } from "../utils/test-db";

/**
 * Players and games on the server (PLAN Task 81, decision 0271): public reads through the
 * cache, a profile with its status, a connected viewer's follow state (their token) and
 * score, a page of games with a result filter and its cursor, a replay, following and the
 * players followed (the social switch and scopes), and the players switch.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const API = "https://lichess.test";
const PLAYER = "nihalsarin2004";

type Call = { method: string; url: URL; token: string | null };
const calls: Call[] = [];
const following = new Set<string>();

/** A games export of `n` games, newest first, the player winning every other one. */
const gamesLines = (n: number, start: number) =>
	Array.from({ length: n }, (_, index) =>
		JSON.stringify({
			id: `game${String(index).padStart(4, "0")}`,
			variant: "standard",
			status: "mate",
			createdAt: start - index * 1_000,
			winner: index % 2 === 0 ? "white" : "black",
			players: { white: { user: { id: "me", name: "Me" } }, black: { user: { id: "you", name: "You" } } },
			moves: "e4 e5",
		}),
	).join("\n");

const fetcher = vi.fn<typeof fetch>(async (input, init) => {
	const url = new URL(String(input));
	const token = (init?.headers as Record<string, string>).authorization?.replace("Bearer ", "") ?? null;
	const method = init?.method ?? "GET";
	calls.push({ method, url, token });
	if (token === "lio_refused") return new Response("{}", { status: 401 });
	const follow = url.pathname.match(/^\/api\/rel\/(follow|unfollow)\/(.+)$/);
	if (follow && method === "POST") {
		if (follow[1] === "follow") following.add(follow[2] as string);
		else following.delete(follow[2] as string);
		return Response.json({ ok: true });
	}
	if (url.pathname === "/api/rel/following")
		return new Response([...following].map((id) => JSON.stringify({ id, username: id })).join("\n"));
	if (url.pathname === "/api/games/user/me")
		return new Response(gamesLines(Number(url.searchParams.get("max")), Number(url.searchParams.get("until") ?? 1e9)));
	if (url.pathname.startsWith("/api/crosstable/"))
		return Response.json({ users: { member_li: 3, [PLAYER]: 1 }, nbGames: 4 });
	const name = lichessFixtureName("api", url.pathname, url.searchParams);
	const body = readLichessFixture(name) ?? readLichessFixture(name.replace(/\.json$/, ".ndjson"));
	if (body === undefined) return Response.json({ error: "Not found" }, { status: 404 });
	if (url.pathname === `/api/user/${PLAYER}` && token) {
		return Response.json({ ...(JSON.parse(body) as object), following: following.has(PLAYER) });
	}
	return new Response(body, { status: 200 });
});

const lichess = () => createLichess({ apiBase: API, explorerBase: API, tablebaseBase: API, userAgent: "t" }, fetcher);
const deps = () => ({ db: env.db, lichess: lichess(), vault, controls: createChaalControls(env.db, () => 0) });

function chaal(overrides: Partial<ChaalPublic> = {}): ChaalPublic {
	const shared = deps();
	return {
		lichess: shared.lichess,
		cache: createChaalCache(),
		controls: shared.controls,
		settings: DEFAULT_CHAAL_SETTINGS,
		appToken: null,
		connectConfigured: true,
		connectDeps: async () => shared,
		...overrides,
	};
}

const session = (id: string): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
});

const SOCIAL = ["follow:read", "follow:write"];

async function connect(userId: string, scopes = SOCIAL, token = `lio_${userId}`) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId: `${userId}_li`,
		username: `${userId}_li`,
		token: await vault.seal(token, "token"),
		scopes,
	});
}

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db
			.insert(schema.user)
			.values(["member", "other"].map((id) => ({ id, name: id, email: `${id}@example.com` })));
	});
	vault = await createVault(Buffer.alloc(32, 3).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	calls.length = 0;
	following.clear();
	fetcher.mockClear();
});

describe("Players on the server", () => {
	it("a visitor's profile: the public read and the status, cached, with no viewer", async () => {
		const shared = chaal();
		const page = await players.playerPage(shared, null, "NihalSarin2004");
		expect(page.player.id).toBe(PLAYER);
		expect(page.viewer).toBeNull();
		expect(calls.map((call) => call.url.pathname)).toEqual([`/api/user/${PLAYER}`, "/api/users/status"]);
		expect(calls.every((call) => call.token === null)).toBe(true);
		await players.playerPage(shared, null, PLAYER);
		expect(calls).toHaveLength(2);
	});

	it("a connected viewer: whether they follow (with their token, never cached) and their score", async () => {
		await connect("member");
		following.add(PLAYER);
		const page = await players.playerPage(chaal(), session("member"), PLAYER);
		expect(page.viewer).toEqual({
			lichessId: "member_li",
			username: "member_li",
			following: true,
			crosstable: { you: 3, them: 1, games: 4 },
		});
		const user = calls.find((call) => call.url.pathname === `/api/user/${PLAYER}`);
		expect(user?.token).toBe("lio_member");
		expect(calls.find((call) => call.url.pathname.startsWith("/api/crosstable/"))?.token).toBeNull();
	});

	it("without the social scopes, or with social off, the viewer's follow state is unknown and the read is public", async () => {
		await connect("member", ["puzzle:read"]);
		const page = await players.playerPage(chaal(), session("member"), PLAYER);
		expect(page.viewer?.following).toBeNull();
		expect(calls.every((call) => call.token === null)).toBe(true);
		calls.length = 0;
		await env.db.update(schema.chConnection).set({ scopes: SOCIAL });
		const off = { ...DEFAULT_CHAAL_SETTINGS, features: { social: false } };
		expect(
			(await players.playerPage(chaal({ settings: off }), session("member"), PLAYER)).viewer?.following,
		).toBeNull();
		expect(calls.every((call) => call.token === null)).toBe(true);
	});

	it("a token Lichess refuses falls back to the public read, and the connection is marked revoked", async () => {
		await connect("member", SOCIAL, "lio_refused");
		const page = await players.playerPage(chaal(), session("member"), PLAYER);
		expect(page.player.id).toBe(PLAYER);
		const [row] = await env.db.select().from(schema.chConnection);
		expect(row?.revokedAt).not.toBeNull();
	});

	it("a name Lichess doesn't know is NOT_FOUND; the players switch refuses everything before Lichess is asked", async () => {
		await expect(players.playerPage(chaal(), null, "nobody_here")).rejects.toMatchObject({ code: "NOT_FOUND" });
		calls.length = 0;
		const off = chaal({ settings: { ...DEFAULT_CHAAL_SETTINGS, features: { players: false } } });
		await expect(players.leaderboard(off, "blitz")).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(players.playerPage(off, null, PLAYER)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(players.playerGames(off, { username: PLAYER })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(players.replay(off, "T8myeL3d")).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(players.searchPlayers(off, "nihal")).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(calls).toHaveLength(0);
	});

	it("the details: a leaderboard, the history, a rating with no games is null, the activity, the search", async () => {
		const shared = chaal();
		expect((await players.leaderboard(shared, "blitz")).players.length).toBeGreaterThan(0);
		expect((await players.ratingHistory(shared, PLAYER)).length).toBeGreaterThan(0);
		expect(await players.perfStats(shared, PLAYER, "classical")).toBeNull();
		expect((await players.perfStats(shared, PLAYER, "ultraBullet"))?.perf).toBe("ultraBullet");
		expect((await players.activity(shared, PLAYER)).length).toBeGreaterThan(0);
		expect((await players.searchPlayers(shared, "NihalSarin200")).length).toBeGreaterThan(0);
	});

	it("a page of games: the cursor, and a result filter that looks through more and stops at a full page", async () => {
		const shared = chaal();
		const first = await players.playerGames(shared, { username: "Me" });
		expect(first.games).toHaveLength(20);
		expect(first.next).toBe(first.games.at(-1)?.createdAt);
		const gamesCall = calls.find((call) => call.url.pathname === "/api/games/user/me");
		expect(gamesCall?.url.searchParams.get("ongoing")).toBe("true");
		const older = await players.playerGames(shared, { username: "Me", before: first.next ?? 0 });
		expect(older.games[0]?.createdAt).toBeLessThan(first.next ?? 0);
		const wins = await players.playerGames(shared, { username: "Me", result: "win" });
		expect(wins.games).toHaveLength(20);
		expect(wins.games.every((game) => game.winner === "white")).toBe(true);
		expect(calls.at(-1)?.url.searchParams.get("max")).toBe("60");
		// The next page starts after the last win shown, not after the last game looked at.
		expect(wins.next).toBe(wins.games.at(-1)?.createdAt);
	});

	it("a replay: the recorded export, and null for a game Lichess doesn't have", async () => {
		const shared = chaal();
		const game = await players.replay(shared, "T8myeL3d");
		expect(game).toMatchObject({ id: "T8myeL3d", ongoing: false });
		expect(game && "finished" in game).toBe(false);
		expect(await players.replay(shared, "noGame12")).toBeNull();
	});
});

describe("Following on Lichess", () => {
	it("follows, lists and unfollows with the user's own token", async () => {
		await connect("member");
		await players.setFollowing(deps(), "member", PLAYER, true);
		expect(await players.following(deps(), "member")).toEqual([
			{ id: PLAYER, username: PLAYER, title: null, online: false },
		]);
		await players.setFollowing(deps(), "member", PLAYER, false);
		expect(await players.following(deps(), "member")).toEqual([]);
		expect(calls.every((call) => call.token === "lio_member")).toBe(true);
		expect(calls.filter((call) => call.method === "POST").map((call) => call.url.pathname)).toEqual([
			`/api/rel/follow/${PLAYER}`,
			`/api/rel/unfollow/${PLAYER}`,
		]);
	});

	it("needs the social scopes and the switch", async () => {
		await connect("member", ["puzzle:read"]);
		await expect(players.setFollowing(deps(), "member", PLAYER, true)).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await env.db.update(schema.chConnection).set({ scopes: SOCIAL });
		await env.db.insert(schema.chSettings).values({ id: 1, features: { social: false } });
		await expect(players.following(deps(), "member")).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(calls).toHaveLength(0);
	});
});
