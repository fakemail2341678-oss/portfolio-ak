import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withinCap } from "@/features/parda/kids";
import type { Session } from "@/lib/session";
import * as schema from "@/server/db/schema";
import { claimGuest } from "@/server/guests/service";
import { type PardaCatalog, regionFor } from "@/server/parda/catalog/context";
import { SEARCH_SAMPLES } from "@/server/parda/catalog/discover-requests";
import { refreshCertificates } from "@/server/parda/catalog/refresh";
import {
	type CatalogServices,
	listTitles,
	personDetails,
	popularTitles,
	searchCatalog,
	titleDetails,
	usCertificate,
} from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import * as saved from "@/server/parda/library/saved";
import * as library from "@/server/parda/library/service";
import { resolveViewer } from "@/server/parda/profiles/service";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Task 67 on PGlite and the recorded catalogue (decision 0240): My List and ♥ with their
 * `pd_title` snapshot, sorting, filters and paging, favourite people, likes, History by
 * day, the home's personal rails, the guest claim, and the kids' cap in the catalogue.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const fromFixtures = async (input: string | URL | Request) => {
	const url = new URL(String(input));
	const body = readFixture(
		fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? ""),
	);
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
};
const fetcher = vi.fn<typeof fetch>(fromFixtures);
const tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fetcher,
);

let time = 0;
const later = () => {
	time += 600_001;
};
const services = (): CatalogServices => ({
	tmdb,
	cache: createTmdbCache(),
	controls: createPardaControls(env.db, () => time),
});
const catalog = (cap: string | null = null): PardaCatalog => ({ services: services(), region: "US", cap });
const EN = { locale: "en", region: "US", cap: null } as const;

const sessionOf = (id: string, guest = false): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
	...(guest ? { isAnonymous: true as const } : {}),
});
const addUser = async (id: string, guest = false) => {
	await env.db
		.insert(schema.user)
		.values({ id, name: id, email: `${id}@example.com`, ...(guest ? { isAnonymous: true } : {}) });
};
const ctxFor = async (userId: string, cap: string | null = null): Promise<library.PardaServices> => ({
	db: env.db,
	viewer: await resolveViewer(env.db, sessionOf(userId), undefined, "en"),
	catalog: catalog(cap),
});

const popular = async (media: "movie" | "tv") => (await popularTitles(services(), EN, media)).results;

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	await addUser("asha");
	await addUser("bina");
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

/** Snapshots for list rows written straight to the table (sorting and paging need many). */
const snapshot = (media: "movie" | "tv", id: number, title: string, year: number) => ({
	media,
	tmdbId: id,
	title: { en: title, ne: `${title} (ne)` },
	year,
	poster: null,
	backdrop: null,
});

