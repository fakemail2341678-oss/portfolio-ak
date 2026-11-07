import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { billboardInput, collectionInput } from "@/features/parda/admin/schema";
import { AppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { PardaCurator } from "@/server/parda/admin/context";
import * as curation from "@/server/parda/admin/curation";
import { getOverview } from "@/server/parda/admin/overview";
import { hubPage, hubRail } from "@/server/parda/catalog/hubs";
import { curatedPage } from "@/server/parda/catalog/people";
import { PAGE_LAYOUTS } from "@/server/parda/catalog/rails";
import { type CatalogServices, titleDetails } from "@/server/parda/catalog/service";
import { pardaSitemapEntries } from "@/server/parda/catalog/sitemap";
import { createPardaControls } from "@/server/parda/controls";
import { runPardaCron } from "@/server/parda/cron";
import { collectionRailKey, liveBillboards, loadCuration } from "@/server/parda/curation";
import { rollupDaily } from "@/server/parda/player/daily";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb, type Tmdb } from "@/server/parda/tmdb/client";
import { fixtureName, popularFixture, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Task 69 on PGlite (PLAN 12.5, decision 0242): billboard slots, collections and the
 * layout, as the admin saves them and as the pages show them, and the overview's rollup,
 * prune and numbers.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const tmdb: Tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	async (input) => {
		const url = new URL(String(input));
		const name = fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? "");
		const body = readFixture(name);
		return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
	},
);

const EN = { locale: "en", region: "US", cap: null } as const;
const NE = { ...EN, locale: "ne" } as const;
const KIDS = { ...EN, cap: "G" } as const;

const NOW = new Date("2026-11-05T06:00:00Z");
const invalidate = vi.fn();

const services = (): CatalogServices => ({ tmdb, cache: createTmdbCache(), controls: createPardaControls(env.db) });
const curator = (): PardaCurator => ({
	db: env.db,
	actor: { id: "admin", isAdmin: true, permissions: [] },
	imageStore: null,
	controls: { invalidate },
	catalog: services(),
});

const auditOf = (action: string) => env.db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, action));

/** Popular titles whose details are recorded, with a backdrop: only those can be chosen here. */
const recorded: Record<"movie" | "tv", number[]> = { movie: [], tv: [] };
const movie = (index = 0) => recorded.movie[index] as number;
const series = (index = 0) => recorded.tv[index] as number;

const SLOT = {
	page: "home" as const,
	title: "",
	tagline: { en: "", ne: "" },
	startsOn: "",
	endsOn: "",
};
const COLLECTION = {
	name: { en: "Festival picks", ne: "चाडपर्वका छनोट" },
	slug: "festival-picks",
	description: { en: "", ne: "" },
	published: true,
	items: [] as string[],
};

const fieldErrorsOf = async (promise: Promise<unknown>) => {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	expect(error).toBeInstanceOf(AppError);
	return (error as AppError).fieldErrors ?? {};
};

beforeAll(async () => {
	env = await createTestDb("curation");
	for (const media of ["movie", "tv"] as const) {
		for (let index = 0; index < 20; index += 1) {
			const { id } = popularFixture(media, index);
			const details = await titleDetails(services(), EN, media, id).catch(() => null);
			if (details?.backdrop) recorded[media].push(id);
		}
	}
	if (recorded.movie.length < 6 || recorded.tv.length < 1) throw new Error("not enough recorded titles");
}, 120_000);
beforeEach(async () => {
	await env.reset();
	invalidate.mockClear();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
});
afterAll(async () => {
	await env?.close();
});

