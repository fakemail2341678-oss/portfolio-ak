import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";
import * as settings from "@/server/parda/admin/settings";
import * as adminSources from "@/server/parda/admin/sources";
import type { PardaCatalog } from "@/server/parda/catalog/context";
import { type CatalogServices, popularTitles } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import { runPardaCron } from "@/server/parda/cron";
import { recordPlay } from "@/server/parda/player/plays";
import { handleProbe } from "@/server/parda/player/probe";
import { latestStandings, noteTitleFailure, rollupSources, skippedSources } from "@/server/parda/player/stats";
import { watchPage } from "@/server/parda/player/watch";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Task 65a on PGlite (PLAN 12.5, "Source ranking"; decision 0238): the daily rollup and
 * its scores, the per-title skip and its 24 h, the watch page's orders (automatic,
 * manual, pinned, slow, exploration, deadlines), the probe route, and the admin's view.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const fetcher = vi.fn<typeof fetch>(async (input) => {
	const url = new URL(String(input));
	const name = fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? "");
	const body = readFixture(name);
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
});
const tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fetcher,
);
const services = (): CatalogServices => ({ tmdb, cache: createTmdbCache(), controls: createPardaControls(env.db) });
const catalog = (): PardaCatalog => ({ services: services(), region: "US", cap: null });

const NOW = new Date("2026-11-05T02:30:00.000Z");
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let sources: Array<typeof schema.pdSource.$inferSelect> = [];
const idOf = (n: number) => sources[n - 1]?.id ?? "";

type Play = Partial<typeof schema.pdPlay.$inferInsert>;
/** `count` plays of one source, an hour ago unless said. */
const plays = (n: number, count: number, extra: Play = {}) =>
	env.db.insert(schema.pdPlay).values(
		Array.from({ length: count }, () => ({
			id: randomUUID(),
			viewerKind: "anonymous" as const,
			sourceId: idOf(n),
			media: "movie" as const,
			tmdbId: 550,
			startMs: 4_000,
			watchedS: 600,
			band: "ok" as const,
			createdAt: ago(HOUR),
			...extra,
		})),
	);

const probe = (n: number, extra: Partial<typeof schema.pdSourceProbe.$inferInsert> = {}) =>
	env.db.insert(schema.pdSourceProbe).values({
		sourceId: idOf(n),
		media: "movie",
		tmdbId: 550,
		alive: true,
		startMs: 3_000,
		topHeight: 1080,
		ladder: [],
		createdAt: ago(HOUR),
		...extra,
	});

const standing = async (n: number) => (await latestStandings(env.db)).get(idOf(n));

const admin = () => ({
	db: env.db,
	actor: { id: "admin", isAdmin: true, permissions: [] },
	imageStore: null,
	controls: { invalidate: () => {} },
});

const movie = async () => {
	const first = (await popularTitles(services(), { locale: "en", region: "US", cap: null }, "movie")).results[0];
	if (!first) throw new Error("no fixture");
	return first.id;
};
const watch = async (options: { random?: () => number; now?: Date } = {}) =>
	watchPage(catalog(), env.db, { media: "movie", id: await movie() }, { profileId: null, autoplay: true }, "en", {
		random: () => 0.99,
		...options,
	});

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	sources = await env.db
		.insert(schema.pdSource)
		.values(
			[1, 2, 3, 4].map((n) => ({
				name: { en: `Server ${n}`, ne: `सर्भर ${n}` },
				movieTemplate: `/${n}/movie/{id}?start={start}`,
				tvTemplate: `/${n}/tv/{id}/{season}/{episode}?start={start}`,
				adapter: "parda" as const,
				position: n,
				cdnGroup: n < 3 ? "a" : "b",
			})),
		)
		.returning();
});
afterAll(async () => {
	await env.close();
});

