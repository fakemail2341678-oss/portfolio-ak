import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYSES_PER_USER } from "@/features/chaal/analysis/schema";
import { START_FEN } from "@/features/chaal/chess/rules";
import { createTree, type GameTree, nodeOf, playOn } from "@/features/chaal/chess/tree";
import type { Session } from "@/lib/session";
import * as data from "@/server/chaal/analysis/lichess";
import * as analyses from "@/server/chaal/analysis/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import type { ChaalPublic } from "@/server/chaal/context";
import { createChaalControls, DEFAULT_CHAAL_SETTINGS } from "@/server/chaal/controls";
import { createChaalGuestData } from "@/server/chaal/guest-data";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import * as schema from "@/server/db/schema";
import { type LichessHost, lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";
import { createTestDb } from "../utils/test-db";

/**
 * The analysis board's server side (PLAN Task 75, decision 0264): Lichess's data through
 * the client and the cache (cloud eval, the explorer and its token, a player's stream, the
 * tablebase, importing a game), answered from the recordings; and "My analyses" (saving,
 * checking the tree, the cap, another player's rows, the guest claim).
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const TABLEBASE_FEN = "4k3/6KP/8/8/8/8/7p/8 w - - 0 1";
const BASES: Record<LichessHost, string> = {
	api: "https://lichess.test",
	explorer: "https://explorer.lichess.test",
	tablebase: "https://tablebase.lichess.test",
};

/** Lichess from the recordings: the explorer needs a token, a token Lichess doesn't know is a 401. */
const calls: Array<{ url: URL; token: string | null }> = [];
const fetcher = vi.fn<typeof fetch>(async (input, init) => {
	const url = new URL(String(input));
	const token = (init?.headers as Record<string, string>).authorization?.replace("Bearer ", "") ?? null;
	calls.push({ url, token });
	const host = (Object.entries(BASES).find(([, base]) => url.origin === base)?.[0] ?? "api") as LichessHost;
	if (host === "explorer" && !token) return new Response("{}", { status: 401 });
	if (token === "lio_refused") return new Response("{}", { status: 401 });
	if (url.pathname === "/game/export/Ongoing1") {
		return Response.json({ id: "Ongoing1", variant: "standard", status: "started", pgn: "1. e4 *" });
	}
	if (url.pathname === "/game/export/Variant1") {
		return Response.json({ id: "Variant1", variant: "chess960", status: "mate", pgn: "1. e4 *" });
	}
	const name = lichessFixtureName(host, url.pathname, url.searchParams);
	const body = readLichessFixture(name) ?? readLichessFixture(name.replace(/\.json$/, ".ndjson"));
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body, { status: 200 });
});

function chaal(overrides: Partial<ChaalPublic> = {}, now = () => 0): ChaalPublic {
	const lichess = createLichess(
		{ apiBase: BASES.api, explorerBase: BASES.explorer, tablebaseBase: BASES.tablebase, userAgent: "t" },
		fetcher,
	);
	const controls = createChaalControls(env.db, () => 0);
	return {
		lichess,
		cache: createChaalCache({ now }),
		controls,
		settings: DEFAULT_CHAAL_SETTINGS,
		appToken: "lip_app",
		connectConfigured: true,
		connectDeps: async () => ({ db: env.db, lichess, vault, controls }),
		...overrides,
	};
}

const session = (id: string): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
});

async function connect(userId: string, token: string) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId: `${userId}_li`,
		username: `${userId}_li`,
		token: await vault.seal(token, "token"),
		scopes: [],
	});
}

function game(...moves: string[]): GameTree {
	let tree = createTree();
	let at = tree.root;
	for (const move of moves) {
		const played = playOn(tree, at, move);
		if (!played) throw new Error(move);
		tree = played.tree;
		at = played.id;
	}
	return tree;
}

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
	vault = await createVault(Buffer.alloc(32, 7).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	fetcher.mockClear();
	calls.length = 0;
});

