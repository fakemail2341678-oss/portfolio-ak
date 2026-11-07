import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ndjsonLines, parseLine } from "@/features/chaal/live/ndjson";
import { AppError } from "@/lib/errors";
import { chaalCacheKey, createChaalCache, untilUtcMidnight } from "@/server/chaal/lichess/cache";
import {
	COOLDOWN_MS,
	createLichess,
	LichessAuthError,
	type LichessRequest,
	memoryCooldowns,
	nextCooldown,
} from "@/server/chaal/lichess/client";
import { cooldownKey, createLanes, playLane, userLane } from "@/server/chaal/lichess/lanes";
import { accountAnswer, dailyPuzzleAnswer, mapStreamEvent, tokenAnswer } from "@/server/chaal/lichess/schemas";
import { lichessFixtureName, readLichessFixture } from "../../e2e/harness/lichess";

/** Chaal's Lichess client (PLAN 13.5, decision 0255): lanes, timeouts, retries, cooldowns, lean answers, ndjson. */

const CONFIG = {
	apiBase: "https://lichess.test",
	explorerBase: "https://explorer.lichess.test",
	tablebaseBase: "https://tablebase.lichess.test",
	userAgent: "Chaal/test",
};
const daily: LichessRequest = { endpoint: "puzzle-daily", path: "/api/puzzle/daily", lane: "public" };
const recordedDaily = () => {
	const body = readLichessFixture(lichessFixtureName("api", "/api/puzzle/daily"));
	if (!body) throw new Error("tests/fixtures/lichess: run pnpm lichess:record");
	return body;
};