describe("the daily rollup", () => {
	it("rolls 7 days of viewers' plays up per source and band, leaving parties and older plays out", async () => {
		await plays(1, 20, { band: "ok" });
		await plays(1, 10, { band: "slow", failed: true, startMs: null, watchedS: 0 });
		await plays(1, 5, { inParty: true });
		await plays(1, 5, { createdAt: ago(8 * 24 * HOUR) });
		await plays(2, 3, { startMs: 1_000 });
		await rollupSources(env.db, NOW);

		const rows = await env.db
			.select()
			.from(schema.pdSourceStat)
			.where(eq(schema.pdSourceStat.sourceId, idOf(1)));
		const byBand = Object.fromEntries(rows.map((row) => [row.band, row]));
		expect(Object.keys(byBand).sort()).toEqual(["all", "ok", "slow"]);
		expect(byBand.all).toMatchObject({
			day: "2026-11-05",
			plays: 30,
			failed: 10,
			startMedianMs: 4_000,
			watchedS: 12_000,
		});
		expect(byBand.slow).toMatchObject({ plays: 10, failed: 10, startMedianMs: null });
		// 30 plays: viewers decide. 2/3 available, 0.5 quality unknown, smooth, 0.8 speed.
		expect(byBand.all?.score).toBeCloseTo((2 / 3) * (0.4 * 0.5 + 0.4 * 1 + 0.2 * 0.8), 3);
		// Under 20 plays and no probe: no score.
		expect((await standing(2))?.score).toBeNull();
		expect((await standing(2))?.plays).toBe(3);
	});

	it("takes the median and p90 start, stalls per watched minute, and the probe's numbers", async () => {
		await Promise.all(
			Array.from({ length: 20 }, (_, index) => plays(1, 1, { startMs: (index + 1) * 1_000, stallMs: 600 })),
		);
		await probe(1, { topHeight: 720, ladder: [720, 480], popups: 1, clicks: 4 });
		await probe(1, { alive: false, topHeight: null, ladder: [] });
		await probe(2, { topHeight: 1080, ladder: [1080] });
		await probe(3, { createdAt: ago(40 * 24 * HOUR) });
		await rollupSources(env.db, NOW);

		const one = await standing(1);
		expect(one).toMatchObject({
			startMedianMs: 10_500,
			startP90Ms: 18_100,
			probeRuns: 2,
			probeAlive: 1,
			probeHeight: 720,
			probeAdaptive: true,
			probePopups: 1,
			probeClicks: 4,
		});
		expect(one?.probedAt).toBeInstanceOf(Date);
		// Under 20 plays the probe stands in: alive half the time, 1080p, neutral speed and smoothness.
		expect((await standing(2))?.score).toBeCloseTo(1 * (0.4 * 1 + 0.4 * 0.5 + 0.2 * 0.5), 3);
		expect((await standing(2))?.probeAdaptive).toBe(false);
		// The 40-day-old probe is pruned.
		expect(
			await env.db
				.select()
				.from(schema.pdSourceProbe)
				.where(eq(schema.pdSourceProbe.sourceId, idOf(3))),
		).toEqual([]);
	});

	it("replaces the day's rows when run again, keeps 35 days and reads the newest day", async () => {
		await plays(1, 20);
		await rollupSources(env.db, new Date(NOW.getTime() - 40 * 24 * HOUR));
		await rollupSources(env.db, new Date(NOW.getTime() - 24 * HOUR));
		await plays(1, 20, { failed: true });
		await rollupSources(env.db, NOW);
		await rollupSources(env.db, NOW);
		const days = await env.db.selectDistinct({ day: schema.pdSourceStat.day }).from(schema.pdSourceStat);
		expect(days.map((row) => row.day).sort()).toEqual(["2026-11-04", "2026-11-05"]);
		expect((await standing(1))?.plays).toBe(40);
	});

	it("is the cron's second step, and tells the process to read the new scores", async () => {
		const onRanked = vi.fn();
		const result = await runPardaCron(env.db, null, { now: NOW, onRanked });
		expect(result.ranking).toEqual({ ok: true, day: "2026-11-05", sources: 4, scored: 0 });
		expect(onRanked).toHaveBeenCalledOnce();
	});
});