describe("My List and ♥", () => {
	it("adds a title with its snapshot, lists it, and takes it off", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		if (!movie) throw new Error("no fixture");
		await saved.setListed(ctx, { media: "movie", id: movie.id, kind: "watchlist", on: true });
		// Twice is once.
		await saved.setListed(ctx, { media: "movie", id: movie.id, kind: "watchlist", on: true });
		const [title] = await env.db
			.select()
			.from(schema.pdTitle)
			.where(and(eq(schema.pdTitle.media, "movie"), eq(schema.pdTitle.tmdbId, movie.id)));
		const details = await titleDetails(services(), EN, "movie", movie.id);
		expect(title).toMatchObject({ title: { en: details.title }, certification: usCertificate(details) });
		expect(title?.certificationCheckedAt).toBeInstanceOf(Date);
		expect((await saved.savedState(ctx)).watchlist).toEqual([`movie:${movie.id}`]);
		const page = await saved.listPage(ctx, { type: "all", sort: "added", page: 1 }, "en");
		expect(page).toMatchObject({ total: 1, page: 1, pageCount: 1 });
		expect(page.titles[0]).toMatchObject({ media: "movie", id: movie.id, title: details.title, slug: details.slug });

		await saved.setListed(ctx, { media: "movie", id: movie.id, kind: "watchlist", on: false });
		expect((await saved.savedState(ctx)).watchlist).toEqual([]);
	});

	it("sorts by added, title and year, filters by type and pages 24 at a time", async () => {
		const ctx = await ctxFor("asha");
		const rows = Array.from({ length: 30 }, (_, at) =>
			snapshot(at % 3 === 0 ? "tv" : "movie", 9_000 + at, `Title ${String.fromCharCode(90 - at)}`, 1990 + at),
		);
		await env.db.insert(schema.pdTitle).values(rows);
		for (const [at, row] of rows.entries()) {
			await env.db.insert(schema.pdListItem).values({
				profileId: ctx.viewer.profile.id,
				kind: "watchlist",
				media: row.media,
				tmdbId: row.tmdbId,
				addedAt: new Date(Date.UTC(2026, 0, 1 + at)),
			});
		}
		const first = await saved.listPage(ctx, { type: "all", sort: "added", page: 1 }, "en");
		expect(first).toMatchObject({ total: 30, pageCount: 2 });
		expect(first.titles).toHaveLength(24);
		expect(first.titles[0]?.id).toBe(9_029);
		expect((await saved.listPage(ctx, { type: "all", sort: "added", page: 2 }, "en")).titles).toHaveLength(6);
		const byTitle = await saved.listPage(ctx, { type: "all", sort: "title", page: 1 }, "en");
		expect(byTitle.titles.map((title) => title.title)).toEqual([...byTitle.titles.map((title) => title.title)].sort());
		const byYear = await saved.listPage(ctx, { type: "all", sort: "year", page: 1 }, "en");
		expect(byYear.titles[0]?.year).toBe(2019);
		const series = await saved.listPage(ctx, { type: "tv", sort: "added", page: 1 }, "ne");
		expect(series.total).toBe(10);
		expect(series.titles.every((title) => title.media === "tv" && title.title.endsWith("(ne)"))).toBe(true);
	});

	it("leaves a taken-down title out, and keeps ♥ apart from My List", async () => {
		const ctx = await ctxFor("asha");
		const [first, second] = await popular("movie");
		if (!first || !second) throw new Error("no fixture");
		await saved.setListed(ctx, { media: "movie", id: first.id, kind: "favourite", on: true });
		await saved.setListed(ctx, { media: "movie", id: second.id, kind: "favourite", on: true });
		expect((await saved.listPage(ctx, { type: "all", sort: "added", page: 1 }, "en")).total).toBe(0);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: first.id, reason: "A notice" });
		later();
		const after = await saved.favouritesPage(await ctxFor("asha"), { type: "all", sort: "added", page: 1 }, "en");
		expect(after.titles.map((title) => title.id)).toEqual([second.id]);
		// A blocked title can't be added at all.
		await expect(
			saved.setListed(await ctxFor("asha"), { media: "movie", id: first.id, kind: "watchlist", on: true }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("keeps favourite people with their name and portrait", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		const details = await titleDetails(services(), EN, "movie", movie?.id ?? 0);
		const actor = details.cast[0];
		if (!actor) throw new Error("no cast");
		await saved.setPersonFavourite(ctx, { id: actor.id, on: true });
		const page = await saved.favouritesPage(ctx, { type: "all", sort: "added", page: 1 }, "en");
		expect(page.people).toEqual([{ id: actor.id, name: actor.name, portrait: expect.anything() }]);
		expect((await saved.savedState(ctx)).people).toEqual([actor.id]);
		await saved.setPersonFavourite(ctx, { id: actor.id, on: false });
		expect((await saved.savedState(ctx)).people).toEqual([]);
	});

	it("likes, dislikes and takes either back", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		const key = `movie:${movie?.id}`;
		await saved.rate(ctx, { media: "movie", id: movie?.id ?? 0, value: "like" });
		expect(await saved.savedState(ctx)).toMatchObject({ likes: [key], dislikes: [] });
		await saved.rate(ctx, { media: "movie", id: movie?.id ?? 0, value: "dislike" });
		expect(await saved.savedState(ctx)).toMatchObject({ likes: [], dislikes: [key] });
		await saved.rate(ctx, { media: "movie", id: movie?.id ?? 0, value: null });
		expect(await saved.savedState(ctx)).toMatchObject({ likes: [], dislikes: [] });
	});
});

