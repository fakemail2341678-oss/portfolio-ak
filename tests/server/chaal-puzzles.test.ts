import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PuzzleAttempt } from "@/features/chaal/puzzles/schema";
import type { Session } from "@/lib/session";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import type { ChaalPublic } from "@/server/chaal/context";
import { createChaalControls, DEFAULT_CHAAL_SETTINGS } from "@/server/chaal/controls";
import { createChaalGuestData } from "@/server/chaal/guest-data";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import * as puzzles from "@/server/chaal/puzzles/service";
import * as schema from "@/server/db/schema";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";
import { createTestDb } from "../utils/test-db";

/**
 * Puzzles' server side (PLAN Task 80, decision 0269): the daily puzzle and one by id through
 * the cache, visitors' batches by round, a connected player's own batches with their
 * waiting results posted first, recording (what waits for Lichess, the streak's never, the
 * post at five, the cap), importing a browser's attempts, the progress panel with Lichess's
 * dashboard, replays and the guest claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const API = "https://lichess.test";
const DAILY = JSON.parse(readLichessFixture("api_puzzle_daily.json") ?? "{}") as { puzzle: { id: string } };
const BATCH = JSON.parse(readLichessFixture("api_puzzle_batch_mix.ee86ce24.json") ?? "{}") as {
	puzzles: Array<{ puzzle: { id: string } }>;
};

type Call = { method: string; url: URL; token: string | null; body: unknown };
const calls: Call[] = [];
const fetcher = vi.fn<typeof fetch>(async (input, init) => {
	const url = new URL(String(input));
	const token = (init?.headers as Record<string, string>).authorization?.replace("Bearer ", "") ?? null;
	const method = init?.method ?? "GET";
	calls.push({ method, url, token, body: init?.body ? JSON.parse(String(init.body)) : null });
	if (token === "lio_refused") return new Response("{}", { status: 401 });
	if (url.pathname.startsWith("/api/puzzle/batch/")) {
		if (method === "POST") {
			const nb = Number(url.searchParams.get("nb") ?? 0);
			const { solutions } = JSON.parse(String(init?.body)) as { solutions: Array<{ id: string; win: boolean }> };
			return Response.json({
				puzzles: BATCH.puzzles.slice(0, nb),
				glicko: { rating: 1720.4, deviation: 70 },
				rounds: solutions.map((solution) => ({ ...solution, ratingDiff: solution.win ? 6 : -9 })),
			});
		}
		return Response.json({ ...BATCH, ...(token ? { glicko: { rating: 1700, deviation: 75 } } : {}) });
	}
	if (url.pathname.startsWith("/api/puzzle/dashboard/")) {
		return Response.json({
			days: 30,
			global: { nb: 4, firstWins: 3, replayWins: 0, puzzleRatingAvg: 1600, performance: 1650 },
			themes: { fork: { theme: "Fork", results: { nb: 2, firstWins: 1, performance: 1500 } } },
		});
	}
	if (url.pathname.startsWith("/api/puzzle/replay/")) return Response.json({ error: "none" }, { status: 404 });
	const body = readLichessFixture(lichessFixtureName("api", url.pathname, url.searchParams));
	if (body !== undefined) return new Response(body, { status: 200 });
	const id = url.pathname.replace("/api/puzzle/", "");
	const found = BATCH.puzzles.find((entry) => entry.puzzle.id === id);
	return found ? Response.json(found) : Response.json({ error: "Not found" }, { status: 404 });
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

const PUZZLE_SCOPES = ["puzzle:read", "puzzle:write"];

async function connect(userId: string, token = `lio_${userId}`, scopes = PUZZLE_SCOPES) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId: `${userId}_li`,
		username: `${userId}_li`,
		token: await vault.seal(token, "token"),
		scopes,
	});
}

let counter = 0;
const attempt = (overrides: Partial<PuzzleAttempt> = {}): PuzzleAttempt => {
	counter += 1;
	return {
		id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
		puzzleId: BATCH.puzzles[counter % BATCH.puzzles.length]?.puzzle.id ?? "abcde",
		won: true,
		ms: 12_000,
		rating: 1500,
		themes: ["fork"],
		mode: "train",
		angle: "mix",
		streak: null,
		at: new Date(Date.UTC(2026, 10, 9, 10, counter)).toISOString(),
		...overrides,
	};
};

const rowsOf = (userId: string) =>
	env.db.select().from(schema.chPuzzleAttempt).where(eq(schema.chPuzzleAttempt.ownerId, userId));

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(
			["member", "other", "guest"].map((id) => ({
				id,
				name: id,
				email: `${id}@example.com`,
				isAnonymous: id === "guest",
			})),
		);
	});
	vault = await createVault(Buffer.alloc(32, 9).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	calls.length = 0;
	fetcher.mockClear();
});

describe("Chaal's puzzles: Lichess's reads", () => {
	it("the daily puzzle is read once, then from the cache; one by id too", async () => {
		const context = chaal();
		const first = await puzzles.dailyPuzzle(context);
		expect(first.id).toBe(DAILY.puzzle.id);
		await puzzles.dailyPuzzle(context);
		expect(calls.filter((call) => call.url.pathname === "/api/puzzle/daily")).toHaveLength(1);
		const id = BATCH.puzzles[0]?.puzzle.id ?? "";
		expect((await puzzles.puzzleById(context, id)).id).toBe(id);
		await expect(puzzles.puzzleById(context, "zzzzz")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("puzzles off refuses every read before Lichess is asked", async () => {
		const context = chaal({ settings: { ...DEFAULT_CHAAL_SETTINGS, features: { puzzles: false } } });
		await expect(puzzles.dailyPuzzle(context)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(puzzles.puzzleBatch(context, null, { angle: "mix", round: 0, streak: false })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("a visitor's batches are anyone's, cached by round, `ahead` long, one side when asked", async () => {
		const context = chaal({ settings: { ...DEFAULT_CHAAL_SETTINGS, puzzles: { ahead: 6, streak: true } } });
		const batch = await puzzles.puzzleBatch(context, null, {
			angle: "fork",
			difficulty: "harder",
			round: 0,
			streak: false,
		});
		expect(batch).toMatchObject({ source: "public", glicko: null });
		expect(batch.puzzles).toHaveLength(6);
		await puzzles.puzzleBatch(context, null, { angle: "fork", difficulty: "harder", round: 0, streak: false });
		await puzzles.puzzleBatch(context, null, { angle: "fork", difficulty: "harder", round: 1, streak: false });
		expect(calls).toHaveLength(2);
		expect(calls[0]?.url.pathname).toBe("/api/puzzle/batch/fork");
		expect(Object.fromEntries(calls[0]?.url.searchParams ?? [])).toEqual({ nb: "6", difficulty: "harder" });
		expect(calls[0]?.token).toBeNull();
		const white = await puzzles.puzzleBatch(context, null, { angle: "mix", color: "white", round: 0, streak: false });
		expect(white.puzzles.every((puzzle) => puzzle.color === "white")).toBe(true);
		expect(calls.at(-1)?.url.searchParams.get("nb")).toBe("12");
	});

	it("the streak can be turned off", async () => {
		const context = chaal({ settings: { ...DEFAULT_CHAAL_SETTINGS, puzzles: { ahead: 15, streak: false } } });
		await expect(puzzles.puzzleBatch(context, null, { angle: "mix", round: 0, streak: true })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("a connected player trains on their own batches; waiting results go first, with the next batch", async () => {
		await connect("member");
		const shared = deps();
		await puzzles.recordAttempt(shared, "member", attempt({ won: false }));
		await puzzles.recordAttempt(shared, "member", attempt());
		calls.length = 0;
		const context = chaal();
		const batch = await puzzles.puzzleBatch(context, session("member"), { angle: "mix", round: 3, streak: false });
		expect(batch.source).toBe("account");
		expect(batch.glicko).toEqual({ rating: 1720, provisional: false });
		// One call: the solutions posted, the next batch in the same answer.
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ method: "POST", token: "lio_member" });
		expect(calls[0]?.url.searchParams.get("nb")).toBe("15");
		expect((calls[0]?.body as { solutions: unknown[] }).solutions).toHaveLength(2);
		const rows = await rowsOf("member");
		expect(rows.every((row) => row.lichess === "sent")).toBe(true);
		expect(rows.map((row) => row.ratingDiff).sort()).toEqual([-9, 6]);
	});

	it("a refused token falls back to anyone's puzzles; the streak never uses the token", async () => {
		await connect("member", "lio_refused");
		const batch = await puzzles.puzzleBatch(chaal(), session("member"), { angle: "mix", round: 0, streak: false });
		expect(batch.source).toBe("public");
		await env.db.delete(schema.chConnection);
		await connect("other");
		calls.length = 0;
		await puzzles.puzzleBatch(chaal(), session("other"), { angle: "mix", round: 0, streak: true });
		expect(calls.every((call) => call.token === null)).toBe(true);
	});
});

describe("Chaal's puzzles: attempts", () => {
	it("a connected player's attempts wait for Lichess (not the streak's) and go at five", async () => {
		await connect("member");
		const shared = deps();
		await puzzles.recordAttempt(shared, "member", attempt({ mode: "streak", streak: 3 }));
		for (let index = 0; index < 4; index++) await puzzles.recordAttempt(shared, "member", attempt());
		expect(calls).toHaveLength(0);
		expect((await rowsOf("member")).filter((row) => row.lichess === "pending")).toHaveLength(4);
		await puzzles.recordAttempt(shared, "member", attempt({ angle: "fork" }));
		// Two themes, two posts; nothing asked back.
		expect(calls.map((call) => call.url.pathname).sort()).toEqual(["/api/puzzle/batch/fork", "/api/puzzle/batch/mix"]);
		expect(calls.every((call) => call.url.searchParams.get("nb") === "0")).toBe(true);
		const rows = await rowsOf("member");
		expect(rows.find((row) => row.mode === "streak")?.lichess).toBeNull();
		expect(rows.filter((row) => row.lichess === "sent")).toHaveLength(5);
	});

	it("without a connection attempts stay here; the same id twice is one attempt; activity counts the puzzle", async () => {
		const shared = deps();
		const one = attempt();
		await puzzles.recordAttempt(shared, "member", one);
		await puzzles.recordAttempt(shared, "member", one);
		const rows = await rowsOf("member");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.lichess).toBeNull();
		const activity = await env.db.select().from(schema.chActivity);
		expect(activity).toMatchObject([{ userId: "member", kind: "puzzle", ref: one.puzzleId }]);
		expect(calls).toHaveLength(0);
	});

	it("importing keeps only the caller's own ids, and never sends them to Lichess", async () => {
		await connect("member");
		const shared = deps();
		const taken = attempt();
		await puzzles.recordAttempt(shared, "other", taken);
		const mine = [attempt(), attempt()];
		const result = await puzzles.importAttempts(shared, "member", [...mine, taken]);
		expect(result.imported.sort()).toEqual(mine.map((entry) => entry.id).sort());
		expect((await rowsOf("member")).every((row) => row.lichess === null)).toBe(true);
		expect((await rowsOf("other")).map((row) => row.id)).toEqual([taken.id]);
	});

	it("keeps a player's most recent attempts", async () => {
		const shared = deps();
		const old = attempt({ at: new Date(Date.UTC(2020, 0, 1)).toISOString() });
		await puzzles.importAttempts(shared, "member", [old]);
		const many = Array.from({ length: puzzles.PUZZLE_ATTEMPTS_MAX }, () => attempt());
		for (let index = 0; index < many.length; index += 200) {
			await puzzles.importAttempts(shared, "member", many.slice(index, index + 200));
		}
		const rows = await rowsOf("member");
		expect(rows).toHaveLength(puzzles.PUZZLE_ATTEMPTS_MAX);
		expect(rows.some((row) => row.id === old.id)).toBe(false);
	});

	it("the progress panel: the player's figures, then Lichess's dashboard after the waiting results go", async () => {
		const shared = deps();
		const services = { ...shared, cache: createChaalCache() };
		await puzzles.recordAttempt(shared, "member", attempt({ mode: "streak", streak: 7 }));
		let progress = await puzzles.progress(services, "member", Date.UTC(2026, 10, 9, 12));
		expect(progress.stats).toMatchObject({ nb: 1, bestStreak: 7 });
		expect(progress.lichess).toEqual({ state: "connect" });
		await connect("member", "lio_member", ["puzzle:read"]);
		progress = await puzzles.progress(services, "member", Date.UTC(2026, 10, 9, 12));
		expect(progress.lichess).toEqual({ state: "reconnect" });
		await env.db.update(schema.chConnection).set({ scopes: PUZZLE_SCOPES });
		await puzzles.recordAttempt(shared, "member", attempt());
		progress = await puzzles.progress(services, "member", Date.UTC(2026, 10, 9, 12));
		expect(progress.pending).toBe(0);
		expect(progress.lichess).toMatchObject({ state: "ok", dashboard: { nb: 4, firstWins: 3, performance: 1650 } });
		expect(calls.some((call) => call.method === "POST")).toBe(true);
	});

	it("replaying misses: none is an empty list; it needs the puzzle scopes", async () => {
		await expect(puzzles.replay(deps(), "member", "fork")).rejects.toMatchObject({ reason: "lichess-reconnect" });
		await connect("member");
		expect(await puzzles.replay(deps(), "member", "fork")).toEqual({ theme: "fork", remaining: [] });
	});

	it("the guest claim moves a guest's attempts to the account", async () => {
		const shared = deps();
		await puzzles.recordAttempt(shared, "guest", attempt());
		await env.db.transaction((tx) => createChaalGuestData(async () => {}).claim(tx, "guest", "member"));
		expect(await rowsOf("guest")).toHaveLength(0);
		expect(await rowsOf("member")).toHaveLength(1);
	});
});