describe("a title's failures", () => {
	const failure = () => ({ sourceId: idOf(1), media: "movie" as const, tmdbId: 550 });

	it("skips a source for that title for 24 h after failures from two clients; one client can't", async () => {
		await noteTitleFailure(env.db, failure(), "client-a", ago(2 * HOUR));
		await noteTitleFailure(env.db, failure(), "client-a", ago(HOUR));
		expect(await skippedSources(env.db, { media: "movie", tmdbId: 550 }, [idOf(1)], NOW)).toEqual(new Set());
		await noteTitleFailure(env.db, failure(), "client-b", NOW);
		expect(await skippedSources(env.db, { media: "movie", tmdbId: 550 }, [idOf(1), idOf(2)], NOW)).toEqual(
			new Set([idOf(1)]),
		);
		// Only this title.
		expect(await skippedSources(env.db, { media: "movie", tmdbId: 551 }, [idOf(1)], NOW)).toEqual(new Set());
		// 24 h later it's back, and the daily job clears the row.
		const tomorrow = new Date(NOW.getTime() + 24 * HOUR + 1);
		expect(await skippedSources(env.db, { media: "movie", tmdbId: 550 }, [idOf(1)], tomorrow)).toEqual(new Set());
		await rollupSources(env.db, tomorrow);
		expect(await env.db.select().from(schema.pdSourceTitleFail)).toEqual([]);
	});

	it("starts counting again after 24 h", async () => {
		await noteTitleFailure(env.db, failure(), "client-a", ago(25 * HOUR));
		await noteTitleFailure(env.db, failure(), "client-b", NOW);
		expect(await skippedSources(env.db, { media: "movie", tmdbId: 550 }, [idOf(1)], NOW)).toEqual(new Set());
		const [row] = await env.db.select().from(schema.pdSourceTitleFail);
		expect(row).toMatchObject({ failures: 1, firstClient: "client-b" });
	});

	it("a playback counts once, when it turns failed", async () => {
		const controls = createPardaControls(env.db);
		const report = {
			playbackId: randomUUID(),
			sourceId: idOf(1),
			media: "movie" as const,
			id: 550,
			failed: false,
			startMs: null,
			stallCount: 0,
			stallMs: 0,
			watchedS: 0,
			switchedAway: false,
			band: "ok" as const,
		};
		expect((await recordPlay(env.db, controls, "anonymous", report)).failedNow).toBe(false);
		expect((await recordPlay(env.db, controls, "anonymous", { ...report, failed: true })).failedNow).toBe(true);
		expect((await recordPlay(env.db, controls, "anonymous", { ...report, failed: true })).failedNow).toBe(false);
		// Someone else's id, naming another title, changes nothing and counts for nothing.
		const other = { ...report, playbackId: randomUUID(), failed: false };
		await recordPlay(env.db, controls, "anonymous", other);
		expect((await recordPlay(env.db, controls, "anonymous", { ...other, id: 551, failed: true })).failedNow).toBe(
			false,
		);
		// A source that's gone counts for nothing.
		const gone = { ...report, playbackId: randomUUID(), sourceId: randomUUID(), failed: true };
		expect((await recordPlay(env.db, controls, "anonymous", gone)).failedNow).toBe(false);
	});
});

