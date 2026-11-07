import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import * as schema from "@/server/db/schema";
import { GUEST_DATA, guestOwnersFor } from "@/server/guests/data";
import { claimGuest } from "@/server/guests/service";
import type { PardaCatalog } from "@/server/parda/catalog/context";
import { type CatalogServices, popularTitles, titleDetails } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import { PARDA_GUEST_DATA } from "@/server/parda/guest-data";
import * as library from "@/server/parda/library/service";
import { recordPlay, reportProblem } from "@/server/parda/player/plays";
import { watchPage } from "@/server/parda/player/watch";
import { ensureDefaultProfile } from "@/server/parda/profiles/repository";
import { browsingProfile, resolveViewer } from "@/server/parda/profiles/service";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Task 64 on PGlite and the recorded catalogue (PLAN 12.5, decision 0236): profiles,
 * the progress upsert and its throttle, Continue watching (next across seasons, marks,
 * *Rewatch*, *Remove*), the watch page's data, playbacks and reports, and the guest
 * claim merging profiles, with scoped seeding.
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

let time = 0;
const later = () => {
	time += 30_001;
};
const services = (): CatalogServices => ({
	tmdb,
	cache: createTmdbCache(),
	controls: createPardaControls(env.db, () => time),
});
const catalog = (): PardaCatalog => ({ services: services(), region: "US", cap: null });
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

const ctxFor = async (userId: string): Promise<library.PardaServices> => ({
	db: env.db,
	viewer: await resolveViewer(env.db, sessionOf(userId), undefined, "en"),
	catalog: catalog(),
});

const popular = async (media: "movie" | "tv") => {
	const first = (await popularTitles(services(), EN, media)).results[0];
	if (!first) throw new Error("no fixture");
	return first;
};

/** The recorded series with at least two regular seasons, and its shape. */
const longSeries = async () => {
	const series = await popular("tv");
	const details = await titleDetails(services(), EN, "tv", series.id);
	const regular = details.seasonList.filter((season) => season.number > 0 && season.episodes > 0);
	return { series, details, regular };
};

let sources: Array<typeof schema.pdSource.$inferSelect> = [];