const answer = (status: number, body: unknown = {}) =>
	new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe("the Lichess client", () => {
	it("maps an answer to its lean shape, with our user agent and no token when none is given", async () => {
		const fetcher = vi.fn<typeof fetch>(async () => answer(200, recordedDaily()));
		const lichess = createLichess(CONFIG, fetcher);
		const puzzle = await lichess.json(daily, dailyPuzzleAnswer);
		const recorded = JSON.parse(recordedDaily()) as { puzzle: { id: string } };
		expect(puzzle.id).toBe(recorded.puzzle.id);
		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://lichess.test/api/puzzle/daily");
		const headers = init?.headers as Record<string, string>;
		expect(headers["user-agent"]).toBe("Chaal/test");
		expect(headers.authorization).toBeUndefined();
	});

	it("an answer of the wrong shape is unavailable, not passed on", async () => {
		const lichess = createLichess(CONFIG, async () => answer(200, { puzzle: { rating: "high" } }));
		await expect(lichess.json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
	});

	it("times out after its limit, as unavailable", async () => {
		const fetcher = vi.fn<typeof fetch>(
			(_url, init) =>
				new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
		);
		const lichess = createLichess(CONFIG, fetcher, { timeoutMs: 20 });
		await expect(lichess.json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
	});

	it("retries a GET once after a 5xx, never a POST", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(answer(502))
			.mockResolvedValueOnce(answer(200, recordedDaily()));
		const lichess = createLichess(CONFIG, fetcher);
		await expect(lichess.json(daily, dailyPuzzleAnswer)).resolves.toMatchObject({ id: expect.any(String) });
		expect(fetcher).toHaveBeenCalledTimes(2);

		const failing = vi.fn<typeof fetch>(async () => answer(503));
		const post = createLichess(CONFIG, failing);
		await expect(
			post.send({ endpoint: "token", method: "POST", path: "/api/token", form: { a: "b" }, lane: "public" }),
		).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
		expect(failing).toHaveBeenCalledTimes(1);
		const twice = vi.fn<typeof fetch>(async () => answer(500));
		await expect(createLichess(CONFIG, twice).json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
		});
		expect(twice).toHaveBeenCalledTimes(2);
	});

	it("a 401 with a user's token means reconnect; without a token, only that the endpoint needs one", async () => {
		const lichess = createLichess(CONFIG, async () => answer(401));
		const account = { endpoint: "account", path: "/api/account", token: "lio_abc", lane: userLane("u1") } as const;
		const error = await lichess.json(account, accountAnswer).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(LichessAuthError);
		expect(error).toMatchObject({ code: "FORBIDDEN", reason: "lichess-reconnect" });
		const explorer = await lichess
			.json({ endpoint: "explorer", host: "explorer", path: "/masters", lane: "public" }, accountAnswer)
			.catch((caught: unknown) => caught);
		expect(explorer).toBeInstanceOf(AppError);
		expect(explorer).not.toBeInstanceOf(LichessAuthError);
		expect(explorer).toMatchObject({ code: "FORBIDDEN", reason: undefined });
		await expect(createLichess(CONFIG, async () => answer(404)).json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("a 429 starts a cooldown for its key: calls on that key fail fast, other keys go on, and a connection's two lanes share one", async () => {
		let time = 1_000_000;
		const cooldowns = memoryCooldowns();
		const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(answer(429));
		fetcher.mockImplementation(async () => answer(200, recordedDaily()));
		const lichess = createLichess(CONFIG, fetcher, { cooldowns, now: () => time });

		await expect(lichess.json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({
			code: "RATE_LIMITED",
			reason: "lichess-wait",
		});
		expect(await cooldowns.read("public")).toEqual({ until: time + COOLDOWN_MS, ms: COOLDOWN_MS });
		await expect(lichess.json(daily, dailyPuzzleAnswer)).rejects.toMatchObject({ reason: "lichess-wait" });
		expect(fetcher).toHaveBeenCalledTimes(1);
		// A user's own lane isn't the public one.
		await lichess.json({ ...daily, token: "lio_abc", lane: userLane("u1") }, dailyPuzzleAnswer);
		expect(fetcher).toHaveBeenCalledTimes(2);

		await cooldowns.start(cooldownKey(userLane("u1")), { until: time + COOLDOWN_MS, ms: COOLDOWN_MS });
		await expect(lichess.send({ ...daily, method: "POST", lane: playLane("u1") })).rejects.toMatchObject({
			reason: "lichess-wait",
		});
		time += COOLDOWN_MS;
		await expect(lichess.json(daily, dailyPuzzleAnswer)).resolves.toMatchObject({ id: expect.any(String) });
	});

	it("a cooldown doubles when a 429 comes within ten minutes of the last one ending, up to an hour", () => {
		const first = nextCooldown(null, 0);
		expect(first).toEqual({ until: 60_000, ms: 60_000 });
		const second = nextCooldown(first, first.until + 5 * 60_000);
		expect(second.ms).toBe(120_000);
		expect(nextCooldown(second, second.until + 11 * 60_000).ms).toBe(60_000);
		let cooldown = first;
		for (let index = 0; index < 10; index++) cooldown = nextCooldown(cooldown, cooldown.until);
		expect(cooldown.ms).toBe(60 * 60_000);
	});

	it("runs one call at a time per lane, in order, while other lanes go on", async () => {
		const lanes = createLanes();
		const order: string[] = [];
		let release: () => void = () => {};
		const slow = lanes.run("public", () =>
			new Promise<void>((resolve) => (release = resolve)).then(() => order.push("first")),
		);
		const next = lanes.run("public", async () => order.push("second"));
		await lanes.run(userLane("u1"), async () => order.push("other lane"));
		expect(order).toEqual(["other lane"]);
		release();
		await Promise.all([slow, next]);
		expect(order).toEqual(["other lane", "first", "second"]);
		// A failed call doesn't stop the lane.
		await expect(lanes.run("public", () => Promise.reject(new Error("no")))).rejects.toThrow("no");
		await expect(lanes.run("public", async () => "after")).resolves.toBe("after");
		await vi.waitFor(() => expect(lanes.busy()).toBe(0));
	});

	it("counts and logs every call by endpoint, never with its token", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(answer(200, recordedDaily()))
			.mockResolvedValueOnce(answer(401));
		const lichess = createLichess(CONFIG, fetcher);
		await lichess.json({ ...daily, token: "lio_secret_token_value", lane: userLane("u1") }, dailyPuzzleAnswer);
		await lichess
			.json({ ...daily, token: "lio_secret_token_value", lane: userLane("u1") }, dailyPuzzleAnswer)
			.catch(() => {});
		expect(lichess.counters.snapshot()["puzzle-daily"]).toMatchObject({ calls: 2, errors: 1, lastStatus: 401 });
		const logged = [...info.mock.calls, ...warn.mock.calls].map((call) => String(call[0])).join("\n");
		expect(logged).toContain('"endpoint":"puzzle-daily"');
		expect(logged).not.toContain("lio_secret_token_value");
	});

	it("a stream's timeout covers its headers only, and a refused stream is an error before any body", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				setTimeout(() => {
					controller.enqueue(new TextEncoder().encode("\n"));
					controller.close();
				}, 60);
			},
		});
		const lichess = createLichess(CONFIG, async () => new Response(body), { timeoutMs: 20 });
		const stream = await lichess.stream({
			endpoint: "stream:event",
			path: "/api/stream/event",
			token: "t",
			lane: userLane("u1"),
		});
		const lines: string[] = [];
		for await (const line of ndjsonLines(stream)) lines.push(line);
		expect(lines).toEqual([""]);
		await expect(
			createLichess(CONFIG, async () => answer(401)).stream({
				endpoint: "stream:event",
				path: "/api/stream/event",
				token: "t",
				lane: userLane("u1"),
			}),
		).rejects.toBeInstanceOf(LichessAuthError);
	});
});