describe("History", () => {
	it("groups movies and episodes by day, takes one day out, and clears", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		const [series] = await popular("tv");
		if (!movie || !series) throw new Error("no fixture");
		const profileId = ctx.viewer.profile.id;
		// 2026-11-04 and 2026-11-05 in Kathmandu (UTC+5:45).
		const yesterday = new Date("2026-11-04T10:00:00Z");
		const today = new Date("2026-11-05T09:00:00Z");
		await env.db.insert(schema.pdProgress).values([
			{ profileId, media: "movie", tmdbId: movie.id, watched: 600, duration: 7200, updatedAt: yesterday },
			{
				profileId,
				media: "tv",
				tmdbId: series.id,
				season: 1,
				episode: 1,
				watched: 1500,
				duration: 1500,
				finished: true,
				updatedAt: today,
			},
			{
				profileId,
				media: "tv",
				tmdbId: series.id,
				season: 1,
				episode: 2,
				watched: 300,
				duration: 1500,
				updatedAt: new Date(today.getTime() + 60_000),
			},
		]);
		const history = await saved.history(ctx, 1, "en");
		expect(history.days.map((day) => day.day)).toEqual(["2026-11-05", "2026-11-04"]);
		expect(history.days[0]?.entries[0]).toMatchObject({
			media: "tv",
			id: series.id,
			episodes: [
				{ season: 1, episode: 2 },
				{ season: 1, episode: 1 },
			],
		});
		expect(history.days[1]?.entries[0]).toMatchObject({ media: "movie", id: movie.id, episodes: [] });
		expect(history.hasMore).toBe(false);

		await saved.removeHistory(ctx, { media: "tv", id: series.id, day: "2026-11-05" });
		expect((await saved.history(ctx, 1, "en")).days.map((day) => day.day)).toEqual(["2026-11-04"]);

		await library.removeFromContinue(ctx, { media: "movie", id: movie.id });
		await saved.clearHistory(ctx);
		expect(await env.db.select().from(schema.pdProgress)).toEqual([]);
		expect(await env.db.select().from(schema.pdContinueState)).toEqual([]);
	});
});

describe("the home's personal rails", () => {
	it("recommends from the latest liked title, minus what's disliked or listed", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		if (!movie) throw new Error("no fixture");
		expect((await saved.forYou(ctx, "en")).because).toBeNull();
		await saved.rate(ctx, { media: "movie", id: movie.id, value: "like" });
		const details = await titleDetails(services(), EN, "movie", movie.id);
		const [skipped] = details.recommendations;
		// Written straight in: the recording has no details for a recommendation (rate() reads them).
		if (skipped) {
			await env.db
				.insert(schema.pdRating)
				.values({ profileId: ctx.viewer.profile.id, media: skipped.media, tmdbId: skipped.id, value: "dislike" });
		}
		const rails = await saved.forYou(ctx, "en");
		const expected = details.recommendations.filter((title) => title.id !== skipped?.id).slice(0, 20);
		if (expected.length === 0) expect(rails.because).toBeNull();
		else {
			expect(rails.because?.title).toBe(details.title);
			expect(rails.because?.titles.map((title) => title.id)).toEqual(expected.map((title) => title.id));
		}
	});

	it("lists favourite people's latest titles, newest first", async () => {
		const ctx = await ctxFor("asha");
		const [movie] = await popular("movie");
		const actor = (await titleDetails(services(), EN, "movie", movie?.id ?? 0)).cast[0];
		if (!actor) throw new Error("no cast");
		await saved.setPersonFavourite(ctx, { id: actor.id, on: true });
		const person = await personDetails(services(), EN, actor.id);
		const dated = person.credits.filter((credit) => credit.date && !credit.appearance);
		const newest = dated
			.map((credit) => credit.date ?? "")
			.sort()
			.at(-1);
		if (!newest) return;
		// "Now" a year after their newest title: it counts as new.
		const rails = await saved.forYou(ctx, "en", new Date(`${Number(newest.slice(0, 4)) + 1}-06-01T00:00:00Z`));
		const dates = (rails.people ?? []).map((title) => dated.find((credit) => credit.id === title.id)?.date ?? "");
		expect(dates.length).toBeGreaterThan(0);
		expect(dates).toEqual([...dates].sort().reverse());
	});
});

