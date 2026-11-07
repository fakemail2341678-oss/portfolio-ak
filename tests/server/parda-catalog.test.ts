import { readFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sourceProblems } from "@/features/parda/player/templates";
import { AppError, isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import { listLabSources, openLabPlayer } from "@/server/parda/admin/player-lab";
import { hubPage, hubRail } from "@/server/parda/catalog/hubs";
import { AWAITED_RAILS, BILLBOARD_SIZE, PAGE_LAYOUTS } from "@/server/parda/catalog/rails";
import { refreshTitles } from "@/server/parda/catalog/refresh";
import { type CatalogServices, popularTitles, titleDetails } from "@/server/parda/catalog/service";
import { titlePage } from "@/server/parda/catalog/title-page";
import { createPardaControls } from "@/server/parda/controls";
import { runPardaCron } from "@/server/parda/cron";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb, type Tmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Parda's catalogue on PGlite (decisions 0229, 0230, 0234): takedowns from every entry
 * point, the cache epoch, locale fill-in, the home and the hubs, the daily refresh, the
 * seeded sources and the lab's service.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

/** TMDB answered from the fixtures, the way the e2e stand-in does. */
const fixtureFetcher = vi.fn<typeof fetch>(async (input) => {
	const url = new URL(String(input));
	const name = fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? "");
	const body = readFixture(name);
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
});
const tmdb: Tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fixtureFetcher,
);

const EN = { locale: "en", region: "US", cap: null } as const;
const NE = { ...EN, locale: "ne" } as const;

let time = 0;
const services = (): CatalogServices => ({
	tmdb,
	cache: createTmdbCache(),
	controls: createPardaControls(env.db, () => time),
});
/** Past the controls' 30 s cache. */
const later = () => {
	time += 30_001;
};

const firstId = async (media: "movie" | "tv") => {
	const { results } = await popularTitles(services(), EN, media);
	const id = results[0]?.id;
	if (!id) throw new Error("no fixture");
	return id;
};

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	fixtureFetcher.mockClear();
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("takedowns", () => {
	const block = (media: "movie" | "tv", tmdbId: number) =>
		env.db.insert(schema.pdBlockedTitle).values({ media, tmdbId, reason: "A notice" });

	it("leave lists and 404 on details", async () => {
		const id = await firstId("movie");
		const live = services();
		expect((await popularTitles(live, EN, "movie")).results.map((row) => row.id)).toContain(id);
		await block("movie", id);
		later();
		expect((await popularTitles(live, EN, "movie")).results.map((row) => row.id)).not.toContain(id);
		const error = await titleDetails(live, EN, "movie", id).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("NOT_FOUND");
	});

	it("apply in Nepali too, and only to that media type", async () => {
		const id = await firstId("movie");
		await block("tv", id);
		const live = services();
		expect((await popularTitles(live, NE, "movie")).results.map((row) => row.id)).toContain(id);
		await block("movie", id);
		later();
		expect((await popularTitles(live, NE, "movie")).results.map((row) => row.id)).not.toContain(id);
	});

	it("never reach TMDB for a blocked title", async () => {
		await block("movie", 123);
		await titleDetails(services(), EN, "movie", 123).catch(() => {});
		expect(fixtureFetcher).not.toHaveBeenCalled();
	});
});

describe("the catalogue", () => {
	it("serves from the cache, until the epoch is bumped", async () => {
		const live = services();
		await popularTitles(live, EN, "movie");
		await popularTitles(live, EN, "movie");
		expect(fixtureFetcher).toHaveBeenCalledTimes(1);
		await env.db.update(schema.pdSettings).set({ cacheEpoch: 1 });
		later();
		await popularTitles(live, EN, "movie");
		expect(fixtureFetcher).toHaveBeenCalledTimes(2);
	});

	it("fills Nepali from the cached English answer", async () => {
		const live = services();
		const english = await popularTitles(live, EN, "movie");
		const nepali = await popularTitles(live, NE, "movie");
		expect(fixtureFetcher).toHaveBeenCalledTimes(2);
		expect(nepali.results.every((row) => row.title !== "")).toBe(true);
		const withOverview = english.results.find((row) => row.overview);
		expect(nepali.results.find((row) => row.id === withOverview?.id)?.overview).toBe(withOverview?.overview);
	});

	it("reads details with the region's certification", async () => {
		const id = await firstId("tv");
		expect(await titleDetails(services(), EN, "tv", id)).toMatchObject({ id, media: "tv" });
	});

	it("rereads the controls after 30 s, and not before", async () => {
		const controls = createPardaControls(env.db, () => time);
		expect((await controls.settings()).cacheEpoch).toBe(0);
		await env.db.update(schema.pdSettings).set({ cacheEpoch: 5 });
		expect((await controls.settings()).cacheEpoch).toBe(0);
		later();
		expect((await controls.settings()).cacheEpoch).toBe(5);
	});
});

