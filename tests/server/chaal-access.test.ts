import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTree } from "@/features/chaal/chess/tree";
import { newLocalGame, toRecord } from "@/features/chaal/local/game";
import { DEFAULT_CHAAL_PREFERENCES } from "@/features/chaal/settings/preferences";
import type { Session } from "@/lib/session";
import * as analyses from "@/server/chaal/analysis/service";
import * as connect from "@/server/chaal/connect/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import { type ChaalPublic, chaalUserOf } from "@/server/chaal/context";
import { createChaalControls } from "@/server/chaal/controls";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import * as local from "@/server/chaal/local/service";
import * as play from "@/server/chaal/play/service";
import * as players from "@/server/chaal/players/service";
import * as preferences from "@/server/chaal/preferences";
import * as puzzles from "@/server/chaal/puzzles/service";
import { chaalStatus } from "@/server/chaal/status";
import * as watch from "@/server/chaal/watch/service";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Chaal's access matrix (PLAN 13.5, "Guard test"; decision 0254): who may call each
 * function, and on whose data. The functions' middleware (withChaalPublic;
 * requireChaalUser then withChaalServices) is checked by
 * tests/server/guarded-functions.test.ts; here are the rules behind it: no session, a
 * guest, a member, a blocked user, a feature that's off, a missing scope, a revoked token,
 * another user's connection, another user's analysis (Task 75), another user's local
 * game (Task 76), online play's calls (Task 77), each with the caller's own token,
 * another user's puzzle attempts (Task 80), following players (Task 81), and watching (Task 82:
 * public, with no session or connection, and refused when the admin turns it off).
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

const deps = (): connect.ConnectDeps => ({
	db: env.db,
	lichess: createLichess(
		{
			apiBase: "https://lichess.test",
			explorerBase: "https://e.test",
			tablebaseBase: "https://t.test",
			userAgent: "t",
		},
		fetcher,
	),
	vault,
	controls: createChaalControls(env.db, () => 0),
});

const session = (id: string, guest = false): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
	...(guest ? { isAnonymous: true as const } : {}),
});

/** A saved connection, as the callback leaves it (the flow itself: tests/server/chaal-connect.test.ts). */
async function connected(userId: string, lichessId: string, scopes: string[], revokedAt: Date | null = null) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId,
		username: lichessId,
		token: await vault.seal(`lio_${lichessId}`, "token"),
		scopes,
		revokedAt,
	});
}

const PLAY = ["board:play", "challenge:read", "challenge:write"];

/** Every personal function's service call (src/functions/chaal/connection.ts). */
const OPERATIONS: Record<string, (userId: string) => Promise<unknown>> = {
	getChaalConnection: (userId) => connect.connectionView(deps(), userId),
	disconnectChaal: (userId) => connect.disconnect(deps(), userId),
};

/** Every preferences function's service call (src/functions/chaal/preferences.ts, Task 73). */
const PREFERENCE_OPERATIONS: Record<string, (userId: string) => Promise<unknown>> = {
	getChaalPreferences: (userId) => preferences.preferencesOf(env.db, userId),
	saveChaalPreferences: (userId) =>
		preferences.savePreferences(env.db, userId, { ...DEFAULT_CHAAL_PREFERENCES, board: "stone" }),
	importChaalPreferences: (userId) =>
		preferences.importPreferences(env.db, userId, { ...DEFAULT_CHAAL_PREFERENCES, board: "stone" }),
};

/** Every "My analyses" function's service call (src/functions/chaal/analyses.ts, Task 75), on the member's analysis. */
const ANALYSIS_OPERATIONS: Record<string, (userId: string, id: string) => Promise<unknown>> = {
	listChaalAnalyses: (userId) => analyses.listAnalyses(env.db, userId),
	getChaalAnalysis: (userId, id) => analyses.getAnalysis(env.db, userId, id),
	saveChaalAnalysis: (userId, id) =>
		analyses.saveAnalysis(env.db, userId, { id, title: "Taken", tree: createTree(), tags: {}, orientation: "white" }),
	deleteChaalAnalysis: (userId, id) => analyses.deleteAnalysis(env.db, userId, id),
};