describe("the watch page's orders", () => {
	const scoreAll = async () => {
		// Server 3 best, then 2, then 1; Server 4 has no data and keeps its seed slot.
		await plays(1, 20, { startMs: 15_000 });
		await plays(2, 20, { startMs: 8_000 });
		await plays(3, 20, { startMs: 2_000 });
		await rollupSources(env.db, NOW);
	};

	it("keeps the seed order without data, with 15 s deadlines and no quality", async () => {
		const page = await watch();
		expect(page.order.ok).toEqual([1, 2, 3, 4].map(idOf));
		expect(page.sources.every((source) => source.deadlineMs === 15_000 && source.quality === null)).toBe(true);
	});

	it("orders by score in automatic order, with deadlines from the p90 start", async () => {
		await scoreAll();
		const page = await watch();
		expect(page.order.ok).toEqual([3, 2, 1, 4].map(idOf));
		const deadline = Object.fromEntries(page.sources.map((source) => [source.id, source.deadlineMs]));
		expect(deadline[idOf(3)]).toBe(12_000);
		expect(deadline[idOf(1)]).toBe(20_000);
		expect(deadline[idOf(4)]).toBe(15_000);
	});

	it("follows the admin's order in manual mode, and pinned rows lead in either", async () => {
		await scoreAll();
		await settings.setSourceOrder(admin(), { mode: "manual" });
		expect((await watch()).order.ok).toEqual([1, 2, 3, 4].map(idOf));
		await env.db
			.update(schema.pdSource)
			.set({ pinned: true })
			.where(eq(schema.pdSource.id, idOf(4)));
		expect((await watch()).order.ok).toEqual([4, 1, 2, 3].map(idOf));
		await settings.setSourceOrder(admin(), { mode: "auto" });
		expect((await watch()).order.ok).toEqual([4, 3, 2, 1].map(idOf));
	});

	it("puts adaptive sources first for slow connections, the probe's or the admin's, and shows the quality", async () => {
		await probe(2, { ladder: [1080, 720, 480], topHeight: 1080 });
		await rollupSources(env.db, NOW);
		await env.db
			.update(schema.pdSource)
			.set({ adaptive: true, quality: 720 })
			.where(eq(schema.pdSource.id, idOf(4)));
		const page = await watch();
		expect(page.order.slow).toEqual([2, 4, 1, 3].map(idOf));
		const quality = Object.fromEntries(page.sources.map((source) => [source.id, source.quality]));
		expect(quality[idOf(2)]).toBe("1080p");
		expect(quality[idOf(4)]).toBe("720p");
		// The admin's "no" wins over the probe's ladder.
		await env.db
			.update(schema.pdSource)
			.set({ adaptive: false })
			.where(eq(schema.pdSource.id, idOf(2)));
		expect((await watch()).order.slow).toEqual([4, 1, 2, 3].map(idOf));
	});

	it("tries a source failing on this title last", async () => {
		const id = await movie();
		await noteTitleFailure(env.db, { sourceId: idOf(1), media: "movie", tmdbId: id }, "a", ago(HOUR));
		await noteTitleFailure(env.db, { sourceId: idOf(1), media: "movie", tmdbId: id }, "b", ago(HOUR / 2));
		const page = await watch({ now: NOW });
		expect(page.order.ok).toEqual([2, 3, 4, 1].map(idOf));
		// Still in the server menu.
		expect(page.sources.map((source) => source.id)).toContain(idOf(1));
	});

	it("now and then starts on a source short of data, once others have some", async () => {
		await scoreAll();
		expect((await watch({ random: () => 0 })).order.ok[0]).toBe(idOf(4));
		expect((await watch({ random: () => 0.5 })).order.ok[0]).toBe(idOf(3));
	});
});

describe("the probe route", () => {
	const SECRET = "probe-secret-0123456789";
	const call = (method: string, body?: unknown, auth = `Bearer ${SECRET}`, secret: string | null = SECRET) =>
		handleProbe(
			new Request("https://parda.example/api/parda/probe", {
				method,
				headers: { authorization: auth, "content-type": "application/json" },
				...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
			}),
			{ db: env.db, controls: createPardaControls(env.db), secret: secret ?? undefined },
		);
	const result = (extra: Record<string, unknown> = {}) => ({
		sourceId: idOf(1),
		media: "movie",
		tmdbId: 550,
		alive: true,
		startMs: 2_400,
		topHeight: 1080,
		ladder: [1080, 720, 720],
		popups: 1,
		clicks: 3,
		redirects: 0,
		videoHosts: ["Video.Example.com"],
		error: null,
		...extra,
	});

	beforeEach(async () => {
		const title = (media: "movie" | "tv", tmdbId: number, rank: number, genres: number[]) => ({
			media,
			tmdbId,
			title: { en: `${media} ${tmdbId}`, ne: "" },
			genres,
			popularityRank: rank,
		});
		await env.db
			.insert(schema.pdTitle)
			.values([
				title("movie", 550, 1, [18]),
				title("tv", 1396, 2, [18]),
				title("tv", 1429, 1, [16, 10759]),
				title("tv", 9999, 3, [16]),
			]);
	});

	it("is a 404 without the secret and a 401 with the wrong token", async () => {
		expect((await call("GET", undefined, `Bearer ${SECRET}`, null)).status).toBe(404);
		expect((await call("GET", undefined, "Bearer nope")).status).toBe(401);
		expect((await call("PUT")).status).toBe(405);
	});

	it("names the most popular movie, series and anime, and each enabled source's absolute addresses", async () => {
		await env.db
			.update(schema.pdSource)
			.set({ enabled: false })
			.where(eq(schema.pdSource.id, idOf(4)));
		const plan = await (await call("GET")).json();
		expect(plan.titles).toEqual([
			{ media: "movie", id: 550, name: "movie 550" },
			{ media: "tv", id: 1396, season: 1, episode: 1, name: "tv 1396" },
			{ media: "tv", id: 1429, season: 1, episode: 1, name: "tv 1429" },
		]);
		expect(plan.sources).toHaveLength(3);
		expect(plan.sources[0].urls).toEqual([
			"https://parda.example/parda/api/1/movie/550?start=0",
			"https://parda.example/parda/api/1/tv/1396/1/1?start=0",
			"https://parda.example/parda/api/1/tv/1429/1/1?start=0",
		]);
	});

	it("skips a blocked title, and probes nothing while playback is off", async () => {
		await env.db.insert(schema.pdBlockedTitle).values({ media: "tv", tmdbId: 1429, reason: "test" });
		expect((await (await call("GET")).json()).titles.map((title: { id: number }) => title.id)).toEqual([
			550, 1396, 9999,
		]);
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		expect(await (await call("GET")).json()).toEqual({ titles: [], sources: [] });
	});

	it("refuses bad JSON and a bad payload, and stores a run, dropping unknown sources", async () => {
		expect((await call("POST", "{nope")).status).toBe(400);
		expect((await call("POST", { results: [result({ extra: 1 })] })).status).toBe(400);
		expect((await call("POST", { results: [result({ videoHosts: ["bad host/"] })] })).status).toBe(400);
		expect((await call("POST", { results: [] })).status).toBe(400);
		const stored = await call("POST", { results: [result(), result({ sourceId: randomUUID() })] });
		expect(await stored.json()).toEqual({ ok: true, stored: 1, ignored: 1 });
		const [row] = await env.db.select().from(schema.pdSourceProbe);
		expect(row).toMatchObject({ ladder: [1080, 720], videoHosts: ["video.example.com"], season: null });
	});
});