describe("the home and the hubs", () => {
	it("send the billboard and the first rails, and leave the rest to stream", async () => {
		for (const page of ["home", "movies", "series", "anime"] as const) {
			const data = await hubPage(services(), EN, page);
			expect(data.billboard.length, page).toBeGreaterThan(0);
			expect(data.billboard.length, page).toBeLessThanOrEqual(BILLBOARD_SIZE);
			expect(
				data.billboard.every((slide) => slide.backdrop),
				page,
			).toBe(true);
			expect(data.rails.map((rail) => rail.id)).toEqual(PAGE_LAYOUTS[page].rails.map((rail) => rail.id));
			for (const [index, rail] of data.rails.entries()) {
				if (index < AWAITED_RAILS) expect(rail.titles, `${page} ${rail.id}`).toEqual(expect.any(Array));
				else expect(rail.titles, `${page} ${rail.id}`).toBeUndefined();
			}
		}
	});

	it("answer every rail of every page from the recording", async () => {
		for (const [page, layout] of Object.entries(PAGE_LAYOUTS)) {
			for (const rail of layout.rails) {
				const { titles } = await hubRail(services(), EN, page as keyof typeof PAGE_LAYOUTS, rail.id);
				expect(titles?.length, `${page} ${rail.id}: run pnpm tmdb:record`).toBeGreaterThan(0);
			}
		}
	});

	it("keep people and adult titles out of trending, and cut long overviews", async () => {
		const data = await hubPage(services(), EN, "home");
		const titles = data.rails.flatMap((rail) => rail.titles ?? []);
		expect(titles.every((title) => title.media === "movie" || title.media === "tv")).toBe(true);
		expect(titles.every((title) => title.overview.length <= 281)).toBe(true);
	});

	it("leave a taken-down title out of the billboard and every rail", async () => {
		const first = (await hubPage(services(), EN, "home")).billboard[0];
		if (!first) throw new Error("no billboard");
		await env.db.insert(schema.pdBlockedTitle).values({ media: first.media, tmdbId: first.id, reason: "A notice" });
		later();
		const live = services();
		const data = await hubPage(live, NE, "home");
		const keys = (titles: ReadonlyArray<{ media: string; id: number }>) => titles.map((t) => `${t.media}:${t.id}`);
		const blocked = `${first.media}:${first.id}`;
		expect(keys(data.billboard)).not.toContain(blocked);
		expect(keys(data.rails.flatMap((rail) => rail.titles ?? []))).not.toContain(blocked);
		const trending = await hubRail(live, EN, "home", "trending");
		expect(keys(trending.titles ?? [])).not.toContain(blocked);
		const type = first.media;
		const error = await titlePage(live, EN, type, first.id).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("NOT_FOUND");
	});

	it("degrade to rails that couldn't load when TMDB is down, and refuse an unknown rail", async () => {
		const down: Tmdb = { ...tmdb, get: () => Promise.reject(new AppError("UPSTREAM_UNAVAILABLE", "down")) };
		const data = await hubPage({ ...services(), tmdb: down }, EN, "movies");
		expect(data.billboard).toEqual([]);
		expect(data.rails.slice(0, AWAITED_RAILS).map((rail) => rail.titles)).toEqual([null, null]);
		expect((await hubRail({ ...services(), tmdb: down }, EN, "movies", "popular")).titles).toBeNull();
		const error = await hubRail(services(), EN, "movies", "nope").catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("NOT_FOUND");
	});

	it("open a title's page with its facts, in Nepali with English filled in", async () => {
		const first = (await hubPage(services(), EN, "home")).billboard[0];
		if (!first) throw new Error("no billboard");
		const data = await titlePage(services(), NE, first.media, first.id);
		expect(data.title).toMatchObject({ id: first.id, media: first.media, title: expect.any(String) });
		expect(data.title.title).not.toBe("");
		expect(data.title.overview.length).toBeGreaterThanOrEqual(first.overview.replace(/…$/, "").length);
	});
});