describe("Lichess's data for the analysis board", () => {
	it("cloud eval: Lichess's lines when it has the position, kept a day; null when not, kept an hour", async () => {
		let time = 0;
		const service = chaal({}, () => time);
		const found = await data.cloudEval(service, AFTER_E4, 3);
		expect(found?.lines).toHaveLength(3);
		expect(await data.cloudEval(service, "8/8/8/4k3/8/8/4K3/8 w - - 0 1", 3)).toBeNull();
		expect(calls).toHaveLength(2);
		// Two hours on: the missing one is asked again, the found one isn't.
		time = 2 * 60 * 60_000 + 1;
		await data.cloudEval(service, AFTER_E4, 3);
		await data.cloudEval(service, "8/8/8/4k3/8/8/4K3/8 w - - 0 1", 3);
		expect(calls).toHaveLength(3);
		expect(calls.at(-1)?.url.pathname).toBe("/api/cloud-eval");
	});

	it("refuses a FEN that isn't a position, and a feature that's off, before Lichess is asked", async () => {
		await expect(data.cloudEval(chaal(), "not a fen", 1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const off = chaal();
		off.settings = { ...off.settings, features: { explorer: false, engine: false } };
		await expect(data.cloudEval(off, AFTER_E4, 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(data.explorer(off, null, { database: "masters", fen: AFTER_E4 })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(data.tablebase(off, TABLEBASE_FEN)).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(calls).toHaveLength(0);
	});

	it("the explorer: a visitor's call carries the app's token on the public lane, and is cached", async () => {
		const service = chaal();
		const result = await data.explorer(service, null, { database: "masters", fen: AFTER_E4 });
		expect(result.ok && result.data.opening?.eco).toBe("B00");
		expect(calls[0]?.token).toBe("lip_app");
		await data.explorer(service, null, { database: "masters", fen: AFTER_E4 });
		expect(calls).toHaveLength(1);
		const lichess = await data.explorer(service, null, { database: "lichess", fen: START_FEN });
		expect(lichess.ok && lichess.data.database).toBe("lichess");
	});

	it("without the app's token a visitor is told to connect; a connected user's own token is used", async () => {
		const service = chaal({ appToken: null });
		expect(await data.explorer(service, null, { database: "masters", fen: AFTER_E4 })).toEqual({
			ok: false,
			reason: "token",
		});
		expect(calls).toHaveLength(0);
		await connect("member", "lio_member");
		const result = await data.explorer(service, session("member"), { database: "masters", fen: AFTER_E4 });
		expect(result.ok).toBe(true);
		expect(calls[0]?.token).toBe("lio_member");
	});

	it("a token Lichess refuses is marked revoked, and the app's token answers instead", async () => {
		await connect("member", "lio_refused");
		const result = await data.explorer(chaal(), session("member"), { database: "masters", fen: AFTER_E4 });
		expect(result.ok).toBe(true);
		expect(calls.map((call) => call.token)).toEqual(["lio_refused", "lip_app"]);
		const [row] = await env.db.select().from(schema.chConnection);
		expect(row?.revokedAt).not.toBeNull();
	});

	it("a player's games: the stream's last line, not indexing once it ended; a name is needed", async () => {
		const result = await data.explorer(chaal(), null, { database: "player", fen: START_FEN, player: "Thibault" });
		expect(result.ok && result.data.indexing).toBe(false);
		expect(result.ok && result.data.games.length).toBeGreaterThan(0);
		expect(calls[0]?.url.searchParams.get("player")).toBe("thibault");
		await expect(data.explorer(chaal(), null, { database: "player", fen: START_FEN })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("the tablebase answers seven pieces or fewer; more is null without asking", async () => {
		const result = await data.tablebase(chaal(), TABLEBASE_FEN);
		expect(result?.result).toBe("win");
		expect(await data.tablebase(chaal(), AFTER_E4)).toBeNull();
		expect(calls).toHaveLength(1);
	});

	it("imports a finished standard game; refuses one in progress, a variant, and one Lichess doesn't have", async () => {
		const daily = JSON.parse(readLichessFixture(lichessFixtureName("api", "/api/puzzle/daily")) ?? "{}") as {
			game: { id: string };
		};
		const imported = await data.importGame(chaal(), daily.game.id);
		expect(imported).toMatchObject({ ok: true, id: daily.game.id, pgn: expect.stringContaining("[White ") });
		expect(await data.importGame(chaal(), "Ongoing1")).toEqual({ ok: false, reason: "in-progress" });
		expect(await data.importGame(chaal(), "Variant1")).toEqual({ ok: false, reason: "variant" });
		expect(await data.importGame(chaal(), "Missing1")).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("My analyses", () => {
	const input = (tree: GameTree, title = "Ruy Lopez") => ({
		title,
		tree,
		tags: { White: "Carlsen", Black: "Caruana" },
		orientation: "white" as const,
	});

	it("saves, lists, opens, updates and deletes the caller's own", async () => {
		const saved = await analyses.saveAnalysis(env.db, "member", input(game("e4", "e5", "Nf3")));
		expect(saved).toMatchObject({ title: "Ruy Lopez", moves: 3, white: "Carlsen", black: "Caruana" });
		expect((await analyses.listAnalyses(env.db, "member")).map((row) => row.id)).toEqual([saved.id]);
		const opened = await analyses.getAnalysis(env.db, "member", saved.id);
		expect(Object.keys(opened.tree.nodes)).toHaveLength(4);
		const updated = await analyses.saveAnalysis(env.db, "member", {
			...input(game("d4"), "Queen's pawn"),
			id: saved.id,
		});
		expect(updated).toMatchObject({ id: saved.id, title: "Queen's pawn", moves: 1 });
		await analyses.deleteAnalysis(env.db, "member", saved.id);
		expect(await analyses.listAnalyses(env.db, "member")).toEqual([]);
	});

	it("another player's analysis is not found, whatever the call", async () => {
		const saved = await analyses.saveAnalysis(env.db, "member", input(game("e4")));
		await expect(analyses.getAnalysis(env.db, "other", saved.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(analyses.saveAnalysis(env.db, "other", { ...input(game("d4")), id: saved.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(analyses.deleteAnalysis(env.db, "other", saved.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(await analyses.listAnalyses(env.db, "other")).toEqual([]);
		expect((await analyses.getAnalysis(env.db, "member", saved.id)).title).toBe("Ruy Lopez");
	});

	it("refuses a tree whose moves don't add up", async () => {
		const tree = game("e4", "e5");
		const forged = { ...tree, nodes: { ...tree.nodes, "2": { ...nodeOf(tree, "2"), san: "Qh4", uci: "d8h4" } } };
		await expect(analyses.saveAnalysis(env.db, "member", input(forged))).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await analyses.listAnalyses(env.db, "member")).toEqual([]);
	});

	it(`keeps at most ${ANALYSES_PER_USER} a player`, async () => {
		const tree = game("e4");
		await env.db.insert(schema.chAnalysis).values(
			Array.from({ length: ANALYSES_PER_USER }, (_, index) => ({
				ownerId: "member",
				title: `Game ${index}`,
				tree,
				startFen: START_FEN,
				moves: 1,
			})),
		);
		await expect(analyses.saveAnalysis(env.db, "member", input(tree))).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(analyses.saveAnalysis(env.db, "other", input(tree))).resolves.toMatchObject({ moves: 1 });
	});

	it("a guest's analyses join the account they sign up or in as", async () => {
		await analyses.saveAnalysis(env.db, "guest", input(game("e4"), "Guest's"));
		await analyses.saveAnalysis(env.db, "member", input(game("d4"), "Member's"));
		await env.db.transaction((tx) => createChaalGuestData(vi.fn()).claim(tx, "guest", "member"));
		expect((await analyses.listAnalyses(env.db, "member")).map((row) => row.title).sort()).toEqual([
			"Guest's",
			"Member's",
		]);
		expect(await analyses.listAnalyses(env.db, "guest")).toEqual([]);
	});
});