/** A local game of the member's, as the browser sends it. */
const localRecord = (id: string) =>
	toRecord(newLocalGame({ mode: "board", clock: null, layout: "flip" }, id, new Date("2026-11-09T10:00:00.000Z")));

/** Every local games function's service call (src/functions/chaal/local-games.ts, Task 76), on the member's game. */
const LOCAL_OPERATIONS: Record<string, (userId: string, id: string) => Promise<unknown>> = {
	listChaalLocalGames: (userId) => local.listLocalGames(env.db, userId),
	getChaalLocalGame: (userId, id) => local.getLocalGame(env.db, userId, id),
	saveChaalLocalGame: (userId, id) =>
		local.saveLocalGame({ db: env.db, controls: createChaalControls(env.db, () => 0) }, userId, localRecord(id)),
	deleteChaalLocalGame: (userId, id) => local.deleteLocalGame(env.db, userId, id),
	importChaalLocalGames: (userId, id) =>
		local.importLocalGames({ db: env.db, controls: createChaalControls(env.db, () => 0) }, userId, [localRecord(id)]),
};

const DAYS = { kind: "days", days: 3 } as const;

/** Every online play function's service call (src/functions/chaal/challenges.ts and live-game.ts, Tasks 77 and 78). */
const PLAY_OPERATIONS: Record<string, (userId: string) => Promise<unknown>> = {
	getChaalChallenges: (userId) => play.listChallenges(deps(), userId),
	challengeChaalPlayer: (userId) =>
		play.challengePlayer(deps(), userId, { username: "someone", pace: DAYS, color: "white", rated: false }),
	openChaalChallenge: (userId) => play.openChallenge(deps(), userId, { pace: DAYS, color: "white", rated: false }),
	acceptChaalChallenge: (userId) => play.acceptChallenge(deps(), userId, "chal1234"),
	declineChaalChallenge: (userId) => play.declineChallenge(deps(), userId, "chal1234", "later"),
	cancelChaalChallenge: (userId) => play.cancelChallenge(deps(), userId, "chal1234"),
	challengeChaalAi: (userId) => play.challengeAi(deps(), userId, { level: 1, pace: DAYS, color: "white" }),
	seekChaalCorrespondence: (userId) =>
		play.seekCorrespondence(deps(), userId, { pace: DAYS, rated: false, range: "any" }),
	getChaalPlaying: (userId) => play.playingGames(deps(), userId),
	getChaalLiveGame: (userId) => play.liveGame(deps(), userId, "game1234"),
	playChaalMove: (userId) => play.playMove(deps(), userId, "game1234", "e2e4"),
	actOnChaalGame: (userId) => play.gameAction(deps(), userId, "game1234", "resign"),
	getChaalChat: (userId) => play.chatHistory(deps(), userId, "game1234"),
	sendChaalChat: (userId) => play.sendChat(deps(), userId, "game1234", "hi"),
};

/** A finished puzzle of the member's, as the browser sends it. */
const puzzleAttempt = (id: string) => ({
	id,
	puzzleId: "xSeW5",
	won: true,
	ms: 9_000,
	rating: 1894,
	themes: ["skewer"],
	mode: "train" as const,
	angle: "mix" as const,
	streak: null,
	at: "2026-11-09T10:00:00.000Z",
});

/** Every puzzle function's service call (src/functions/chaal/puzzle-attempts.ts, Task 80), on the member's attempt. */
const PUZZLE_OPERATIONS: Record<string, (userId: string, id: string) => Promise<unknown>> = {
	recordChaalPuzzleAttempt: (userId, id) => puzzles.recordAttempt(deps(), userId, puzzleAttempt(id)),
	importChaalPuzzleAttempts: (userId, id) => puzzles.importAttempts(deps(), userId, [puzzleAttempt(id)]),
	getChaalPuzzleProgress: (userId) => puzzles.progress({ ...deps(), cache: createChaalCache() }, userId),
	getChaalPuzzleReplay: (userId) => puzzles.replay(deps(), userId, "fork"),
};

const SOCIAL = ["follow:read", "follow:write"];

/** Every following function's service call (src/functions/chaal/follows.ts, Task 81). */
const FOLLOW_OPERATIONS: Record<string, (userId: string) => Promise<unknown>> = {
	getChaalFollowing: (userId) => players.following(deps(), userId),
	followChaalPlayer: (userId) => players.setFollowing(deps(), userId, "someone", true),
};