describe("ndjson", () => {
	const streamOf = (...chunks: string[]) =>
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
				controller.close();
			},
		});
	const read = async (stream: ReadableStream<Uint8Array>) => {
		const lines: string[] = [];
		for await (const line of ndjsonLines(stream)) lines.push(line);
		return lines;
	};

	it("joins lines split across chunks, accepts CRLF, keeps keepalives as empty lines and reads a last line without a newline", async () => {
		expect(await read(streamOf('{"a":', '1}\n\n{"b"', ":2}\r\n", '{"c":3}'))).toEqual([
			'{"a":1}',
			"",
			'{"b":2}',
			'{"c":3}',
		]);
	});

	it("splits a multi-byte character across chunks without breaking it", async () => {
		const bytes = new TextEncoder().encode('{"name":"चाल"}\n');
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 12));
				controller.enqueue(bytes.slice(12));
				controller.close();
			},
		});
		expect(parseLine((await read(stream))[0] ?? "")).toEqual({ name: "चाल" });
	});

	it("parseLine: a keepalive or a broken line is undefined", () => {
		expect(parseLine("")).toBeUndefined();
		expect(parseLine("{not json")).toBeUndefined();
	});
});

describe("Lichess's answers, mapped", () => {
	it("the event stream: known events become Chaal's lean events, an unknown type is dropped", () => {
		const lines = readFileSync("tests/fixtures/lichess/events.ndjson", "utf8").split("\n").filter(Boolean);
		const events = lines.map((line) => mapStreamEvent(parseLine(line)));
		expect(events.map((event) => event?.type ?? null)).toEqual(["challenge", "gameStart", null, "gameFinish"]);
		expect(events[0]).toMatchObject({
			challenge: {
				id: "qUfdwN17",
				challenger: { id: "e2e_rival", name: "E2E_Rival", title: "FM" },
				timeControl: { limit: 600, increment: 5 },
			},
		});
		expect(events[1]).toMatchObject({
			game: {
				id: "kUhShhgl",
				status: "started",
				variant: "standard",
				opponent: { id: null, aiLevel: 1 },
				boardCompatible: true,
			},
		});
		expect(events[3]).toMatchObject({ game: { winner: "black", ratingDiff: -5 } });
		// A lean shape: nothing Chaal doesn't use (the player's secret full id included).
		expect(JSON.stringify(events[1])).not.toContain("fullId");
	});

	it("the token and the account", () => {
		expect(tokenAnswer.parse({ token_type: "Bearer", access_token: "lio_abc", expires_in: 31_536_000 })).toEqual({
			token: "lio_abc",
			expiresInSeconds: 31_536_000,
		});
		expect(() => tokenAnswer.parse({ token_type: "Bearer", access_token: "bad token!", expires_in: 1 })).toThrow();
		expect(accountAnswer.parse({ id: "E2E_Player", username: "E2E_Player", title: "FM", perfs: {} })).toEqual({
			id: "e2e_player",
			username: "E2E_Player",
			title: "FM",
			closed: false,
		});
	});
});

describe("Chaal's cache", () => {
	it("serves what it holds while Lichess asks us to wait or is down, and fails when it holds nothing", async () => {
		let time = 0;
		const cache = createChaalCache({ now: () => time });
		const key = { endpoint: "puzzle-daily", path: "/api/puzzle/daily", epoch: 0 };
		await cache.read(key, 1_000, async () => "puzzle");
		time += 10_000;
		const wait = new AppError("RATE_LIMITED", "cooldown", { reason: "lichess-wait" });
		await expect(cache.read(key, 1_000, () => Promise.reject(wait))).resolves.toBe("puzzle");
		await expect(
			cache.read(key, 1_000, () => Promise.reject(new AppError("UPSTREAM_UNAVAILABLE", "down"))),
		).resolves.toBe("puzzle");
		await expect(cache.read({ ...key, epoch: 1 }, 1_000, () => Promise.reject(wait))).rejects.toBe(wait);
		// Our own rate limit isn't Lichess's: it isn't hidden.
		const ours = new AppError("RATE_LIMITED", "too many");
		await expect(cache.read(key, 1_000, () => Promise.reject(ours))).rejects.toBe(ours);
	});

	it("keys carry the epoch and, for a personal read, its owner; parameters in any order", () => {
		const key = { endpoint: "profile", path: "/api/account", params: { a: 1, b: 2 }, epoch: 0 };
		expect(chaalCacheKey(key)).toBe(chaalCacheKey({ ...key, params: { b: 2, a: 1 } }));
		expect(chaalCacheKey({ ...key, epoch: 1 })).not.toBe(chaalCacheKey(key));
		expect(chaalCacheKey({ ...key, owner: "u1" })).not.toBe(chaalCacheKey({ ...key, owner: "u2" }));
	});

	it("the daily puzzle is fresh until midnight UTC", () => {
		const noon = Date.UTC(2026, 10, 7, 12);
		expect(untilUtcMidnight(noon)).toBe(12 * 3_600_000);
		expect(untilUtcMidnight(Date.UTC(2026, 10, 8) - 1)).toBe(1_000);
	});
});