beforeAll(async () => {
	env = await createTestDb();
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	sources = await env.db
		.insert(schema.pdSource)
		.values(
			[1, 2, 3].map((n) => ({
				name: { en: `Server ${n}`, ne: `सर्भर ${n}` },
				movieTemplate: `/${n}/movie/{id}?start={start}`,
				tvTemplate: `/${n}/tv/{id}/{season}/{episode}?start={start}`,
				adapter: "parda" as const,
				position: n,
				cdnGroup: n < 3 ? "a" : "b",
				adaptive: n === 3,
			})),
		)
		.returning();
	await addUser("asha");
	await addUser("bina");
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("profiles", () => {
	it("makes one default profile per owner, even when asked twice at once", async () => {
		const [a, b] = await Promise.all([
			ensureDefaultProfile(env.db, "asha", "Asha"),
			ensureDefaultProfile(env.db, "asha", "Asha"),
		]);
		expect(a.id).toBe(b.id);
		expect(await env.db.select().from(schema.pdProfile)).toHaveLength(1);
	});

	it("uses the cookie's profile only when it's the viewer's own", async () => {
		const own = await env.db
			.insert(schema.pdProfile)
			.values({ ownerId: "asha", name: "Kids", kids: true, cap: "PG" })
			.returning();
		const others = await env.db.insert(schema.pdProfile).values({ ownerId: "bina", name: "Bina's" }).returning();
		const ownId = own[0]?.id ?? "";
		const otherId = others[0]?.id ?? "";
		expect((await resolveViewer(env.db, sessionOf("asha"), ownId, "en")).profile.id).toBe(ownId);
		const fallback = await resolveViewer(env.db, sessionOf("asha"), otherId, "en");
		expect(fallback.profile.id).not.toBe(otherId);
		expect(await browsingProfile(env.db, sessionOf("asha"), ownId)).toMatchObject({ kids: true, cap: "PG" });
		// Someone else's cookie is ignored: the default profile browses (its region counts, decision 0240).
		expect(await browsingProfile(env.db, sessionOf("asha"), otherId)).toMatchObject({
			id: fallback.profile.id,
			kids: false,
		});
		expect(await browsingProfile(env.db, null, ownId)).toBeNull();
		expect(await browsingProfile(env.db, null, undefined)).toBeNull();
	});
});

describe("saving progress", () => {
	it("throttles a row inside the upsert, unless it finishes or the source changes", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		const save = (watched: number, sourceId: string | null = sources[0]?.id ?? null) =>
			library.saveProgress(ctx, { media: "movie", id: movie.id, watched, duration: 7200, sourceId });
		expect(await save(120)).toEqual({ saved: true });
		expect(await save(135)).toEqual({ saved: false });
		expect(await save(140, sources[1]?.id ?? null)).toEqual({ saved: true });
		expect(await save(7000, sources[1]?.id ?? null)).toEqual({ saved: true });
		const [row] = await env.db.select().from(schema.pdProgress);
		expect(row).toMatchObject({ watched: 7000, finished: true, sourceId: sources[1]?.id });
	});

	it("is started after a minute and finished near the end", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 30, duration: 7200, sourceId: null });
		expect((await library.titleProgress(ctx, { media: "movie", id: movie.id }, "en")).cta).toBeNull();
		await env.db.update(schema.pdProgress).set({ updatedAt: new Date(Date.now() - 60_000) });
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 1800, duration: 7200, sourceId: null });
		expect((await library.titleProgress(ctx, { media: "movie", id: movie.id }, "en")).cta).toMatchObject({
			kind: "resume",
			left: 90,
		});
		await env.db.update(schema.pdProgress).set({ updatedAt: new Date(Date.now() - 60_000) });
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 6950, duration: 7200, sourceId: null });
		expect((await library.titleProgress(ctx, { media: "movie", id: movie.id }, "en")).cta).toEqual({ kind: "rewatch" });
	});

	it("refuses a blocked title, and anything while playback is off", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie.id, reason: "A notice" });
		later();
		const blocked = await ctxFor("asha");
		await expect(
			library.saveProgress(blocked, { media: "movie", id: movie.id, watched: 100, duration: 7200, sourceId: null }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await env.db.delete(schema.pdBlockedTitle);
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		later();
		await expect(
			library.saveProgress(await ctxFor("asha"), {
				media: "movie",
				id: movie.id,
				watched: 100,
				duration: 7200,
				sourceId: null,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(ctx.viewer.userId).toBe("asha");
	});
});

describe("Continue watching", () => {
	it("goes on to the next episode across seasons, and marking a season watched moves it", async () => {
		const ctx = await ctxFor("asha");
		const { series, regular } = await longSeries();
		const first = regular[0];
		if (!first) throw new Error("no season");
		await library.saveProgress(ctx, {
			media: "tv",
			id: series.id,
			season: first.number,
			episode: first.episodes,
			watched: 1490,
			duration: 1500,
			sourceId: null,
		});
		const second = regular[1];
		const progress = await library.titleProgress(ctx, { media: "tv", id: series.id }, "en");
		if (second) expect(progress.cta).toEqual({ kind: "next", season: second.number, episode: 1 });
		else expect(progress.cta).toMatchObject({ kind: expect.stringMatching(/rewatch|caughtUp/) });
		expect(progress.episodes).toEqual([{ season: first.number, episode: first.episodes, share: 1, finished: true }]);

		if (second) {
			await library.mark(
				ctx,
				{ media: "tv", id: series.id, scope: "season", season: second.number, watched: true },
				"en",
			);
			const moved = (await library.titleProgress(ctx, { media: "tv", id: series.id }, "en")).cta;
			expect(moved).not.toEqual({ kind: "next", season: second.number, episode: 1 });
			const rail = await library.continueWatching(ctx, "en");
			expect(rail.items.map((item) => item.id)).toEqual(moved?.kind === "next" ? [series.id] : []);
		}
	});

	it("marks and unmarks an episode, and unmarking a whole series clears it", async () => {
		const ctx = await ctxFor("asha");
		const { series, regular } = await longSeries();
		const season = regular[0]?.number ?? 1;
		await library.mark(ctx, { media: "tv", id: series.id, scope: "episode", season, episode: 1, watched: true }, "en");
		expect((await library.titleProgress(ctx, { media: "tv", id: series.id }, "en")).episodes).toEqual([
			{ season, episode: 1, share: 1, finished: true },
		]);
		await library.mark(ctx, { media: "tv", id: series.id, scope: "episode", season, episode: 1, watched: false }, "en");
		expect((await library.titleProgress(ctx, { media: "tv", id: series.id }, "en")).episodes).toEqual([]);
		await library.mark(ctx, { media: "tv", id: series.id, scope: "title", watched: true }, "en");
		expect((await library.titleProgress(ctx, { media: "tv", id: series.id }, "en")).cta?.kind).toMatch(
			/rewatch|caughtUp/,
		);
		await library.mark(ctx, { media: "tv", id: series.id, scope: "title", watched: false }, "en");
		expect((await library.titleProgress(ctx, { media: "tv", id: series.id }, "en")).cta).toBeNull();
	});

	it("hides a removed title until it's played again, and Rewatch starts the record over", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 1800, duration: 7200, sourceId: null });
		expect((await library.continueWatching(ctx, "en")).items.map((item) => item.id)).toEqual([movie.id]);
		await library.removeFromContinue(ctx, { media: "movie", id: movie.id });
		expect((await library.continueWatching(ctx, "en")).items).toEqual([]);
		await new Promise((resolve) => setTimeout(resolve, 5));
		await env.db.update(schema.pdProgress).set({ updatedAt: new Date(Date.now() - 60_000) });
		await env.db.update(schema.pdContinueState).set({ hiddenAt: new Date(Date.now() - 120_000) });
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 1900, duration: 7200, sourceId: null });
		expect((await library.continueWatching(ctx, "en")).items).toHaveLength(1);

		await library.rewatch(ctx, { media: "movie", id: movie.id });
		expect((await library.titleProgress(ctx, { media: "movie", id: movie.id }, "en")).cta).toBeNull();
		expect(await env.db.select().from(schema.pdProgress)).toHaveLength(1);
	});

	it("leaves out titles blocked later, and other profiles' rows", async () => {
		const asha = await ctxFor("asha");
		const bina = await ctxFor("bina");
		const movie = await popular("movie");
		await library.saveProgress(asha, { media: "movie", id: movie.id, watched: 1800, duration: 7200, sourceId: null });
		expect((await library.continueWatching(bina, "en")).items).toEqual([]);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie.id, reason: "A notice" });
		later();
		expect((await library.continueWatching(await ctxFor("asha"), "en")).items).toEqual([]);
	});

	it("imports the browser's progress once, newer entries winning", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		await library.saveProgress(ctx, { media: "movie", id: movie.id, watched: 600, duration: 7200, sourceId: null });
		const old = Date.now() - 86_400_000;
		expect(
			await library.importLocal(ctx, [
				{ media: "movie", id: movie.id, watched: 100, duration: 7200, sourceId: null, updatedAt: old },
			]),
		).toEqual({ imported: 0 });
		expect(
			await library.importLocal(ctx, [
				{ media: "movie", id: movie.id, watched: 900, duration: 7200, sourceId: null, updatedAt: Date.now() + 60_000 },
			]),
		).toEqual({ imported: 1 });
		const [row] = await env.db.select().from(schema.pdProgress);
		expect(row?.watched).toBe(900);
		expect(row?.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
	});
});