/** Every watch function's service call (src/functions/chaal/watch.ts, Task 82): public, no token. */
const WATCH_OPERATIONS: Record<
	string,
	(chaal: Pick<ChaalPublic, "lichess" | "cache" | "settings">) => Promise<unknown>
> = {
	getChaalTv: (chaal) => watch.tv(chaal),
	getChaalStreamers: (chaal) => watch.streamers(chaal),
	getChaalBroadcasts: (chaal) => watch.broadcasts(chaal, 1),
	getChaalOfficialBroadcasts: (chaal) => watch.officialBroadcasts(chaal),
	searchChaalBroadcasts: (chaal) => watch.searchBroadcasts(chaal, "spice", 1),
	getChaalBroadcastTour: (chaal) => watch.broadcastTour(chaal, "abcdEFGH"),
	getChaalBroadcastRound: (chaal) => watch.broadcastRound(chaal, "abcdEFGH"),
	getChaalBroadcastGame: (chaal) => watch.broadcastGame(chaal, "abcdEFGH", "efghABCD"),
};

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(
			["member", "other", "guest", "blocked"].map((id) => ({
				id,
				name: id,
				email: `${id}@example.com`,
				isAnonymous: id === "guest",
			})),
		);
	});
	vault = await createVault(Buffer.alloc(32, 5).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	fetcher.mockClear();
});