describe("the admin's view", () => {
	it("lists each source's standing, its rank today and the quality in use", async () => {
		await plays(2, 25, { failed: false, stallMs: 3_000 });
		await plays(2, 5, { failed: true });
		await probe(2, { topHeight: 1080, popups: 1, clicks: 2 });
		await probe(3, { topHeight: 480 });
		await env.db
			.update(schema.pdSource)
			.set({ quality: 720 })
			.where(eq(schema.pdSource.id, idOf(1)));
		await env.db
			.update(schema.pdSource)
			.set({ enabled: false })
			.where(eq(schema.pdSource.id, idOf(4)));
		await rollupSources(env.db, NOW);

		const rows = await adminSources.listSources({ db: env.db });
		// Server 1 has no data and keeps its slot; 2 (viewers) and 3 (the probe) are scored; 4 is off.
		expect(rows.map((row) => row.rank)).toEqual([0, 1, 2, null]);
		const two = rows[1];
		expect(two?.standing).toMatchObject({
			from: "viewers",
			plays: 30,
			failureRate: 0.167,
			startMedianMs: 4_000,
			popupsPerClick: 0.5,
			probeRuns: 1,
		});
		expect(two?.standing?.stallPerMinute).toBeCloseTo(75 / 300, 3);
		expect(rows[0]).toMatchObject({ height: 720, heightFrom: "admin", quality: "720", adaptive: "probe" });
		expect(rows[2]).toMatchObject({ height: 480, heightFrom: "probe", standing: { from: "probe" } });
		expect(rows[3]?.standing?.score).toBeNull();
	});

	it("saves the admin's adaptive flag and quality, or leaves them to the probe", async () => {
		const row = await adminSources.getSource({ db: env.db }, idOf(1));
		const saved = await adminSources.updateSource(admin(), { ...row, adaptive: "yes", quality: "2160" });
		expect(saved).toMatchObject({ adaptive: "yes", quality: "2160", height: 2160, adaptiveNow: true });
		const back = await adminSources.updateSource(admin(), { ...saved, adaptive: "probe", quality: "probe" });
		expect(back).toMatchObject({ adaptive: "probe", quality: "probe", height: null, adaptiveNow: false });
		const [stored] = await env.db
			.select()
			.from(schema.pdSource)
			.where(eq(schema.pdSource.id, idOf(1)));
		expect(stored).toMatchObject({ adaptive: null, quality: null });
	});

	it("switches the order's mode, audited once per change", async () => {
		expect((await settings.setSourceOrder(admin(), { mode: "manual" })).sourceOrder).toBe("manual");
		await settings.setSourceOrder(admin(), { mode: "manual" });
		const audits = await env.db
			.select()
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.action, "parda.source.order"));
		expect(audits).toHaveLength(1);
		expect((await settings.getSettings({ db: env.db })).sourceOrder).toBe("manual");
	});
});
