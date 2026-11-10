import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChaalChallengeLine, ChaalGameLine, ChaalSeekLine } from "@/features/chaal/live/events";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { pruneActivity } from "@/server/chaal/activity";
import type { ConnectDeps } from "@/server/chaal/connect/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import { createChaalControls } from "@/server/chaal/controls";
import { runChaalCron } from "@/server/chaal/cron";
import { createLichess } from "@/server/chaal/lichess/client";
import * as play from "@/server/chaal/play/service";
import { challengeStream, eventStream, gameStream, sameOrigin, seekStream } from "@/server/chaal/stream";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Online play on the server (PLAN Task 77, decision 0266) against PGlite and an in-memory
 * Lichess: challenges and the AI with the admin's limits, a game's first paint and its
 * actions on the play lane, the chat switch, the game and challenge streams through our
 * server (a reconnect, chat dropped when off, a challenge cancelled when nobody answers),
 * activity counted once, and the daily prune.
 */

const API = "https://lichess.test";
const encoder = new TextEncoder();

type Call = { method: string; path: string; search: string; form: URLSearchParams | null; token: string | null };

/** Lichess as the tests need it: answers by path, streams that stay open until closed. */
function fakeLichess() {
	const calls: Call[] = [];
	const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
	const answers = new Map<string, () => Response>();
	const fetcher = vi.fn<typeof fetch>(async (input, init) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const body = typeof init?.body === "string" ? init.body : null;
		const token = (init?.headers as Record<string, string> | undefined)?.authorization?.replace("Bearer ", "") ?? null;
		const form =
			body && (init?.headers as Record<string, string>)["content-type"]?.includes("form")
				? new URLSearchParams(body)
				: null;
		calls.push({ method, path: url.pathname, search: url.search, form, token });
		const answer = answers.get(`${method} ${url.pathname}`);
		if (answer) return answer();
		if (
			url.pathname.startsWith("/api/board/game/stream/") ||
			url.pathname === "/api/stream/event" ||
			form?.get("keepAliveStream") ||
			(url.pathname === "/api/board/seek" && form?.get("time"))
		) {
			const key = `${method} ${url.pathname}`;
			const stream = new ReadableStream<Uint8Array>({
				start: (controller) => {
					streams.set(key, controller);
				},
			});
			init?.signal?.addEventListener("abort", () => {
				try {
					streams.get(key)?.close();
				} catch {
					// Already closed.
				}
			});
			return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
		}
		return Response.json({ ok: true });
	});
	const push = (key: string, value: unknown) => streams.get(key)?.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
	const end = (key: string) => streams.get(key)?.close();
	return { calls, fetcher, answers, push, end, streams };
}

let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
let lichess: ReturnType<typeof fakeLichess>;

const deps = (): ConnectDeps => ({
	db: env.db,
	lichess: createLichess({ apiBase: API, explorerBase: API, tablebaseBase: API, userAgent: "t" }, lichess.fetcher),
	vault,
	controls: createChaalControls(env.db, () => 0),
});

const PLAY = ["board:play", "challenge:read", "challenge:write"];
const member = { id: "member", isGuest: false };

async function connect(userId = "member", lichessId = "me") {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId,
		username: lichessId,
		token: await vault.seal(`lio_${lichessId}`, "token"),
		scopes: PLAY,
	});
}

const gameFull = (white = "me", black = "them") => ({
	type: "gameFull",
	id: "game1234",
	variant: { key: "standard" },
	clock: { initial: 600000, increment: 5000 },
	speed: "rapid",
	rated: false,
	createdAt: 1,
	white: { id: white, name: white },
	black: { id: black, name: black },
	initialFen: "startpos",
	state: { type: "gameState", moves: "", wtime: 600000, btime: 600000, winc: 5000, binc: 5000, status: "started" },
});