describe("the daily refresh", () => {
	it("writes ranked titles in both languages, and is safe to run twice", async () => {
		await refreshTitles(env.db, tmdb);
		await refreshTitles(env.db, tmdb);
		const rows = await env.db.select().from(schema.pdTitle).orderBy(asc(schema.pdTitle.popularityRank));
		const movies = rows.filter((row) => row.media === "movie");
		expect(movies.map((row) => row.popularityRank)).toEqual(movies.map((_, index) => index + 1));
		expect(rows.every((row) => row.title.en !== "" && row.title.ne !== "")).toBe(true);
	});

	it("clears the rank of a title that left the list", async () => {
		await env.db.insert(schema.pdTitle).values({
			media: "movie",
			tmdbId: 5,
			title: { en: "Old", ne: "" },
			popularityRank: 1,
		});
		await refreshTitles(env.db, tmdb);
		const [row] = await env.db.select().from(schema.pdTitle).where(eq(schema.pdTitle.tmdbId, 5));
		expect(row?.popularityRank).toBeNull();
	});

	it("is skipped without a token, and reports a failure without throwing", async () => {
		expect((await runPardaCron(env.db, null)).titles).toEqual({ ok: true, skipped: true });
		const broken: Tmdb = { ...tmdb, get: () => Promise.reject(new Error("down")) };
		const failed = await runPardaCron(env.db, broken);
		expect(failed.titles).toEqual({ ok: false });
		// The rollup runs on its own.
		expect(failed.ranking.ok).toBe(true);
		expect((await runPardaCron(env.db, tmdb)).titles.ok).toBe(true);
	});
});

describe("the seeded sources and the lab", () => {
	const seedLikeTheMigration = async () => {
		const migration = readFileSync(new URL("../../drizzle/0028_parda_foundation.sql", import.meta.url), "utf8");
		const statement = migration
			.split("--> statement-breakpoint")
			.find((part) => part.includes('INSERT INTO "pd_source"'));
		if (!statement) throw new Error("no seed in the migration");
		await env.client.exec(statement);
		await env.client.exec(readFileSync(new URL("../../drizzle/0037_parda_player_base.sql", import.meta.url), "utf8"));
	};

	it("seeds servers 1 to 4 on the placeholder's routes, each passing validation", async () => {
		await seedLikeTheMigration();
		const rows = await env.db.select().from(schema.pdSource).orderBy(asc(schema.pdSource.position));
		expect(rows.map((row) => row.name.en)).toEqual(["Server 1", "Server 2", "Server 3", "Server 4"]);
		for (const [index, row] of rows.entries()) {
			expect(row.movieTemplate.startsWith(`/${index + 1}/movie/{id}`)).toBe(true);
			expect(row.tvTemplate.startsWith(`/${index + 1}/tv/{id}/{season}/{episode}`)).toBe(true);
			expect(row.enabled).toBe(true);
			expect(row.adapter).toBe("parda");
			expect(sourceProblems(row)).toEqual([]);
		}
	});

	it("fills any row, disabled too, and adds a cue only for the placeholder's protocol", async () => {
		await seedLikeTheMigration();
		const [first] = await listLabSources(env);
		if (!first) throw new Error("no source");
		await env.db.update(schema.pdSource).set({ enabled: false }).where(eq(schema.pdSource.id, first.id));
		const input = { sourceId: first.id, media: "tv", id: 7, season: 1, episode: 2, start: 30, cue: "stall" } as const;
		expect((await openLabPlayer(env, input)).url).toMatch(
			/^\/parda\/api\/1\/tv\/7\/1\/2\?start=30&lang=\w+&cue=stall$/,
		);
		await env.db.update(schema.pdSource).set({ adapter: "none" }).where(eq(schema.pdSource.id, first.id));
		expect((await openLabPlayer(env, input)).url).not.toContain("cue=");
	});

	it("refuses an unknown source", async () => {
		const error = await openLabPlayer(env, {
			sourceId: "00000000-0000-4000-8000-000000000000",
			media: "movie",
			id: 1,
			season: 1,
			episode: 1,
			start: 0,
			cue: null,
		}).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("NOT_FOUND");
	});
});
