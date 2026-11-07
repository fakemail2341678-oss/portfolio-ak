import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, isAppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import { collectionPage, personPage, surprise } from "@/server/parda/catalog/people";
import { type CatalogServices, popularTitles } from "@/server/parda/catalog/service";
import { pardaSitemapEntries } from "@/server/parda/catalog/sitemap";
import { creditsPage, seasonPage, titlePage } from "@/server/parda/catalog/title-page";
import { createPardaControls } from "@/server/parda/controls";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb, type Tmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * A title's pages on PGlite and the recorded catalogue (PLAN Task 63, decision 0235):
 * the title page's sections, a season a page at a time, the credits, a person, a
 * collection, "Surprise me" and the sitemap, with takedowns from each.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

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
const later = () => {
	time += 30_001;
};

const firstOf = async (media: "movie" | "tv") => {
	const first = (await popularTitles(services(), EN, media)).results[0];
	if (!first) throw new Error("no fixture");
	return first;
};

const block = async (media: "movie" | "tv", id: number) => {
	await env.db.insert(schema.pdBlockedTitle).values({ media, tmdbId: id, reason: "A notice" });
	later();
};

const recordedCollection = () => {
	const match = /"belongs_to_collection":\{"id":(\d+)/.exec(readFixture(fixtureName("movie/155", [], "en-US")) ?? "");
	return Number(match?.[1] ?? 263);
};

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	await env.db.insert(schema.pdSource).values({
		name: { en: "Server 1", ne: "सर्भर १" },
		movieTemplate: "/1/movie/{id}",
		tvTemplate: "/1/tv/{id}/{season}/{episode}",
		adapter: "parda",
		position: 1,
	});
	fixtureFetcher.mockClear();
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("the title page", () => {
	it("holds every section a movie has, with its director, and Play (the watch page, Task 64)", async () => {
		const movie = await firstOf("movie");
		const data = await titlePage(services(), EN, "movie", movie.id);
		expect(data.title).toMatchObject({ id: movie.id, slug: movie.slug, media: "movie" });
		expect(data.title.slug).toMatch(/^[a-z0-9-]+$/);
		expect(data.cast.length).toBeGreaterThan(0);
		expect(data.crew.some((person) => person.jobs.includes("Director"))).toBe(true);
		expect(data.videos.every((video) => /^[\w-]+$/.test(video.key))).toBe(true);
		expect(data.playable).toBe(true);
		expect(data.seasons).toEqual([]);
		expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		// Lean: the page's rails carry cut overviews, like the hubs'.
		expect(data.recommendations.every((title) => title.overview.length <= 281)).toBe(true);
	});

	it("gives a series its seasons, specials last, and Play", async () => {
		const series = await firstOf("tv");
		const data = await titlePage(services(), EN, "tv", series.id);
		expect(data.seasons.length).toBeGreaterThan(0);
		const numbers = data.seasons.map((season) => season.number);
		if (numbers.includes(0)) expect(numbers.at(-1)).toBe(0);
		const first = numbers.find((number) => number > 0) ?? numbers[0];
		expect(first).toBeDefined();
		expect(data.playable).toBe(true);
	});

	it("has no Play when playback is off", async () => {
		const movie = await firstOf("movie");
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		later();
		expect((await titlePage(services(), EN, "movie", movie.id)).playable).toBe(false);
	});

	it("names countries and languages in Nepali and fills TMDB's English in, but never the tagline", async () => {
		const movie = await firstOf("movie");
		const english = await titlePage(services(), EN, "movie", movie.id);
		const nepali = await titlePage(services(), NE, "movie", movie.id);
		expect(nepali.title.slug).toBe(english.title.slug);
		expect(nepali.title.overview).not.toBe("");
		if (english.title.countries.length) expect(nepali.title.countries).not.toEqual(english.title.countries);
		expect(nepali.videos.length).toBe(english.videos.length);
		const raw = JSON.parse(readFixture(fixtureName(`movie/${movie.id}`, [], "ne-NP")) ?? "{}") as { tagline?: string };
		expect(nepali.title.tagline).toBe(raw.tagline ?? "");
	});

	it("leaves a taken-down title out of More like this and Similar", async () => {
		const movie = await firstOf("movie");
		const before = await titlePage(services(), EN, "movie", movie.id);
		const target = before.recommendations[0] ?? before.similar[0];
		if (!target) throw new Error("no recommendation recorded");
		await block(target.media, target.id);
		const after = await titlePage(services(), EN, "movie", movie.id);
		const keys = [...after.recommendations, ...after.similar].map((title) => `${title.media}:${title.id}`);
		expect(keys).not.toContain(`${target.media}:${target.id}`);
	});
});

describe("a season", () => {
	it("opens on the first season, a page of episodes at a time", async () => {
		const series = await firstOf("tv");
		const data = await seasonPage(services(), EN, series.id, {});
		expect(data.number).toBeGreaterThan(0);
		expect(data.episodes?.length).toBeGreaterThan(0);
		expect(data.episodes?.length).toBeLessThanOrEqual(30);
		expect(data.page).toBe(1);
		const last = await seasonPage(services(), EN, series.id, { page: 999 });
		expect(last.page).toBe(last.pageCount);
	});

	it("answers a season the series doesn't have with no episodes, and TMDB failing with null", async () => {
		const series = await firstOf("tv");
		expect((await seasonPage(services(), EN, series.id, { season: 9_999 })).episodes).toEqual([]);
		const live = services();
		await titlePage(live, EN, "tv", series.id);
		const down: Tmdb = {
			...tmdb,
			get: (path, params) =>
				path.includes("/season/")
					? Promise.reject(new AppError("UPSTREAM_UNAVAILABLE", "down"))
					: tmdb.get(path, params),
		};
		expect((await seasonPage({ ...live, tmdb: down }, EN, series.id, {})).episodes).toBeNull();
	});

	it("is a 404 for a taken-down series", async () => {
		const series = await firstOf("tv");
		await block("tv", series.id);
		const error = await seasonPage(services(), EN, series.id, {}).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("NOT_FOUND");
	});
});

describe("the credits", () => {
	it("list the cast and the crew by department, Directing or Writing first", async () => {
		const movie = await firstOf("movie");
		const data = await creditsPage(services(), EN, "movie", movie.id);
		expect(data.cast.length).toBeGreaterThan(0);
		expect(data.crew.length).toBeGreaterThan(0);
		expect(["Directing", "Writing", "Production"]).toContain(data.crew[0]?.department);
		const series = await firstOf("tv");
		const aggregate = await creditsPage(services(), NE, "tv", series.id);
		expect(aggregate.cast.some((person) => person.episodes !== undefined)).toBe(true);
	});
});

describe("a person", () => {
	const actorOf = async () => {
		const movie = await firstOf("movie");
		const actor = (await titlePage(services(), EN, "movie", movie.id)).cast[0];
		if (!actor) throw new Error("no cast");
		return { movie, actor };
	};

	it("has a biography, what they're known for and a filmography by department", async () => {
		const { actor } = await actorOf();
		const data = await personPage(services(), NE, actor.id);
		expect(data.person.name).not.toBe("");
		expect(data.knownFor.length).toBeGreaterThan(0);
		const acting = data.filmography.find((group) => group.department === "Acting");
		expect(acting?.entries.length).toBeGreaterThan(0);
		const keys = data.knownFor.map((title) => `${title.media}:${title.id}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("leaves a taken-down title out of the filmography", async () => {
		const { movie, actor } = await actorOf();
		await block("movie", movie.id);
		const data = await personPage(services(), EN, actor.id);
		const keys = [...data.knownFor, ...data.filmography.flatMap((group) => group.entries)].map(
			(title) => `${title.media}:${title.id}`,
		);
		expect(keys).not.toContain(`movie:${movie.id}`);
	});
});

describe("a collection", () => {
	it("lists its films in release order, minus takedowns", async () => {
		const id = recordedCollection();
		const data = await collectionPage(services(), NE, id);
		expect(data.collection.name).not.toBe("");
		expect(data.parts.length).toBeGreaterThan(1);
		const years = data.parts.map((part) => part.year ?? 9_999);
		expect(years).toEqual([...years].sort((a, b) => a - b));
		const first = data.parts[0];
		if (!first) throw new Error("no part");
		await block("movie", first.id);
		expect((await collectionPage(services(), EN, id)).parts.map((part) => part.id)).not.toContain(first.id);
	});
});

describe("Surprise me", () => {
	it("picks a title with a picture from the page's lists, never a blocked one", async () => {
		const pick = await surprise(services(), EN, "movies", () => 0);
		expect(pick?.media).toBe("movie");
		if (!pick) throw new Error("no pick");
		await block("movie", pick.id);
		expect((await surprise(services(), EN, "movies", () => 0))?.id).not.toBe(pick.id);
		expect((await surprise(services(), EN, "series", () => 0.999))?.media).toBe("tv");
	});
});

describe("the sitemap", () => {
	it("lists ranked titles at their canonical address, minus takedowns", async () => {
		await env.db.insert(schema.pdTitle).values([
			{ media: "movie", tmdbId: 550, title: { en: "Fight Club", ne: "फाइट क्लब" }, popularityRank: 1 },
			{ media: "tv", tmdbId: 1396, title: { en: "Breaking Bad", ne: "" }, popularityRank: 2 },
			{ media: "movie", tmdbId: 9, title: { en: "Unranked", ne: "" }, popularityRank: null },
			{ media: "movie", tmdbId: 10, title: { en: "Far down", ne: "" }, popularityRank: 400 },
		]);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "tv", tmdbId: 1396, reason: "A notice" });
		const paths = (await pardaSitemapEntries({ db: env.db })).map((entry) => entry.path);
		expect(paths).toEqual(["/app/parda/movie/550-fight-club"]);
	});
});