describe("Chaal's access matrix", () => {
	it("personal functions need a session (guests included) and refuse a blocked user", async () => {
		const controls = createChaalControls(env.db, () => 0);
		await env.db.insert(schema.chBlock).values({ userId: "blocked", reason: "test" });
		const blocks = await controls.blocks();
		expect(() => chaalUserOf(null, blocks)).toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
		expect(chaalUserOf(session("guest", true), blocks)).toEqual({ id: "guest", isGuest: true });
		expect(chaalUserOf(session("member"), blocks)).toEqual({ id: "member", isGuest: false });
		expect(() => chaalUserOf(session("blocked"), blocks)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it.each(Object.keys(OPERATIONS))("%s acts on the caller's own connection only", async (name) => {
		const operation = OPERATIONS[name];
		if (!operation) throw new Error(name);
		await connected("member", "member_lichess", PLAY);
		await operation("other");
		// The member's connection is untouched, and "other" saw none.
		expect((await connect.connectionView(deps(), "member"))?.lichessId).toBe("member_lichess");
		expect(await connect.connectionView(deps(), "other")).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each(Object.keys(PREFERENCE_OPERATIONS))("%s acts on the caller's own preferences only", async (name) => {
		const operation = PREFERENCE_OPERATIONS[name];
		if (!operation) throw new Error(name);
		await preferences.savePreferences(env.db, "member", { ...DEFAULT_CHAAL_PREFERENCES, board: "print" });
		await operation("other");
		expect((await preferences.preferencesOf(env.db, "member"))?.board).toBe("print");
	});

	it.each(Object.keys(ANALYSIS_OPERATIONS))("%s acts on the caller's own analyses only", async (name) => {
		const operation = ANALYSIS_OPERATIONS[name];
		if (!operation) throw new Error(name);
		const saved = await analyses.saveAnalysis(env.db, "member", {
			title: "Mine",
			tree: createTree(),
			tags: {},
			orientation: "white",
		});
		// Another player's id is not found (or not listed), and the member's analysis is untouched.
		const result = await operation("other", saved.id).catch((error: unknown) => error);
		if (name === "listChaalAnalyses") expect(result).toEqual([]);
		else expect(result).toMatchObject({ code: "NOT_FOUND" });
		expect((await analyses.getAnalysis(env.db, "member", saved.id)).title).toBe("Mine");
	});

	it.each(Object.keys(LOCAL_OPERATIONS))("%s acts on the caller's own local games only", async (name) => {
		const operation = LOCAL_OPERATIONS[name];
		if (!operation) throw new Error(name);
		const id = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
		await local.saveLocalGame(
			{ db: env.db, controls: createChaalControls(env.db, () => 0) },
			"member",
			localRecord(id),
		);
		// Another player's id is not found, not listed, never written over or imported.
		const result = await operation("other", id).catch((error: unknown) => error);
		if (name === "listChaalLocalGames") expect(result).toEqual([]);
		else if (name === "importChaalLocalGames") expect(result).toEqual({ imported: [] });
		else expect(result).toMatchObject({ code: "NOT_FOUND" });
		expect((await local.getLocalGame(env.db, "member", id)).id).toBe(id);
		expect(await local.listLocalGames(env.db, "other")).toEqual([]);
	});

	it.each(Object.keys(PUZZLE_OPERATIONS))("%s acts on the caller's own attempts and token only", async (name) => {
		const operation = PUZZLE_OPERATIONS[name];
		if (!operation) throw new Error(name);
		const id = "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e";
		await puzzles.recordAttempt(deps(), "member", puzzleAttempt(id));
		await connected("member", "member_lichess", ["puzzle:read", "puzzle:write"]);
		// Another player's id is never taken over or imported; their progress shows none of the member's;
		// without a connection of their own, Lichess's replays are refused before Lichess is asked.
		const result = await operation("other", id).catch((error: unknown) => error);
		if (name === "importChaalPuzzleAttempts") expect(result).toEqual({ imported: [] });
		else if (name === "getChaalPuzzleProgress")
			expect(result).toMatchObject({ stats: { nb: 0 }, lichess: { state: "connect" } });
		else if (name === "getChaalPuzzleReplay") expect(result).toMatchObject({ reason: "lichess-reconnect" });
		const rows = await env.db.select().from(schema.chPuzzleAttempt);
		expect(rows.map((row) => [row.id, row.ownerId])).toEqual([[id, "member"]]);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each(
		Object.keys(PLAY_OPERATIONS),
	)("%s needs a connection that can play: refused without one, without play's scopes, revoked, or with play off", async (name) => {
		const operation = PLAY_OPERATIONS[name];
		if (!operation) throw new Error(name);
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await connected("member", "member_lichess", ["puzzle:read"]);
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await env.db.update(schema.chConnection).set({ scopes: PLAY, revokedAt: new Date(0) });
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await env.db.update(schema.chConnection).set({ revokedAt: null });
		await env.db.insert(schema.chSettings).values({ id: 1, features: { play: false } });
		await expect(operation("member")).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each(
		Object.keys(PLAY_OPERATIONS),
	)("%s acts with the caller's own token: another player's game or challenge is Lichess's to refuse", async (name) => {
		const operation = PLAY_OPERATIONS[name];
		if (!operation) throw new Error(name);
		await connected("member", "member_lichess", PLAY);
		await connected("other", "other_lichess", PLAY);
		fetcher.mockImplementation(async () => Response.json({ error: "Not found" }, { status: 404 }));
		await expect(operation("other")).rejects.toMatchObject({ code: "NOT_FOUND" });
		const tokens = fetcher.mock.calls.map(
			([, init]) => (init?.headers as Record<string, string> | undefined)?.authorization,
		);
		expect(tokens.length).toBeGreaterThan(0);
		expect(tokens.every((token) => token === "Bearer lio_other_lichess")).toBe(true);
		fetcher.mockImplementation(async () => new Response(null, { status: 204 }));
	});

	it.each(
		Object.keys(FOLLOW_OPERATIONS),
	)("%s needs a connection with the social scopes: refused without one, without them, revoked, or with social off", async (name) => {
		const operation = FOLLOW_OPERATIONS[name];
		if (!operation) throw new Error(name);
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await connected("member", "member_lichess", PLAY);
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await env.db.update(schema.chConnection).set({ scopes: SOCIAL, revokedAt: new Date(0) });
		await expect(operation("member")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await env.db.update(schema.chConnection).set({ revokedAt: null });
		await env.db.insert(schema.chSettings).values({ id: 1, features: { social: false } });
		await expect(operation("member")).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it.each(Object.keys(FOLLOW_OPERATIONS))("%s acts with the caller's own token only", async (name) => {
		const operation = FOLLOW_OPERATIONS[name];
		if (!operation) throw new Error(name);
		await connected("member", "member_lichess", SOCIAL);
		await connected("other", "other_lichess", SOCIAL);
		fetcher.mockImplementation(async () => new Response("", { status: 200 }));
		await operation("other");
		const tokens = fetcher.mock.calls.map(
			([, init]) => (init?.headers as Record<string, string> | undefined)?.authorization,
		);
		expect(tokens).toEqual(["Bearer lio_other_lichess"]);
		fetcher.mockImplementation(async () => new Response(null, { status: 204 }));
	});

	it.each(
		Object.keys(WATCH_OPERATIONS),
	)("%s is public: no session or token, on the public lane; refused when watch is off, before Lichess", async (name) => {
		const operation = WATCH_OPERATIONS[name];
		if (!operation) throw new Error(name);
		const controls = createChaalControls(env.db, () => 0);
		const chaal = { lichess: deps().lichess, cache: createChaalCache(), settings: await controls.settings() };
		fetcher.mockImplementation(async () => Response.json({ error: "Not found" }, { status: 404 }));
		await operation(chaal).catch(() => undefined);
		const asked = fetcher.mock.calls.map(([, init]) => (init?.headers as Record<string, string>).authorization);
		expect(asked.length).toBeGreaterThan(0);
		expect(asked.every((token) => token === undefined)).toBe(true);
		fetcher.mockClear();
		await env.db.insert(schema.chSettings).values({ id: 1, features: { watch: false } });
		const off = { ...chaal, settings: await createChaalControls(env.db, () => 0).settings() };
		await expect(operation(off)).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(fetcher).not.toHaveBeenCalled();
		fetcher.mockImplementation(async () => new Response(null, { status: 204 }));
	});

	it("a guest's connection works like a member's", async () => {
		await connected("guest", "guest_lichess", PLAY);
		expect((await connect.connectionView(deps(), "guest"))?.username).toBe("guest_lichess");
		await expect(connect.withToken(deps(), "guest", "play", async (token) => token)).resolves.toBe("lio_guest_lichess");
		await connect.disconnect(deps(), "guest");
		expect(await connect.connectionView(deps(), "guest")).toBeNull();
	});

	it("a feature that is off refuses its calls, and its status says so", async () => {
		await connected("member", "member_lichess", PLAY);
		await env.db.insert(schema.chSettings).values({ id: 1, features: { play: false } });
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			code: "FORBIDDEN",
			reason: undefined,
		});
		const settings = await createChaalControls(env.db, () => 0).settings();
		const chaal = {
			lichess: deps().lichess,
			cache: createChaalCache(),
			controls: createChaalControls(env.db),
			settings,
			appToken: null,
			connectConfigured: true,
			connectDeps: async () => deps(),
		} satisfies ChaalPublic;
		expect(chaalStatus(chaal, null).features.play).toBe(false);
		expect(chaalStatus(chaal, null).features.puzzles).toBe(true);
	});

	it("a connection without a feature's scopes is refused with reconnect, and its view names the feature", async () => {
		await connected("member", "member_lichess", ["puzzle:read", "puzzle:write"]);
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await expect(connect.withToken(deps(), "member", "puzzles", async () => "used")).resolves.toBe("used");
		expect((await connect.connectionView(deps(), "member"))?.needsScopesFor).toContain("play");
	});

	it("a revoked token, or one past its end, is refused with reconnect before Lichess is called", async () => {
		await connected("member", "member_lichess", PLAY, new Date(0));
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await env.db.update(schema.chConnection).set({ revokedAt: null, expiresAt: new Date(0) });
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("without a connection, a personal call says connect; the public status says whether a guest may", async () => {
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await env.db.insert(schema.chSettings).values({ id: 1, guestsMayConnect: false });
		const chaal: ChaalPublic = {
			lichess: deps().lichess,
			cache: createChaalCache(),
			controls: createChaalControls(env.db),
			settings: await createChaalControls(env.db).settings(),
			appToken: null,
			connectConfigured: true,
			connectDeps: async () => deps(),
		};
		expect(chaalStatus(chaal, session("guest", true)).connect).toBe("off");
		expect(chaalStatus(chaal, session("member")).connect).toBe("on");
		expect(chaalStatus({ ...chaal, connectConfigured: false }, session("member")).connect).toBe("off");
	});
});