describe("the guest claim", () => {
	it("brings a guest's list, ♥ and likes into the account", async () => {
		await addUser("guest-1", true);
		const guest = await ctxFor("guest-1");
		const account = await ctxFor("asha");
		const [first, second] = await popular("movie");
		if (!first || !second) throw new Error("no fixture");
		await saved.setListed(account, { media: "movie", id: first.id, kind: "watchlist", on: true });
		await saved.setListed(guest, { media: "movie", id: first.id, kind: "watchlist", on: true });
		await saved.setListed(guest, { media: "movie", id: second.id, kind: "favourite", on: true });
		await saved.rate(guest, { media: "movie", id: second.id, value: "like" });
		expect(await claimGuest(env.db, "guest-1", "asha")).toBe(true);
		expect(await saved.savedState(await ctxFor("asha"))).toMatchObject({
			watchlist: [`movie:${first.id}`],
			favourite: [`movie:${second.id}`],
			likes: [`movie:${second.id}`],
		});
	});
});

describe("the kids' cap in the catalogue", () => {
	it("asks a capped discover query for lists TMDB can filter", async () => {
		const asked: URL[] = [];
		const answers = createTmdb(
			{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
			async (input) => {
				const url = new URL(String(input));
				asked.push(url);
				// Any capped list answers with the recorded popular movies.
				if (url.pathname.endsWith("/discover/movie")) {
					return new Response(readFixture(fixtureName("movie/popular", [["page", "1"]], "en-US")) ?? "{}");
				}
				return fromFixtures(input);
			},
		);
		const kids = { tmdb: answers, cache: createTmdbCache(), controls: createPardaControls(env.db, () => time) };
		const list = await popularTitles(kids, { ...EN, cap: "PG" }, "movie");
		expect(asked[0]?.pathname).toBe("/3/discover/movie");
		expect(asked[0]?.searchParams.get("certification")).toBe("G|PG");
		expect(asked[0]?.searchParams.get("certification_country")).toBe("US");
		// TMDB filtered it: nothing is dropped for an unknown certificate.
		expect(list.results.length).toBeGreaterThan(0);
	});

	it("filters other lists and search through pd_title's certificates, unknown ones out", async () => {
		const trending = await listTitles(services(), EN, { media: "mixed", path: "trending/all/day", params: {} });
		const [kept, dropped] = trending.results;
		if (!kept || !dropped) throw new Error("no fixture");
		await env.db.insert(schema.pdTitle).values([
			{ ...snapshot(kept.media, kept.id, kept.title, 2020), certification: kept.media === "movie" ? "PG" : "TV-PG" },
			{
				...snapshot(dropped.media, dropped.id, dropped.title, 2020),
				certification: dropped.media === "movie" ? "R" : "TV-MA",
			},
		]);
		const capped = await listTitles(
			services(),
			{ ...EN, cap: "PG" },
			{ media: "mixed", path: "trending/all/day", params: {} },
		);
		expect(capped.results.map((title) => title.id)).toEqual([kept.id]);

		const all = await searchCatalog(services(), EN, "multi", SEARCH_SAMPLES.found);
		const kids = await searchCatalog(services(), { ...EN, cap: "PG" }, "multi", SEARCH_SAMPLES.found);
		const titles = kids.hits.filter((hit) => hit.media !== "person");
		expect(titles.length).toBeLessThanOrEqual(all.hits.length);
		expect(titles.every((hit) => hit.id === kept.id)).toBe(true);
	});

	it("makes a title over the cap a 404, with its season and credits", async () => {
		const [movie] = await popular("movie");
		const details = await titleDetails(services(), EN, "movie", movie?.id ?? 0);
		const run = titleDetails(services(), { ...EN, cap: "G" }, "movie", details.id);
		if (withinCap("G", "movie", usCertificate(details))) await expect(run).resolves.toMatchObject({ id: details.id });
		else await expect(run).rejects.toMatchObject({ code: "NOT_FOUND" });
		const [series] = await popular("tv");
		const show = await titleDetails(services(), EN, "tv", series?.id ?? 0);
		if (!withinCap("G", "tv", usCertificate(show))) {
			const { titleSeason } = await import("@/server/parda/catalog/service");
			await expect(titleSeason(services(), { ...EN, cap: "G" }, show.id, 1)).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		}
	});

	it("fills pd_title's certificates daily, the unasked first, and tries a failure again", async () => {
		const answers = createTmdb(
			{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
			async (input) => {
				const url = new URL(String(input));
				if (url.pathname.endsWith("/movie/1/release_dates")) {
					return Response.json({
						id: 1,
						results: [
							{ iso_3166_1: "GB", release_dates: [{ certification: "12A" }] },
							{ iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "PG-13" }] },
						],
					});
				}
				if (url.pathname.endsWith("/tv/2/content_ratings")) {
					return Response.json({ results: [{ iso_3166_1: "US", rating: "TV-Y7" }] });
				}
				if (url.pathname.endsWith("/movie/4/release_dates")) return Response.json({ id: 4, results: [] });
				return new Response("{}", { status: 404 });
			},
		);
		await env.db.insert(schema.pdTitle).values([
			{ ...snapshot("movie", 1, "One", 2020), popularityRank: 1 },
			{ ...snapshot("tv", 2, "Two", 2020), popularityRank: 1 },
			{ ...snapshot("movie", 3, "Three", 2020), popularityRank: 2 },
			{ ...snapshot("movie", 4, "Four", 2020), popularityRank: 3 },
			// Not ranked: not asked.
			{ ...snapshot("movie", 5, "Five", 2020), popularityRank: null },
		]);
		const now = new Date("2026-11-05T00:00:00Z");
		expect(await refreshCertificates(env.db, answers, { now })).toEqual({ checked: 3, failed: 1 });
		const rows = new Map(
			(await env.db.select().from(schema.pdTitle)).map((row) => [`${row.media}:${row.tmdbId}`, row]),
		);
		expect(rows.get("movie:1")?.certification).toBe("PG-13");
		expect(rows.get("tv:2")?.certification).toBe("TV-Y7");
		expect(rows.get("movie:4")).toMatchObject({ certification: null, certificationCheckedAt: now });
		expect(rows.get("movie:3")?.certificationCheckedAt).toBeNull();
		expect(rows.get("movie:5")?.certificationCheckedAt).toBeNull();
		// The next run asks only the one that failed.
		expect(await refreshCertificates(env.db, answers, { now })).toEqual({ checked: 0, failed: 1 });
	});

	it("picks the region: the profile's, the visitor's country when TMDB has it, else the admin's", () => {
		expect(regionFor("GB", "IN", "US")).toBe("GB");
		expect(regionFor(null, "in", "US")).toBe("IN");
		expect(regionFor(null, "NP", "US")).toBe("US");
		expect(regionFor(undefined, undefined, "US")).toBe("US");
	});
});
