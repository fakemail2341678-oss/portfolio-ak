import { beforeEach, describe, expect, it, vi } from "vitest";
import { TV_CHANNELS } from "@/features/chaal/watch/limits";
import type { ChaalPublic } from "@/server/chaal/context";
import { type ChaalSettingsRow, DEFAULT_CHAAL_SETTINGS } from "@/server/chaal/controls";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import { chaalStatus } from "@/server/chaal/status";
import * as watch from "@/server/chaal/watch/service";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/**
 * Watch on the server (PLAN Task 82, decision 0272): the TV's channels and one export of
 * their games' positions, the admin's channels and streamers, the broadcasts' lists, a
 * tournament, a round and a board's PGN through the public lane and the cache (each TTL as
 * the plan sets it, shorter while a round is played), the watch switch, and the status's
 * live base for the browser.
 */
const API = "https://lichess.test/";
const TOUR = "9NE16qcS";

type Call = { method: string; url: URL; body: string | null };
const calls: Call[] = [];
let now = 1_000_000;
let pgnOverride: string | null = null;

const fetcher = vi.fn<typeof fetch>(async (input, init) => {
	const url = new URL(String(input));
	const method = init?.method ?? "GET";
	calls.push({ method, url, body: typeof init?.body === "string" ? init.body : null });
	if (url.pathname.endsWith(".pgn") && pgnOverride !== null) return new Response(pgnOverride);
	const name = lichessFixtureName("api", url.pathname, url.searchParams);
	const body =
		readLichessFixture(name) ??
		readLichessFixture(name.replace(/\.json$/, ".ndjson")) ??
		(url.pathname === "/api/games/export/_ids"
			? readLichessFixture(lichessFixtureName("api", url.pathname, url.searchParams).replace(/\.json$/, ".ndjson"))
			: undefined);
	if (body === undefined) return Response.json({ error: "Not found" }, { status: 404 });
	return new Response(body, { status: 200 });
});

function chaal(settings: Partial<ChaalSettingsRow> = {}) {
	return {
		lichess: createLichess({ apiBase: API, explorerBase: API, tablebaseBase: API, userAgent: "t" }, fetcher, {
			now: () => now,
		}),
		cache: createChaalCache({ now: () => now }),
		settings: { ...DEFAULT_CHAAL_SETTINGS, ...settings },
	};
}

const pathsCalled = () => calls.map((call) => `${call.method} ${call.url.pathname}`);

beforeEach(() => {
	calls.length = 0;
	fetcher.mockClear();
	now = 1_000_000;
	pgnOverride = null;
});

