import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverSearchSchema, searchPageSchema } from "@/features/parda/search";
import * as schema from "@/server/db/schema";
import { discoverPage } from "@/server/parda/catalog/discover";
import { DISCOVER_SAMPLES, discoverFilters, SEARCH_SAMPLES } from "@/server/parda/catalog/discover-requests";
import { hubPage } from "@/server/parda/catalog/hubs";
import { normalizeQuery, noteSearch, searchPage, searchSuggest } from "@/server/parda/catalog/search";
import type { CatalogServices } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb, type Tmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Parda's search and Discover on PGlite (Task 66, decision 0239): the tabs, nothing
 * found, the overlay's hits, takedowns, TMDB failing, the statistics, Discover's filters,
 * keywords and the rails' "See all". TMDB answers from the fixtures `pnpm tmdb:record` made.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

let failing = false;
const fixtureFetcher = vi.fn<typeof fetch>(async (input) => {
	if (failing) return new Response("{}", { status: 503 });
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
const search = (raw: Record<string, unknown>) => searchPageSchema.parse(raw);
const found = SEARCH_SAMPLES.found;

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	fixtureFetcher.mockClear();
	failing = false;
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("the search page", () => {
	it("finds titles and people in all, with TMDB's count and pages, capped at 500", async () => {
		const page = await searchPage(services(), EN, search({ q: found }));
		expect(page.hits?.length).toBeGreaterThan(0);
		expect(page.total).toBeGreaterThan(0);
		expect(page.pageCount).toBeGreaterThan(0);
		expect(page.pageCount).toBeLessThanOrEqual(500);
		expect(page.suggestions).toBeNull();
		for (const hit of page.hits ?? []) expect(["movie", "tv", "person"]).toContain(hit.media);
	});

	it("searches one kind per tab", async () => {
		for (const [tab, media] of [
			["movies", "movie"],
			["series", "tv"],
			["people", "person"],
		] as const) {
			const page = await searchPage(services(), EN, search({ q: found, tab }));
			expect(page.hits?.length, tab).toBeGreaterThan(0);
			expect(new Set(page.hits?.map((hit) => hit.media))).toEqual(new Set([media]));
		}
	});

	it("suggests trending titles for nothing found, and for no query", async () => {
		const nothing = await searchPage(services(), EN, search({ q: SEARCH_SAMPLES.nothing }));
		expect(nothing.hits).toEqual([]);
		expect(nothing.suggestions?.length).toBeGreaterThan(0);
		fixtureFetcher.mockClear();
		const empty = await searchPage(services(), EN, search({}));
		expect(empty.hits).toEqual([]);
		expect(empty.suggestions?.length).toBeGreaterThan(0);
		// No query asks TMDB for no search.
		expect(fixtureFetcher.mock.calls.some(([url]) => String(url).includes("/search/"))).toBe(false);
	});

	it("degrades to null when TMDB fails, without suggestions", async () => {
		failing = true;
		const page = await searchPage(services(), EN, search({ q: found }));
		expect(page.hits).toBeNull();
		expect(page.suggestions).toBeNull();
	});

	it("fills Nepali names in from English", async () => {
		const page = await searchPage(services(), NE, search({ q: found }));
		for (const hit of page.hits ?? []) expect(hit.media === "person" ? hit.name : hit.title).not.toBe("");
	});

	it("leaves a blocked title out of the hits, the page's and the overlay's", async () => {
		const before = await searchPage(services(), EN, search({ q: found }));
		const title = before.hits?.find((hit) => hit.media !== "person");
		if (!title) throw new Error("no title in the fixture");
		await env.db.insert(schema.pdBlockedTitle).values({ media: title.media, tmdbId: title.id, reason: "A notice" });
		const after = await searchPage(services(), EN, search({ q: found }));
		expect(after.hits?.some((hit) => hit.media === title.media && hit.id === title.id)).toBe(false);
		const suggest = await searchSuggest(services(), EN, found);
		expect(suggest.hits.some((hit) => hit.media === title.media && hit.id === title.id)).toBe(false);
	});

	it("caps the page in the URL at TMDB's 500 and corrects nonsense", () => {
		expect(searchPageSchema.parse({ page: "9999" }).page).toBe(1);
		expect(searchPageSchema.parse({ page: "500", tab: "nope" })).toEqual({ q: "", tab: "all", page: 500 });
		expect(searchPageSchema.parse({ q: `  ${"x".repeat(200)}` }).q).toBe("");
	});
});

describe("the overlay", () => {
	it("lists the first eight hits of the multi search, the same answer the page reads", async () => {
		const live = services();
		const suggest = await searchSuggest(live, EN, found);
		expect(suggest.hits.length).toBeGreaterThan(0);
		expect(suggest.hits.length).toBeLessThanOrEqual(8);
		fixtureFetcher.mockClear();
		await searchPage(live, EN, search({ q: found }));
		expect(fixtureFetcher).not.toHaveBeenCalled();
	});
});

describe("search statistics", () => {
	const stats = () => env.db.select().from(schema.pdSearchStat);

	it("count a normalized query per day, with whether it found nothing, and no one's identity", async () => {
		const now = new Date("2026-11-05T10:00:00Z");
		await noteSearch(env.db, services(), EN, `  ${found}  `, now);
		await noteSearch(env.db, services(), EN, found, now);
		await noteSearch(env.db, services(), EN, SEARCH_SAMPLES.nothing, now);
		const rows = await stats();
		expect(rows.find((row) => row.query === found)).toMatchObject({ day: "2026-11-05", count: 2, zeroResults: false });
		expect(rows.find((row) => row.query === normalizeQuery(SEARCH_SAMPLES.nothing))).toMatchObject({
			count: 1,
			zeroResults: true,
		});
		expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["count", "day", "query", "updatedAt", "zeroResults"]);
		await noteSearch(env.db, services(), EN, found, new Date("2026-11-06T00:30:00Z"));
		expect(await env.db.select().from(schema.pdSearchStat).where(eq(schema.pdSearchStat.query, found))).toHaveLength(2);
	});

	it("skip an empty query and a failing TMDB", async () => {
		await noteSearch(env.db, services(), EN, "   ");
		failing = true;
		await noteSearch(env.db, services(), EN, "another");
		expect(await stats()).toEqual([]);
	});

	it("normalize case, width and spaces", () => {
		expect(normalizeQuery("  Ｓtar   WARS ")).toBe("star wars");
		expect(normalizeQuery("a".repeat(150))).toHaveLength(100);
	});
});

describe("Discover", () => {
	const filters = (raw: Record<string, unknown>) => discoverSearchSchema.parse(raw);

	it("answers every recorded sample, capped at 500 pages, with languages named in the page's language", async () => {
		for (const sample of DISCOVER_SAMPLES) {
			const page = await discoverPage(services(), EN, discoverFilters(sample));
			expect(page.titles?.length, JSON.stringify(sample)).toBeGreaterThan(0);
			expect(page.pageCount).toBeLessThanOrEqual(500);
		}
		const english = await discoverPage(services(), EN, discoverFilters());
		const nepali = await discoverPage(services(), NE, discoverFilters());
		expect(english.languages.find((language) => language.code === "ja")?.name).toBe("Japanese");
		expect(nepali.languages.find((language) => language.code === "ja")?.name).not.toBe("Japanese");
	});

	it("keeps only what applies to the type", async () => {
		const page = await discoverPage(
			services(),
			EN,
			filters({ type: "movie", genres: ["28", "10765"], status: "ended", company: "213" }),
		);
		expect(page.filters).toMatchObject({ genres: [28], status: undefined, company: undefined });
	});

	it("names a keyword, and leaves an unknown one generic with nothing found", async () => {
		const recorded = readFixture(fixtureName("keyword/4426", [], "en-US"));
		if (recorded) {
			const page = await discoverPage(services(), EN, filters({ keyword: "4426" }));
			expect(page.keyword).toBe((JSON.parse(recorded) as { name: string }).name);
		}
		const unknown = await discoverPage(services(), EN, filters({ keyword: "99999998" }));
		expect(unknown.keyword).toBeNull();
		expect(unknown.titles).toEqual([]);
	});

	it("leaves blocked titles out, and degrades when TMDB fails", async () => {
		const before = await discoverPage(services(), EN, discoverFilters());
		const first = before.titles?.[0];
		if (!first) throw new Error("no fixture");
		await env.db.insert(schema.pdBlockedTitle).values({ media: first.media, tmdbId: first.id, reason: "A notice" });
		const after = await discoverPage(services(), EN, discoverFilters());
		expect(after.titles?.some((title) => title.id === first.id)).toBe(false);
		failing = true;
		expect((await discoverPage(services(), EN, discoverFilters({ type: "series", sort: "oldest" }))).titles).toBeNull();
	});

	it("is where a hub's genre and anime rails say 'See all'", async () => {
		const movies = await hubPage(services(), EN, "movies");
		const genre = movies.rails.find((rail) => "genre" in rail.label);
		expect(genre?.more).toMatchObject({ type: "movie", genres: [expect.any(Number)] });
		const anime = await hubPage(services(), EN, "anime");
		expect(anime.rails.find((rail) => rail.id === "popular")?.more).toMatchObject({
			type: "series",
			genres: [16],
			language: "ja",
		});
		// Lists Discover can't reproduce (trending, airing this week) link nowhere.
		expect(movies.rails.find((rail) => rail.id === "trending")?.more).toBeUndefined();
	});
});