describe("billboard slots", () => {
	it("lead the page's billboard, with the admin's tagline, and the rail fills the rest", async () => {
		const id = movie(3);
		const slot = await curation.createBillboard(curator(), {
			...SLOT,
			title: `movie:${id}`,
			tagline: { en: "Our pick", ne: "हाम्रो छनोट" },
		});
		expect(slot.state).toBe("live");
		expect(slot.title?.en).toBeTruthy();
		expect(await auditOf("parda.billboard.create")).toHaveLength(1);
		expect(invalidate).toHaveBeenCalled();

		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.billboard[0]).toMatchObject({ media: "movie", id, tagline: "Our pick" });
		expect(page.billboard).toHaveLength(5);
		expect(new Set(page.billboard.map((each) => `${each.media}:${each.id}`)).size).toBe(5);
		expect((await hubPage(services(), NE, "home", NOW)).billboard[0]?.tagline).toBe("हाम्रो छनोट");
		// Another page's billboard isn't touched.
		expect((await hubPage(services(), EN, "series", NOW)).billboard.map((each) => each.id)).not.toContain(id);
	});

	it("keep TMDB's tagline when theirs is empty", async () => {
		await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(3)}` });
		const rows = await env.db.select().from(schema.pdBillboard);
		expect(rows[0]?.tagline).toBeNull();
		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.billboard[0]?.tagline).toBe((await titleDetails(services(), EN, "movie", movie(3))).tagline);
	});

	it("offer Play when a source can start the slide, and Details without one or with playback off (0244)", async () => {
		expect((await hubPage(services(), EN, "home", NOW)).billboard.some((each) => each.playable)).toBe(false);
		await env.db.insert(schema.pdSource).values({
			name: { en: "Server 1", ne: "सर्भर १" },
			movieTemplate: "/1/movie/{id}",
			tvTemplate: "/1/tv/{id}/{season}/{episode}",
			adapter: "parda",
			position: 1,
		});
		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.billboard.length).toBeGreaterThan(0);
		expect(page.billboard.every((each) => each.playable)).toBe(true);
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		expect((await hubPage(services(), EN, "home", NOW)).billboard.some((each) => each.playable)).toBe(false);
	});

	it("show only between their dates, both days included (Kathmandu's)", async () => {
		const first = movie(3);
		await curation.createBillboard(curator(), {
			...SLOT,
			title: `movie:${first}`,
			startsOn: "2026-11-05",
			endsOn: "2026-11-05",
		});
		await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(4)}`, startsOn: "2026-11-06" });
		await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(5)}`, endsOn: "2026-11-04" });
		const live = async (at: Date) => liveBillboards("home", await loadCuration(env.db), at).map((slot) => slot.tmdbId);
		expect(await live(NOW)).toEqual([first]);
		expect((await hubPage(services(), EN, "home", NOW)).billboard[0]?.id).toBe(first);
		// 18:30 UTC is already tomorrow in Kathmandu.
		expect(await live(new Date("2026-11-05T18:30:00Z"))).toEqual([movie(4)]);
		expect((await curation.listBillboards(curator())).map((slot) => slot.startsOn)).toContain("2026-11-06");
	});

	it("leave out a blocked title, and one a kids' cap refuses", async () => {
		const id = movie(3);
		await curation.createBillboard(curator(), { ...SLOT, title: `movie:${id}` });
		const kids = await hubPage(services(), KIDS, "home", NOW);
		expect(kids.billboard.map((each) => each.id)).not.toContain(id);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: id, reason: "test" });
		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.billboard.map((each) => each.id)).not.toContain(id);
		expect(page.billboard).toHaveLength(5);
	});

	it("reorder as a whole, per page, and refuse anything else", async () => {
		const first = await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(3)}` });
		const second = await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(4)}` });
		await curation.reorderBillboards(curator(), { page: "home", ids: [second.id, first.id] });
		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.billboard.map((each) => each.id).slice(0, 2)).toEqual([movie(4), movie(3)]);
		await expect(curation.reorderBillboards(curator(), { page: "home", ids: [first.id] })).rejects.toThrow(AppError);
		await expect(curation.reorderBillboards(curator(), { page: "movies", ids: [first.id] })).rejects.toThrow(AppError);
	});

	it("refuse a stale edit and an unknown title on its field; moving page goes last there", async () => {
		const slot = await curation.createBillboard(curator(), { ...SLOT, title: `movie:${movie(3)}` });
		const edited = await curation.updateBillboard(curator(), {
			...SLOT,
			page: "movies",
			title: `movie:${movie(3)}`,
			id: slot.id,
			updatedAt: slot.updatedAt,
		});
		expect(edited.page).toBe("movies");
		await expect(
			curation.updateBillboard(curator(), { ...SLOT, title: `movie:${movie(3)}`, id: slot.id, updatedAt: "1" }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			await fieldErrorsOf(curation.createBillboard(curator(), { ...SLOT, title: "movie:999999999" })),
		).toHaveProperty("title");
		expect(await curation.listBillboards(curator())).toHaveLength(1);
		await curation.deleteBillboards(curator(), [slot.id]);
		expect(await curation.listBillboards(curator())).toEqual([]);
		expect(await auditOf("parda.billboard.delete")).toHaveLength(1);
	});

	it("check their dates in the schema", () => {
		const parsed = billboardInput.safeParse({
			...SLOT,
			title: "movie:550",
			startsOn: "2026-11-05",
			endsOn: "2026-11-04",
		});
		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.path).toEqual(["endsOn"]);
		expect(billboardInput.safeParse({ ...SLOT, title: "person:1" }).success).toBe(false);
	});
});

describe("collections", () => {
	const items = () => [`movie:${movie(0)}`, `tv:${series(0)}`];

	it("show at /c/{slug} in the admin's order, and only when published", async () => {
		const created = await curation.createCollection(curator(), {
			...COLLECTION,
			items: [`tv:${series(0)}`, `movie:${movie(0)}`],
		});
		expect(created.count).toBe(2);
		expect(created.items[0]?.title?.en).toBeTruthy();
		const page = await curatedPage(services(), EN, "festival-picks");
		expect(page.parts.map((part) => part.id)).toEqual([series(0), movie(0)]);
		expect(page.collection.name).toBe("Festival picks");
		expect((await curatedPage(services(), NE, "festival-picks")).collection.name).toBe("चाडपर्वका छनोट");

		await curation.updateCollection(curator(), {
			...COLLECTION,
			published: false,
			items: items(),
			id: created.id,
			updatedAt: created.updatedAt,
		});
		await expect(curatedPage(services(), EN, "festival-picks")).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(curatedPage(services(), EN, "nothing-here")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("lose a blocked title, and a kids' cap's, and are a 404 with nothing left", async () => {
		await curation.createCollection(curator(), { ...COLLECTION, items: items() });
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie(0), reason: "test" });
		expect((await curatedPage(services(), EN, "festival-picks")).parts.map((part) => part.id)).toEqual([series(0)]);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "tv", tmdbId: series(0), reason: "test" });
		await expect(curatedPage(services(), EN, "festival-picks")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("refuse a taken slug on its field, creating and editing, without a failed statement", async () => {
		const first = await curation.createCollection(curator(), { ...COLLECTION, items: items() });
		const other = await curation.createCollection(curator(), { ...COLLECTION, slug: "other", items: [] });
		expect(await fieldErrorsOf(curation.createCollection(curator(), { ...COLLECTION, items: [] }))).toHaveProperty(
			"slug",
		);
		expect(
			await fieldErrorsOf(
				curation.updateCollection(curator(), {
					...COLLECTION,
					items: [],
					id: other.id,
					updatedAt: other.updatedAt,
				}),
			),
		).toHaveProperty("slug");
		// Its own slug is no conflict; a stale version is.
		await curation.updateCollection(curator(), {
			...COLLECTION,
			items: items(),
			id: first.id,
			updatedAt: first.updatedAt,
		});
		await expect(
			curation.updateCollection(curator(), { ...COLLECTION, items: [], id: first.id, updatedAt: first.updatedAt }),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("can't be published without a title (the schema), or hold more than the maximum", () => {
		const parsed = collectionInput.safeParse({ ...COLLECTION, items: [] });
		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.path).toEqual(["items"]);
		expect(collectionInput.safeParse({ ...COLLECTION, published: false, items: [] }).success).toBe(true);
		expect(
			collectionInput.safeParse({ ...COLLECTION, items: Array.from({ length: 51 }, (_, n) => `movie:${n + 1}`) })
				.success,
		).toBe(false);
	});

	it("join the sitemap when published with a title", async () => {
		const paths = async () => (await pardaSitemapEntries({ db: env.db })).map((entry) => entry.path);
		const draft = await curation.createCollection(curator(), {
			...COLLECTION,
			slug: "a-draft",
			published: false,
			items: items(),
		});
		expect(await paths()).not.toContain("/app/parda/c/a-draft");
		await curation.createCollection(curator(), { ...COLLECTION, items: items() });
		expect(await paths()).toContain("/app/parda/c/festival-picks");
		await curation.deleteCollections(curator(), [draft.id]);
		expect(await auditOf("parda.collection.delete")).toHaveLength(1);
	});
});

describe("the layout", () => {
	const ids = (page: { rails: ReadonlyArray<{ id: string }> }) => page.rails.map((rail) => rail.id);
	const config = PAGE_LAYOUTS.home.rails.map((rail) => rail.id);

	it("starts as the config, and a saved order and hidden rails apply", async () => {
		const start = await curation.getLayout(curator(), "home");
		expect(start.saved).toBe(false);
		expect(start.rails.map((rail) => rail.key)).toEqual(config);
		expect(ids(await hubPage(services(), EN, "home", NOW))).toEqual(config);

		const [first, second, ...rest] = config as [string, string, ...string[]];
		const saved = await curation.saveLayout(curator(), {
			page: "home",
			rails: [
				{ key: second, visible: true },
				{ key: first, visible: false },
				...rest.map((key) => ({ key, visible: true })),
			],
		});
		expect(saved.saved).toBe(true);
		const page = await hubPage(services(), EN, "home", NOW);
		expect(ids(page)).toEqual([second, ...rest]);
		// The first two visible rails come with the page.
		expect(page.rails[0]?.titles).toBeDefined();
		expect(page.rails[2]?.titles).toBeUndefined();
		expect(await auditOf("parda.layout.update")).toHaveLength(1);
		// Hubs have their own.
		expect(ids(await hubPage(services(), EN, "movies", NOW))).toEqual(PAGE_LAYOUTS.movies.rails.map((rail) => rail.id));
	});

	it("gives a rail added in code later a place at the end", async () => {
		await env.db.insert(schema.pdRail).values({ page: "home", key: "trending", position: 0 });
		const page = await hubPage(services(), EN, "home", NOW);
		expect(ids(page)[0]).toBe("trending");
		expect(new Set(ids(page))).toEqual(new Set(config));
		expect(ids(page)).toHaveLength(config.length);
	});

	it("must list every rail once", async () => {
		await expect(
			curation.saveLayout(curator(), { page: "home", rails: [{ key: "top10", visible: true }] }),
		).rejects.toThrow(AppError);
		await expect(
			curation.saveLayout(curator(), {
				page: "home",
				rails: [...config.slice(1), "no-such-rail"].map((key) => ({ key, visible: true })),
			}),
		).rejects.toThrow(AppError);
		expect(await env.db.select().from(schema.pdRail)).toEqual([]);
	});

	it("places a published collection as a rail, which leaves with it", async () => {
		const collection = await curation.createCollection(curator(), {
			...COLLECTION,
			items: [`movie:${movie(0)}`, `tv:${series(0)}`],
		});
		const key = collectionRailKey(collection.id);
		// Off until placed.
		const layout = await curation.getLayout(curator(), "home");
		expect(layout.rails.find((rail) => rail.key === key)).toMatchObject({ visible: false });
		expect(ids(await hubPage(services(), EN, "home", NOW))).not.toContain(key);

		await curation.saveLayout(curator(), {
			page: "home",
			rails: [{ key, visible: true }, ...config.map((id) => ({ key: id, visible: true }))],
		});
		const page = await hubPage(services(), EN, "home", NOW);
		expect(page.rails[0]).toMatchObject({ id: key, label: { text: "Festival picks" }, collection: "festival-picks" });
		expect(page.rails[0]?.titles?.map((title) => title.id)).toEqual([movie(0), series(0)]);
		expect((await hubPage(services(), NE, "home", NOW)).rails[0]?.label).toEqual({ text: "चाडपर्वका छनोट" });
		// A streamed collection rail is asked for by the same key.
		expect((await hubRail(services(), EN, "home", key, NOW)).titles?.map((title) => title.id)).toEqual([
			movie(0),
			series(0),
		]);

		await curation.updateCollection(curator(), {
			...COLLECTION,
			published: false,
			items: [],
			id: collection.id,
			updatedAt: collection.updatedAt,
		});
		expect(ids(await hubPage(services(), EN, "home", NOW))).not.toContain(key);
		await expect(hubRail(services(), EN, "home", key, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });

		await curation.deleteCollections(curator(), [collection.id]);
		expect(await env.db.select().from(schema.pdRail).where(eq(schema.pdRail.key, key))).toEqual([]);
	});
});

describe("the title picker", () => {
	it("finds titles, not people; nothing without a query or a catalogue", async () => {
		expect(await curation.searchTitles(curator(), "")).toEqual([]);
		expect(await curation.searchTitles({ ...curator(), catalog: null }, "star")).toEqual([]);
		const found = await curation.searchTitles(curator(), "star");
		expect(found.length).toBeGreaterThan(0);
		expect(found.length).toBeLessThanOrEqual(10);
		for (const each of found) expect(each.ref).toBe(`${each.media}:${each.id}`);
	});
});

describe("the overview", () => {
	const play = (
		id: number,
		at: string,
		extra: Partial<typeof schema.pdPlay.$inferInsert> = {},
	): typeof schema.pdPlay.$inferInsert => ({
		id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
		viewerKind: "account",
		viewerKey: `viewer-${id}`,
		media: "movie",
		tmdbId: 550,
		watchedS: 600,
		createdAt: new Date(at),
		...extra,
	});

	it("rolls days up, fills in a missed run, and replaces today's row", async () => {
		await env.db
			.insert(schema.pdPlay)
			.values([
				play(1, "2026-11-03T10:00:00Z"),
				play(2, "2026-11-03T11:00:00Z", { viewerKey: "viewer-1", viewerKind: "guest", failed: true }),
				play(3, "2026-11-03T12:00:00Z", { viewerKey: null, viewerKind: "anonymous", watchedS: 0 }),
				play(4, "2026-11-04T10:00:00Z"),
			]);
		expect(await rollupDaily(env.db, new Date("2026-11-04T23:00:00Z"))).toMatchObject({ days: 2 });
		const rows = await env.db.select().from(schema.pdDailyStat).orderBy(schema.pdDailyStat.day);
		expect(rows[0]).toMatchObject({
			day: "2026-11-03",
			accountPlays: 1,
			guestPlays: 1,
			anonymousPlays: 1,
			failed: 1,
			// One viewer twice, and one nobody can tell apart.
			viewers: 1,
			watchedS: 1200,
		});
		await env.db.insert(schema.pdPlay).values(play(5, "2026-11-04T23:30:00Z", { watchedS: 60 }));
		await rollupDaily(env.db, new Date("2026-11-05T01:00:00Z"));
		const [last] = await env.db.select().from(schema.pdDailyStat).where(eq(schema.pdDailyStat.day, "2026-11-04"));
		expect(last).toMatchObject({ accountPlays: 2, viewers: 2, watchedS: 660 });
	});

	it("prunes plays and search counts after 90 days, and the rollup outlives them", async () => {
		await env.db
			.insert(schema.pdPlay)
			.values([play(1, "2026-08-01T10:00:00Z"), play(2, "2026-10-01T10:00:00Z"), play(3, "2026-11-05T01:00:00Z")]);
		await env.db.insert(schema.pdSearchStat).values([
			{ day: "2026-08-01", query: "old" },
			{ day: "2026-11-01", query: "new" },
		]);
		await env.db.insert(schema.pdDailyStat).values({ day: "2026-08-01", accountPlays: 1 });
		const result = await rollupDaily(env.db, NOW);
		expect(result).toMatchObject({ prunedPlays: 1, prunedSearches: 1 });
		expect(await env.db.select({ query: schema.pdSearchStat.query }).from(schema.pdSearchStat)).toEqual([
			{ query: "new" },
		]);
		expect(await env.db.select().from(schema.pdPlay)).toHaveLength(2);
		const [kept] = await env.db.select().from(schema.pdDailyStat).where(eq(schema.pdDailyStat.day, "2026-08-01"));
		expect(kept?.accountPlays).toBe(1);
	});

	it("runs in the daily job, on its own", async () => {
		await env.db.insert(schema.pdPlay).values(play(1, "2026-11-05T01:00:00Z"));
		const result = await runPardaCron(env.db, null, { now: NOW });
		expect(result.overview).toMatchObject({ ok: true, days: 1 });
	});

	it("adds today as it stands to the finished days, in every window", async () => {
		const [source] = await env.db
			.insert(schema.pdSource)
			.values({ name: { en: "Server 1", ne: "" }, movieTemplate: "/a", tvTemplate: "/b", adapter: "parda" })
			.returning();
		await env.db.insert(schema.pdTitle).values({ media: "movie", tmdbId: 550, title: { en: "Fight Club", ne: "" } });
		await env.db.insert(schema.pdDailyStat).values([
			{ day: "2026-10-10", accountPlays: 5, viewers: 3, watchedS: 3_600 },
			{ day: "2026-11-02", accountPlays: 2, guestPlays: 1, failed: 1, viewers: 2, watchedS: 7_200 },
			// The morning's rollup of today: the plays below replace it.
			{ day: "2026-11-05", accountPlays: 99, viewers: 99 },
		]);
		await env.db.insert(schema.pdPlay).values([
			play(1, "2026-11-05T01:00:00Z", { sourceId: source?.id }),
			play(2, "2026-11-05T02:00:00Z", {
				viewerKind: "anonymous",
				failed: true,
				sourceId: source?.id,
				media: "tv",
				tmdbId: 1396,
			}),
		]);
		await env.db.insert(schema.pdReport).values({ kind: "ads", media: "movie", tmdbId: 550 });
		await env.db.insert(schema.pdSearchStat).values([
			{ day: "2026-11-05", query: "fight club", count: 4 },
			{ day: "2026-11-05", query: "no such film", count: 2, zeroResults: true },
			{ day: "2026-09-01", query: "too old", count: 90 },
		]);

		const today = await getOverview({ db: env.db }, "today", NOW);
		expect(today.plays).toEqual({ today: 2, week: 5, month: 10 });
		expect(today.openReports).toBe(1);
		expect(today.viewersPerDay).toBe(2);
		expect(today.watchedS).toBe(1_200);
		expect(today.failureRate).toBe(0.5);
		expect(today.byKind).toEqual({ account: 1, guest: 0, anonymous: 1 });
		expect(today.topTitles.map((title) => [title.tmdbId, title.title?.en ?? null])).toEqual(
			expect.arrayContaining([
				[550, "Fight Club"],
				[1396, null],
			]),
		);
		expect(today.topSearches.map((each) => each.query)).toEqual(["fight club", "no such film"]);
		expect(today.zeroSearches).toEqual([{ query: "no such film", count: 2 }]);
		expect(today.servers).toEqual([expect.objectContaining({ id: source?.id, plays: 2, failed: 1, failureRate: 0.5 })]);

		const week = await getOverview({ db: env.db }, "7d", NOW);
		expect(week.watchedS).toBe(8_400);
		expect(week.viewersPerDay).toBeCloseTo(4 / 7);
		expect(week.byKind).toEqual({ account: 3, guest: 1, anonymous: 1 });

		expect(week.days).toHaveLength(30);
		expect(week.days.at(-1)).toMatchObject({ day: "2026-11-05", account: 1, anonymous: 1 });
		expect(week.days.at(-2)).toMatchObject({ day: "2026-11-04", account: 0 });

		// Nothing played: no rate, not a zero.
		expect((await getOverview({ db: env.db }, "today", new Date("2027-03-01T00:00:00Z"))).failureRate).toBeNull();
	});
});