describe("Watch on the server", () => {
	it("reads the TV's channels, then one export of their games by id, and keeps both 5 s", async () => {
		const shared = chaal();
		const tv = await watch.tv(shared);
		expect(pathsCalled()).toEqual(["GET /api/tv/channels", "POST /api/games/export/_ids"]);
		const exportCall = calls[1];
		expect(exportCall?.url.searchParams.get("moves")).toBe("false");
		expect(exportCall?.url.searchParams.get("lastFen")).toBe("true");
		expect(exportCall?.body?.split(",")).toHaveLength(TV_CHANNELS.length);
		// In the grid's order, each with its game's last position and the side it follows.
		expect(tv.games.map((game) => game.channel)).toEqual(
			TV_CHANNELS.filter((channel) => tv.games.some((game) => game.channel === channel)),
		);
		expect(tv.games.length).toBeGreaterThan(5);
		for (const game of tv.games) {
			expect(game.fen).toBeTruthy();
			expect(["white", "black"]).toContain(game.orientation);
		}
		await watch.tv(shared);
		expect(calls).toHaveLength(2);
		// After 5 s both are read again (in the background: the stale answer serves meanwhile).
		now += 6_000;
		await watch.tv(shared);
		await vi.waitFor(() => expect(calls).toHaveLength(4));
	});

	it("shows only the admin's channels; a failed export leaves the games out without failing", async () => {
		const tv = await watch.tv(chaal({ watch: { channels: ["blitz", "rapid"], streamers: true } }));
		expect(tv.games.map((game) => game.channel)).toEqual(["blitz", "rapid"]);
		expect(calls[1]?.body?.split(",")).toHaveLength(2);
		fetcher.mockImplementationOnce(async (input) => {
			calls.push({ method: "GET", url: new URL(String(input)), body: null });
			return new Response(readLichessFixture("api_tv_channels.json"));
		});
		fetcher.mockImplementationOnce(async () => new Response("", { status: 503 }));
		expect(await watch.tv(chaal())).toEqual({ games: [] });
	});

	it("lists the streamers live now, unless the admin hides them (then Lichess isn't asked)", async () => {
		const live = await watch.streamers(chaal());
		expect(live.length).toBeGreaterThan(0);
		calls.length = 0;
		expect(await watch.streamers(chaal({ watch: { channels: [...TV_CHANNELS], streamers: false } }))).toEqual([]);
		expect(calls).toHaveLength(0);
	});

	it("reads the broadcasts' lists through the cache for five minutes; a search is asked in lowercase", async () => {
		const shared = chaal();
		const top = await watch.broadcasts(shared, 1);
		expect(top.active.length).toBeGreaterThan(0);
		await watch.broadcasts(shared, 1);
		expect(calls).toHaveLength(1);
		now += 4 * 60_000;
		await watch.broadcasts(shared, 1);
		expect(calls).toHaveLength(1);
		const official = await watch.officialBroadcasts(shared);
		expect(official).toHaveLength(20);
		expect(calls.at(-1)?.url.searchParams.get("nb")).toBe("20");
		const found = await watch.searchBroadcasts(shared, " SPICE ", 1);
		expect(calls.at(-1)?.url.searchParams.get("q")).toBe("spice");
		expect(found.results.some((each) => each.id === TOUR)).toBe(true);
	});

	it("reads a tournament (NOT_FOUND for one Lichess doesn't have), a round and a board's PGN", async () => {
		const shared = chaal();
		const tour = await watch.broadcastTour(shared, TOUR);
		expect(tour.defaultRound).toBe("9gsZmGXg");
		await expect(watch.broadcastTour(shared, "nOtThere")).rejects.toMatchObject({ code: "NOT_FOUND" });
		const round = await watch.broadcastRound(shared, "9gsZmGXg");
		expect(round.boards.length).toBeGreaterThan(0);
		const board = round.boards[0]?.id ?? "";
		const game = await watch.broadcastGame(shared, "9gsZmGXg", board);
		expect(game).toMatchObject({ round: "9gsZmGXg", board });
		expect(game.pgn).toContain("[GameURL");
		expect(calls.at(-1)?.url.pathname).toBe(`/api/study/9gsZmGXg/${board}.pgn`);
		await expect(watch.broadcastGame(shared, "9gsZmGXg", "nOtThere")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("keeps a game being played 20 s and a finished one five minutes, and refuses a PGN too long to read", async () => {
		const shared = chaal();
		pgnOverride = '[Result "*"]\n\n1. e4 *';
		await watch.broadcastGame(shared, "rOuNd001", "boArD001");
		now += 25_000;
		await watch.broadcastGame(shared, "rOuNd001", "boArD001");
		expect(calls).toHaveLength(2);
		pgnOverride = '[Result "1-0"]\n\n1. e4 1-0';
		await watch.broadcastGame(shared, "rOuNd001", "boArD002");
		now += 25_000;
		await watch.broadcastGame(shared, "rOuNd001", "boArD002");
		expect(calls).toHaveLength(3);
		pgnOverride = "x".repeat(600_000);
		await expect(watch.broadcastGame(shared, "rOuNd001", "boArD003")).rejects.toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
		});
	});

	it("refuses every read when the admin turns watch off, before Lichess is asked", async () => {
		const off = chaal({ features: { watch: false } });
		const reads = [
			() => watch.tv(off),
			() => watch.streamers(off),
			() => watch.broadcasts(off, 1),
			() => watch.officialBroadcasts(off),
			() => watch.searchBroadcasts(off, "spice", 1),
			() => watch.broadcastTour(off, TOUR),
			() => watch.broadcastRound(off, "9gsZmGXg"),
			() => watch.broadcastGame(off, "9gsZmGXg", "qA1AQnT5"),
		];
		for (const read of reads) await expect(read()).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(calls).toHaveLength(0);
	});

	it("tells the browser where Lichess's public live data is, and the admin's watch controls", () => {
		const shared = chaal({ watch: { channels: ["classical"], streamers: false } });
		const status = chaalStatus(
			{
				...shared,
				controls: {} as ChaalPublic["controls"],
				appToken: null,
				connectConfigured: true,
				connectDeps: async () => {
					throw new Error("unused");
				},
			},
			null,
		);
		expect(status.live).toBe("https://lichess.test");
		expect(status.watch).toEqual({ channels: ["classical"], streamers: false });
		expect(status.features.watch).toBe(true);
	});
});