describe("the watch page", () => {
	it("fills every enabled source but {start}, in two orders, with the resume", async () => {
		const ctx = await ctxFor("asha");
		const movie = await popular("movie");
		const empty = await watchPage(
			catalog(),
			env.db,
			{ media: "movie", id: movie.id },
			{ profileId: null, autoplay: true },
			"en",
		);
		expect(empty.sources.map((source) => source.url)).toEqual(
			[1, 2, 3].map((n) => `/parda/api/${n}/movie/${movie.id}?start={start}`),
		);
		expect(empty.order.slow[0]).toBe(sources[2]?.id);
		expect(empty.order.ok[0]).toBe(sources[0]?.id);
		expect(empty.resume).toBeNull();
		expect(empty.sources.every((source) => source.deadlineMs === 15_000)).toBe(true);

		await library.saveProgress(ctx, {
			media: "movie",
			id: movie.id,
			watched: 1800,
			duration: 7200,
			sourceId: sources[1]?.id ?? null,
		});
		const mine = await watchPage(
			catalog(),
			env.db,
			{ media: "movie", id: movie.id },
			{ profileId: ctx.viewer.profile.id, autoplay: true },
			"en",
		);
		expect(mine.resume).toEqual({ position: 1800, sourceId: sources[1]?.id });
	});

	it("starts a series where the viewer is, names its neighbours, and 404s an episode it doesn't have", async () => {
		const ctx = await ctxFor("asha");
		const { series, regular } = await longSeries();
		const first = regular[0];
		if (!first) throw new Error("no season");
		const opening = await watchPage(
			catalog(),
			env.db,
			{ media: "tv", id: series.id },
			{ profileId: null, autoplay: true },
			"en",
		);
		expect(opening.episode).toMatchObject({ season: first.number, episode: 1 });
		expect(opening.previous).toBeNull();
		expect(opening.next).toEqual(first.episodes > 1 ? { season: first.number, episode: 2 } : expect.anything());
		await library.saveProgress(ctx, {
			media: "tv",
			id: series.id,
			season: first.number,
			episode: 1,
			watched: 1490,
			duration: 1500,
			sourceId: null,
		});
		const resumed = await watchPage(
			catalog(),
			env.db,
			{ media: "tv", id: series.id },
			{ profileId: ctx.viewer.profile.id, autoplay: false },
			"en",
		);
		if (first.episodes > 1) expect(resumed.episode).toMatchObject({ season: first.number, episode: 2 });
		expect(resumed.autoplay).toBe(false);
		await expect(
			watchPage(
				catalog(),
				env.db,
				{ media: "tv", id: series.id, season: first.number, episode: 99_999 },
				{ profileId: null, autoplay: true },
				"en",
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("loads nothing when playback is off, and 404s a blocked title", async () => {
		const movie = await popular("movie");
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		later();
		const off = await watchPage(
			catalog(),
			env.db,
			{ media: "movie", id: movie.id },
			{ profileId: null, autoplay: true },
			"en",
		);
		expect(off).toMatchObject({ playback: "off", sources: [] });
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie.id, reason: "A notice" });
		later();
		await expect(
			watchPage(catalog(), env.db, { media: "movie", id: movie.id }, { profileId: null, autoplay: true }, "en"),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("playbacks and reports", () => {
	it("keeps one row per playback whose counters only grow", async () => {
		const controls = createPardaControls(env.db, () => time);
		const source = sources[0]?.id ?? "";
		const play = {
			playbackId: "00000000-0000-4000-8000-000000000001",
			sourceId: source,
			media: "movie" as const,
			id: 550,
			failed: false,
			startMs: 3200,
			stallCount: 1,
			stallMs: 1600,
			watchedS: 60,
			switchedAway: false,
			band: "ok" as const,
		};
		await recordPlay(env.db, controls, "anonymous", play);
		await recordPlay(env.db, controls, "anonymous", {
			...play,
			startMs: 9000,
			stallCount: 0,
			watchedS: 600,
			switchedAway: true,
		});
		// Someone else's title under the same id changes nothing.
		await recordPlay(env.db, controls, "anonymous", { ...play, id: 551, failed: true });
		const rows = await env.db.select().from(schema.pdPlay);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ startMs: 3200, stallCount: 1, watchedS: 600, switchedAway: true, failed: false });
	});

	it("saves a report with its kind and source, and refuses a blocked title", async () => {
		const controls = createPardaControls(env.db, () => time);
		const { id } = await reportProblem(env.db, controls, "asha", {
			kind: "ads",
			media: "movie",
			id: 550,
			sourceId: sources[0]?.id ?? null,
			note: "  A pop-up  ",
		});
		const [row] = await env.db.select().from(schema.pdReport).where(eq(schema.pdReport.id, id));
		expect(row).toMatchObject({ kind: "ads", note: "A pop-up", status: "open", reporterId: "asha" });
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: 551, reason: "A notice" });
		later();
		await expect(
			reportProblem(
				env.db,
				createPardaControls(env.db, () => time),
				null,
				{
					kind: "other",
					media: "movie",
					id: 551,
					sourceId: null,
					note: "",
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("guests", () => {
	it("seeds a Parda guest with Parda's owners only, and others without Parda's", () => {
		expect(guestOwnersFor("parda").map((owner) => owner.slug)).toEqual(["parda"]);
		expect(guestOwnersFor(null).map((owner) => owner.slug)).not.toContain("parda");
		expect(GUEST_DATA).toContain(PARDA_GUEST_DATA);
	});

	it("merges the guest's default profile into the account's on claim, the later progress winning", async () => {
		await addUser("guest-1", true);
		const movie = await popular("movie");
		const guest = await ctxFor("guest-1");
		const account = await ctxFor("asha");
		await library.saveProgress(account, { media: "movie", id: movie.id, watched: 600, duration: 7200, sourceId: null });
		await env.db.update(schema.pdProgress).set({ updatedAt: new Date(Date.now() - 60_000) });
		await library.saveProgress(guest, { media: "movie", id: movie.id, watched: 1800, duration: 7200, sourceId: null });
		await env.db.insert(schema.pdProfile).values({ ownerId: "guest-1", name: "Kids", kids: true });
		await reportProblem(
			env.db,
			createPardaControls(env.db, () => time),
			"guest-1",
			{
				kind: "other",
				media: "movie",
				id: movie.id,
				sourceId: null,
				note: "",
			},
		);

		expect(await claimGuest(env.db, "guest-1", "asha")).toBe(true);
		const profiles = await env.db.select().from(schema.pdProfile);
		expect(profiles.map((profile) => [profile.ownerId, profile.name, profile.isDefault]).sort()).toEqual(
			[
				["asha", "asha", true],
				["asha", "Kids", false],
			].sort(),
		);
		const rows = await env.db.select().from(schema.pdProgress);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ watched: 1800, profileId: account.viewer.profile.id });
		const [report] = await env.db.select().from(schema.pdReport);
		expect(report?.reporterId).toBe("asha");
	});

	it("hands a guest's profile over whole when the account has none", async () => {
		await addUser("guest-2", true);
		const guest = await ctxFor("guest-2");
		const movie = await popular("movie");
		await library.saveProgress(guest, { media: "movie", id: movie.id, watched: 900, duration: 7200, sourceId: null });
		expect(await claimGuest(env.db, "guest-2", "bina")).toBe(true);
		const [profile] = await env.db.select().from(schema.pdProfile);
		expect(profile).toMatchObject({ id: guest.viewer.profile.id, ownerId: "bina", isDefault: true });
	});
});