const lines = async (response: Response) => {
	const out: unknown[] = [];
	if (!response.body) return out;
	for await (const line of ndjsonLines(response.body)) {
		const value = parseLine(line);
		if (value !== undefined) out.push(value);
	}
	return out;
};

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db
			.insert(schema.user)
			.values(["member", "other"].map((id) => ({ id, name: id, email: `${id}@example.com` })));
	});
	vault = await createVault(Buffer.alloc(32, 7).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	lichess = fakeLichess();
});

const activity = () => env.db.select().from(schema.chActivity);

describe("challenges and the Lichess AI", () => {
	it("a game with the AI: its form, the user's token on the user's lane, and the game counted once", async () => {
		await connect();
		lichess.answers.set("POST /api/challenge/ai", () => Response.json({ id: "aiGame12" }, { status: 201 }));
		const game = await play.challengeAi(deps(), "member", {
			level: 5,
			pace: { kind: "clock", clock: { initial: 600, increment: 5 } },
			color: "black",
		});
		expect(game).toEqual({ id: "aiGame12" });
		const call = lichess.calls.at(-1);
		expect(call?.token).toBe("lio_me");
		expect(Object.fromEntries(call?.form ?? [])).toEqual({
			level: "5",
			"clock.limit": "600",
			"clock.increment": "5",
			color: "black",
			variant: "standard",
		});
		await play.challengeAi(deps(), "member", { level: 5, pace: { kind: "days", days: 3 }, color: "white" });
		expect(await activity()).toEqual([
			expect.objectContaining({ userId: "member", kind: "game", mode: "ai", ref: "aiGame12" }),
		]);
	});

	it("the admin's limits: the AI's highest level and rated games", async () => {
		await connect();
		await env.db.insert(schema.chSettings).values({ id: 1, play: { aiMaxLevel: 4, rated: false, quickPair: "all" } });
		await expect(
			play.challengeAi(deps(), "member", { level: 5, pace: { kind: "days", days: 3 }, color: "white" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			play.challengePlayer(deps(), "member", {
				username: "Them",
				pace: { kind: "days", days: 3 },
				color: "white",
				rated: true,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			play.openChallenge(deps(), "member", { pace: { kind: "days", days: 3 }, color: "white", rated: true }),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(lichess.calls).toHaveLength(0);
	});

	it("a correspondence challenge goes as a call; one with a clock must be kept open by the stream", async () => {
		await connect();
		lichess.answers.set("POST /api/challenge/Them", () =>
			Response.json({
				challenge: { id: "chal1234", status: "created", timeControl: { type: "correspondence", daysPerTurn: 3 } },
			}),
		);
		const challenge = await play.challengePlayer(deps(), "member", {
			username: "Them",
			pace: { kind: "days", days: 3 },
			color: "random",
			rated: false,
		});
		expect(challenge).toMatchObject({ id: "chal1234", timeControl: { daysPerTurn: 3 } });
		expect(Object.fromEntries(lichess.calls.at(-1)?.form ?? [])).toEqual({
			days: "3",
			rated: "false",
			color: "random",
			variant: "standard",
		});
		await expect(
			play.challengePlayer(deps(), "member", {
				username: "Them",
				pace: { kind: "clock", clock: { initial: 600, increment: 5 } },
				color: "random",
				rated: false,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("an open challenge is joined at once as the player's side; the link for the friend is Lichess's own page", async () => {
		await connect();
		lichess.answers.set("POST /api/challenge/open", () =>
			Response.json({
				id: "open1234",
				url: `${API}/open1234`,
				urlWhite: `${API}/open1234?color=white`,
				urlBlack: "https://evil.example/open1234",
			}),
		);
		const white = await play.openChallenge(deps(), "member", {
			pace: { kind: "days", days: 3 },
			color: "black",
			rated: false,
		});
		expect(white).toEqual({ id: "open1234", link: `${API}/open1234?color=white`, color: "black" });
		expect(lichess.calls.at(-1)).toMatchObject({ path: "/api/challenge/open1234/accept", search: "?color=black" });
		const random = await play.openChallenge(
			deps(),
			"member",
			{ pace: { kind: "days", days: 3 }, color: "random", rated: false },
			() => 0.1,
		);
		// White's friend gets the black link: here not Lichess's, so the plain page instead.
		expect(random).toEqual({ id: "open1234", link: `${API}/open1234`, color: "white" });
	});

	it("accept, decline with a reason, cancel; and the list, incoming and outgoing", async () => {
		await connect();
		expect(await play.acceptChallenge(deps(), "member", "chal1234")).toEqual({ id: "chal1234" });
		await play.declineChallenge(deps(), "member", "chal5678", "tooFast");
		await play.cancelChallenge(deps(), "member", "chal9999");
		expect(lichess.calls.map((call) => `${call.path} ${call.form?.get("reason") ?? ""}`.trim())).toEqual([
			"/api/challenge/chal1234/accept",
			"/api/challenge/chal5678/decline tooFast",
			"/api/challenge/chal9999/cancel",
		]);
		expect(await activity()).toEqual([expect.objectContaining({ mode: "challenge", ref: "chal1234" })]);
		lichess.answers.set("GET /api/challenge", () => Response.json({ in: [{ id: "chalIn12" }], out: [] }));
		expect(await play.listChallenges(deps(), "member")).toMatchObject({ incoming: [{ id: "chalIn12" }], outgoing: [] });
	});
});

describe("a game", () => {
	it("its first paint is the stream's first line with the player's side; a game the player isn't in is NOT_FOUND", async () => {
		await connect();
		const reading = play.liveGame(deps(), "member", "game1234");
		await vi.waitFor(() => expect(lichess.streams.has("GET /api/board/game/stream/game1234")).toBe(true));
		lichess.push("GET /api/board/game/stream/game1234", gameFull("them", "me"));
		expect(await reading).toMatchObject({ color: "black", game: { id: "game1234", white: { id: "them" } } });
		lichess.answers.set(
			"GET /api/board/game/stream/game5678",
			() => new Response(encoder.encode(`${JSON.stringify(gameFull("a", "b"))}\n`)),
		);
		await expect(play.liveGame(deps(), "member", "game5678")).rejects.toMatchObject({ code: "NOT_FOUND" });
		lichess.answers.set("GET /api/board/game/stream/gone1234", () =>
			Response.json({ error: "No such game" }, { status: 404 }),
		);
		await expect(play.liveGame(deps(), "member", "gone1234")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("moves and actions go to the Board API's paths; a refused move is BAD_REQUEST", async () => {
		await connect();
		await play.playMove(deps(), "member", "game1234", "e2e4");
		await play.playMove(deps(), "member", "game1234", "e7e8q", true);
		for (const action of [
			"resign",
			"abort",
			"draw-offer",
			"draw-decline",
			"takeback-offer",
			"takeback-decline",
			"claim-victory",
			"claim-draw",
		] as const) {
			await play.gameAction(deps(), "member", "game1234", action);
		}
		expect(lichess.calls.map((call) => `${call.path}${call.search}`)).toEqual([
			"/api/board/game/game1234/move/e2e4",
			"/api/board/game/game1234/move/e7e8q?offeringDraw=true",
			"/api/board/game/game1234/resign",
			"/api/board/game/game1234/abort",
			"/api/board/game/game1234/draw/yes",
			"/api/board/game/game1234/draw/no",
			"/api/board/game/game1234/takeback/yes",
			"/api/board/game/game1234/takeback/no",
			"/api/board/game/game1234/claim-victory",
			"/api/board/game/game1234/claim-draw",
		]);
		lichess.answers.set("POST /api/board/game/game1234/move/e2e5", () =>
			Response.json({ error: "illegal" }, { status: 400 }),
		);
		await expect(play.playMove(deps(), "member", "game1234", "e2e5")).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("chat: written and read with the token; with chat off, refused and empty", async () => {
		await connect();
		lichess.answers.set("GET /api/board/game/game1234/chat", () => Response.json([{ user: "them", text: "hi" }]));
		await play.sendChat(deps(), "member", "game1234", "good luck");
		expect(Object.fromEntries(lichess.calls.at(-1)?.form ?? [])).toEqual({ room: "player", text: "good luck" });
		expect(await play.chatHistory(deps(), "member", "game1234")).toEqual([
			{ room: "player", username: "them", text: "hi" },
		]);
		await env.db.insert(schema.chSettings).values({ id: 1, features: { chat: false } });
		await expect(play.sendChat(deps(), "member", "game1234", "hi")).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await play.chatHistory(deps(), "member", "game1234")).toEqual([]);
	});
});

describe("streams through our server", () => {
	it("a game's stream: mapped lines and keepalives, then a reconnect when the window ends", async () => {
		await connect();
		const response = await gameStream(deps(), member, "game1234", { windowMs: 200 });
		expect(response.status).toBe(200);
		const reading = lines(response);
		await vi.waitFor(() => expect(lichess.streams.has("GET /api/board/game/stream/game1234")).toBe(true));
		lichess.push("GET /api/board/game/stream/game1234", gameFull());
		lichess.push("GET /api/board/game/stream/game1234", {
			type: "chatLine",
			room: "player",
			username: "them",
			text: "hi",
		});
		lichess.push("GET /api/board/game/stream/game1234", { type: "newThing" });
		const out = (await reading) as ChaalGameLine[];
		expect(out.map((line) => line.type)).toEqual(["gameFull", "chatLine", "reconnect"]);
		expect(out.at(-1)).toEqual({ type: "reconnect", afterMs: 0 });
	});

	it("with chat off, its lines never reach the page; a bad id is a 404; play off is a 403", async () => {
		await connect();
		await env.db.insert(schema.chSettings).values({ id: 1, features: { chat: false } });
		const response = await gameStream(deps(), member, "game1234", { windowMs: 5_000 });
		const reading = lines(response);
		await vi.waitFor(() => expect(lichess.streams.has("GET /api/board/game/stream/game1234")).toBe(true));
		lichess.push("GET /api/board/game/stream/game1234", {
			type: "chatLine",
			room: "player",
			username: "them",
			text: "hi",
		});
		lichess.end("GET /api/board/game/stream/game1234");
		expect(((await reading) as ChaalGameLine[]).map((line) => line.type)).toEqual(["reconnect"]);
		expect((await gameStream(deps(), member, "../event")).status).toBe(404);
		await env.db.update(schema.chSettings).set({ features: { play: false } });
		expect((await gameStream(deps(), member, "game1234")).status).toBe(403);
		expect((await gameStream(deps(), null, "game1234")).status).toBe(401);
	});

	it("a challenge kept open: the form asks Lichess to keep it, and it ends with Lichess's answer", async () => {
		await connect();
		const response = await challengeStream(deps(), member, {
			username: "Them",
			pace: { kind: "clock", clock: { initial: 600, increment: 5 } },
			color: "white",
			rated: false,
		});
		expect(response.status).toBe(200);
		const reading = lines(response);
		const key = "POST /api/challenge/Them";
		await vi.waitFor(() => expect(lichess.streams.has(key)).toBe(true));
		expect(lichess.calls.at(-1)?.form?.get("keepAliveStream")).toBe("true");
		lichess.push(key, { challenge: { id: "chal1234", status: "created" } });
		lichess.push(key, { done: "accepted" });
		lichess.end(key);
		expect(((await reading) as ChaalChallengeLine[]).map((line) => line.type)).toEqual(["challenge", "done"]);
		await vi.waitFor(async () =>
			expect(await activity()).toEqual([expect.objectContaining({ mode: "challenge", ref: "chal1234" })]),
		);
	});

	it("a challenge nobody answers in the window is said expired and cancelled at Lichess; a bad one is refused", async () => {
		await connect();
		const response = await challengeStream(
			deps(),
			member,
			{
				username: "Them",
				pace: { kind: "clock", clock: { initial: 600, increment: 5 } },
				color: "white",
				rated: false,
			},
			{ windowMs: 100 },
		);
		const reading = lines(response);
		await vi.waitFor(() => expect(lichess.streams.has("POST /api/challenge/Them")).toBe(true));
		lichess.push("POST /api/challenge/Them", { id: "chal1234", status: "created" });
		expect(((await reading) as ChaalChallengeLine[]).at(-1)).toEqual({ type: "expired" });
		await vi.waitFor(() => expect(lichess.calls.at(-1)?.path).toBe("/api/challenge/chal1234/cancel"));
		const days = await challengeStream(deps(), member, {
			username: "Them",
			pace: { kind: "days", days: 3 },
			color: "white",
			rated: false,
		});
		expect(days.status).toBe(400);
		expect((await challengeStream(deps(), member, { username: "x" })).status).toBe(400);
	});

	it("the event stream counts a game that has just started, once; a restated one that has moves isn't", async () => {
		await connect();
		const response = await eventStream(deps(), member, { windowMs: 200 });
		const reading = lines(response);
		await vi.waitFor(() => expect(lichess.streams.has("GET /api/stream/event")).toBe(true));
		const start = (id: string, hasMoved: boolean) => ({
			type: "gameStart",
			game: {
				gameId: id,
				color: "white",
				fen: "x",
				source: "friend",
				hasMoved,
				opponent: { id: "them", username: "Them" },
			},
		});
		lichess.push("GET /api/stream/event", start("fresh123", false));
		lichess.push("GET /api/stream/event", start("fresh123", false));
		lichess.push("GET /api/stream/event", start("older123", true));
		await reading;
		await vi.waitFor(async () => expect((await activity()).map((row) => row.ref)).toEqual(["fresh123"]));
	});

	it("a POST from another site is refused", () => {
		const url = "https://chaal.test/api/chaal/stream/challenge";
		expect(sameOrigin(new Headers({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
		expect(sameOrigin(new Headers({ "sec-fetch-site": "cross-site" }), url)).toBe(false);
		expect(sameOrigin(new Headers({ origin: "https://chaal.test" }), url)).toBe(true);
		expect(sameOrigin(new Headers({ origin: "https://evil.test" }), url)).toBe(false);
		expect(sameOrigin(new Headers(), url)).toBe(false);
	});
});

describe("activity", () => {
	it("is kept 90 days by the daily job", async () => {
		const now = Date.UTC(2026, 10, 9);
		await env.db.insert(schema.chActivity).values([
			{ userId: "member", kind: "connect", at: new Date(now - 91 * 86_400_000) },
			{ userId: "member", kind: "connect", at: new Date(now - 89 * 86_400_000) },
		]);
		expect(await runChaalCron(env.db, now)).toMatchObject({ activityPruned: 1, callStatsPruned: 0 });
		expect(await pruneActivity(env.db, now)).toBe(0);
		expect(await activity()).toHaveLength(1);
	});
});

describe("quick pairing and the games in progress (Task 78)", () => {
	const RAPID = { kind: "clock", clock: { initial: 600, increment: 5 } } as const;

	it("a seek on a clock is kept open by its stream, in minutes and seconds; Lichess closing it says ended", async () => {
		await connect();
		const response = await seekStream(deps(), member, { pace: RAPID, rated: true, range: "any" });
		expect(response.status).toBe(200);
		const reading = lines(response);
		const key = "POST /api/board/seek";
		await vi.waitFor(() => expect(lichess.streams.has(key)).toBe(true));
		const call = lichess.calls.at(-1);
		expect(call?.token).toBe("lio_me");
		expect(Object.fromEntries(call?.form ?? [])).toEqual({
			time: "10",
			increment: "5",
			rated: "true",
			variant: "standard",
		});
		lichess.end(key);
		expect((await reading) as ChaalSeekLine[]).toEqual([{ type: "ended" }]);
	});

	it("the window running out asks for a new seek; the page going away cancels it at Lichess", async () => {
		await connect();
		const response = await seekStream(deps(), member, { pace: RAPID, rated: false, range: "any" }, { windowMs: 100 });
		const reading = lines(response);
		expect((await reading) as ChaalSeekLine[]).toEqual([{ type: "reconnect", afterMs: 0 }]);
		const second = await seekStream(deps(), member, { pace: RAPID, rated: false, range: "any" });
		await vi.waitFor(() => expect(lichess.streams.has("POST /api/board/seek")).toBe(true));
		const fetched = lichess.fetcher.mock.calls.at(-1)?.[1]?.signal;
		await second.body?.cancel();
		expect(fetched?.aborted).toBe(true);
	});

	it("a rating range is read around the player's rating at the seek's speed", async () => {
		await connect();
		lichess.answers.set("GET /api/account", () =>
			Response.json({ id: "me", username: "me", perfs: { rapid: { rating: 1500 }, classical: { rating: 1700 } } }),
		);
		lichess.answers.set("POST /api/board/seek", () => Response.json({ id: "seekAbcd" }));
		const seek = await play.seekCorrespondence(deps(), "member", {
			pace: { kind: "days", days: 3 },
			rated: false,
			range: "200",
		});
		expect(seek).toEqual({ id: "seekAbcd" });
		expect(Object.fromEntries(lichess.calls.at(-1)?.form ?? [])).toMatchObject({ days: "3" });
		// No correspondence rating: anyone may join.
		expect(lichess.calls.at(-1)?.form?.has("ratingRange")).toBe(false);
		const response = await seekStream(deps(), member, {
			pace: { kind: "clock", clock: { initial: 1800, increment: 0 } },
			rated: false,
			range: "200",
		});
		lichess.answers.delete("POST /api/board/seek");
		expect(response.status).toBe(200);
		expect(lichess.calls.at(-1)?.form?.get("ratingRange")).toBe("1500-1900");
	});

	it("refuses what the Board API can't seek: blitz, a clock as a call, days as a stream, rated when it's off", async () => {
		await connect();
		const blitz = { kind: "clock", clock: { initial: 300, increment: 0 } };
		expect((await seekStream(deps(), member, { pace: blitz, rated: false, range: "any" })).status).toBe(400);
		expect(
			(await seekStream(deps(), member, { pace: { kind: "days", days: 3 }, rated: false, range: "any" })).status,
		).toBe(400);
		await expect(
			play.seekCorrespondence(deps(), "member", { pace: RAPID, rated: false, range: "any" }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await env.db.insert(schema.chSettings).values({ id: 1, play: { aiMaxLevel: 8, rated: false, quickPair: "all" } });
		expect((await seekStream(deps(), member, { pace: RAPID, rated: true, range: "any" })).status).toBe(403);
		expect((await seekStream(deps(), null, { pace: RAPID, rated: false, range: "any" })).status).toBe(401);
		expect(lichess.calls).toHaveLength(0);
	});

	it("the games in progress: Lichess's list mapped, a game that doesn't read dropped", async () => {
		await connect();
		lichess.answers.set("GET /api/account/playing", () =>
			Response.json({
				nbMyTurn: 1,
				nowPlaying: [
					{
						gameId: "corr1234",
						fullId: "corr1234abcd",
						color: "black",
						fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
						lastMove: "e2e4",
						source: "lobby",
						status: { id: 20, name: "started" },
						variant: { key: "standard", name: "Standard" },
						speed: "correspondence",
						perf: "correspondence",
						rated: true,
						rating: 1500,
						hasMoved: false,
						isMyTurn: true,
						secondsLeft: 259_000,
						opponent: { id: "them", username: "Them", rating: 1550 },
					},
					{ gameId: 42 },
				],
			}),
		);
		const { games } = await play.playingGames(deps(), "member");
		expect(lichess.calls.at(-1)?.search).toBe("?nb=50");
		expect(games).toEqual([
			expect.objectContaining({
				id: "corr1234",
				color: "black",
				speed: "correspondence",
				isMyTurn: true,
				secondsLeft: 259_000,
				opponent: expect.objectContaining({ id: "them", name: "Them" }),
			}),
		]);
	});

	it("berserk goes to the Board API's path on the play lane", async () => {
		await connect();
		await play.gameAction(deps(), "member", "game1234", "berserk");
		expect(lichess.calls.at(-1)).toMatchObject({ method: "POST", path: "/api/board/game/game1234/berserk" });
	});
});
