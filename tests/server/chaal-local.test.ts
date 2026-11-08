import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type PlayedMove, play } from "@/features/chaal/chess/rules";
import { addLocalMove, endLocalGame, fenOf, newLocalGame, toRecord } from "@/features/chaal/local/game";
import { LOCAL_GAMES_MAX, type LocalGame } from "@/features/chaal/local/types";
import { createChaalControls } from "@/server/chaal/controls";
import { createChaalGuestData } from "@/server/chaal/guest-data";
import * as local from "@/server/chaal/local/service";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Local games on the server (PLAN Task 76, decision 0265): saving as a game goes on, a
 * finished game staying as it ended, another player's id, the PGN checked move by move,
 * the cap, importing a browser's games, the feature's switch, and the guest claim.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const deps = (): local.LocalDeps => ({ db: env.db, controls: createChaalControls(env.db, () => 0) });

let count = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}`;

function game(at = new Date("2026-11-09T10:00:00.000Z"), id = nextId()): LocalGame {
	return newLocalGame({ mode: "engine", level: 2, color: "white", clock: null }, id, at);
}

const moved = (current: LocalGame, uci: string) =>
	addLocalMove(current, play(fenOf(current), uci) as PlayedMove, null, new Date("2026-11-09T10:01:00.000Z"));

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
});
afterAll(() => env.close());
beforeEach(() => env.reset());

describe("local games on the account", () => {
	it("saves a game as it goes on, and lists it", async () => {
		const started = game();
		await local.saveLocalGame(deps(), "member", toRecord(started));
		const later = moved(moved(started, "e2e4"), "e7e5");
		const summary = await local.saveLocalGame(deps(), "member", toRecord(later));
		expect(summary).toMatchObject({ id: started.id, moves: 2, status: "playing", mode: "engine", level: 2 });
		expect(await local.listLocalGames(env.db, "member")).toHaveLength(1);
		const read = await local.getLocalGame(env.db, "member", started.id);
		expect(read.pgn).toContain("1. e4 e5");
		expect(read.createdAt).toBe(started.createdAt);
	});

	it("keeps a finished game as it ended", async () => {
		const ended = endLocalGame(moved(game(), "e2e4"), "0-1", "resign", new Date());
		await local.saveLocalGame(deps(), "member", toRecord(ended));
		const replayed = { ...toRecord(moved(game(undefined, ended.id), "d2d4")) };
		const summary = await local.saveLocalGame(deps(), "member", replayed);
		expect(summary).toMatchObject({ status: "ended", result: "0-1", moves: 1 });
	});

	it("never writes over another player's game, and says it isn't there", async () => {
		const mine = game();
		await local.saveLocalGame(deps(), "member", toRecord(mine));
		await expect(local.saveLocalGame(deps(), "other", toRecord(moved(mine, "e2e4")))).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(local.getLocalGame(env.db, "other", mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(local.deleteLocalGame(env.db, "other", mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await local.getLocalGame(env.db, "member", mine.id)).status).toBe("playing");
	});

	it("reads every move before writing", async () => {
		const record = toRecord(game());
		await expect(
			local.saveLocalGame(deps(), "member", { ...record, pgn: "1. e4 e5 2. Ke3 Ke7 3. Kd5 *" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(local.saveLocalGame(deps(), "member", { ...record, pgn: "1. e4 (1. d4) *" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await expect(local.saveLocalGame(deps(), "member", { ...record, level: null })).rejects.toThrow();
	});

	it(`keeps a player's ${LOCAL_GAMES_MAX} most recently played games`, async () => {
		const base = Date.parse("2026-11-01T00:00:00.000Z");
		const games = Array.from({ length: LOCAL_GAMES_MAX + 2 }, (_, index) =>
			toRecord(game(new Date(base + index * 60_000))),
		);
		await local.importLocalGames(deps(), "member", games);
		const kept = await local.listLocalGames(env.db, "member");
		expect(kept).toHaveLength(LOCAL_GAMES_MAX);
		expect(kept.map((row) => row.id)).not.toContain(games[0]?.id);
		expect(kept[0]?.id).toBe(games.at(-1)?.id);
	});

	it("imports a browser's games, skipping what doesn't read and another player's ids", async () => {
		const theirs = game();
		await local.saveLocalGame(deps(), "other", toRecord(theirs));
		const good = toRecord(moved(game(), "e2e4"));
		const bad = { ...toRecord(game()), pgn: "1. e5 *" };
		const { imported } = await local.importLocalGames(deps(), "member", [good, bad, toRecord(theirs)]);
		expect(imported).toEqual([good.id]);
		expect((await local.listLocalGames(env.db, "member")).map((row) => row.id)).toEqual([good.id]);
	});

	it("refuses writes while the admin has local games off", async () => {
		await env.db.insert(schema.chSettings).values({ id: 1, features: { local: false } });
		await expect(local.saveLocalGame(deps(), "member", toRecord(game()))).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(local.importLocalGames(deps(), "member", [toRecord(game())])).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("moves a guest's games to the account it signs up as", async () => {
		const played = toRecord(moved(game(), "e2e4"));
		await local.saveLocalGame(deps(), "guest", played);
		await env.db.transaction((tx) => createChaalGuestData(vi.fn()).claim(tx, "guest", "member"));
		expect((await local.listLocalGames(env.db, "member")).map((row) => row.id)).toEqual([played.id]);
		expect(await local.listLocalGames(env.db, "guest")).toEqual([]);
	});
});
