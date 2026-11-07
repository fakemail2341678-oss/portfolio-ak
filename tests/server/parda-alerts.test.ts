import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import * as schema from "@/server/db/schema";
import type { EmailMessage, EmailProvider } from "@/server/email/types";
import type { PardaCatalog } from "@/server/parda/catalog/context";
import { viewerZone } from "@/server/parda/catalog/context";
import { animeAiringRequest } from "@/server/parda/catalog/requests";
import { animeWeek } from "@/server/parda/catalog/schedule";
import { listTitles, popularTitles } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import { runPardaCron } from "@/server/parda/cron";
import * as saved from "@/server/parda/library/saved";
import type { PardaServices } from "@/server/parda/library/service";
import * as library from "@/server/parda/library/service";
import { checkNewEpisodes } from "@/server/parda/notify/check";
import { sendDigests } from "@/server/parda/notify/digest";
import * as alerts from "@/server/parda/notify/service";
import * as profiles from "@/server/parda/profiles/service";
import { resolveViewer } from "@/server/parda/profiles/service";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Task 68 on PGlite (decision 0241): the daily new-episode check (the first check's
 * baseline, who's told and who isn't, takedowns and caps, pacing and TMDB failing), the
 * digest (accounts that chose it, once, in their language), the bell, the New episodes
 * rail, and both halves of the schedule. TMDB answers from the recorded catalogue, with
 * the airing data each test sets.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

type Episode = { season_number: number; episode_number: number; name: string; air_date: string } | null;
/** What `tv/{id}` (the check's request) answers per series; absent is a 404. */
const airing = new Map<number, { status?: string; last: Episode; next?: Episode } | "down">();
/** Changes to a series' recorded details (the schedule's request). */
const detailsPatch = new Map<number, Record<string, unknown>>();
/** A season's episodes and air dates, by `id:season`. */
const seasons = new Map<string, Array<{ episode_number: number; name: string; air_date: string }>>();
let animeDown = false;

const json = (body: unknown) => new Response(JSON.stringify(body));
const fetcher = vi.fn<typeof fetch>(async (input) => {
	const url = new URL(String(input));
	const path = url.pathname.replace("/3/", "");
	const series = /^tv\/(\d+)$/.exec(path);
	if (series && !url.searchParams.has("append_to_response")) {
		const answer = airing.get(Number(series[1]));
		if (answer === "down") return new Response("{}", { status: 503 });
		if (!answer) return new Response("{}", { status: 404 });
		return json({
			name: `Series ${series[1]}`,
			poster_path: "/poster.jpg",
			backdrop_path: "/backdrop.jpg",
			status: answer.status ?? "Returning Series",
			last_episode_to_air: answer.last,
			next_episode_to_air: answer.next ?? null,
		});
	}
	const season = /^tv\/(\d+)\/season\/(\d+)$/.exec(path);
	if (season && seasons.has(`${season[1]}:${season[2]}`)) {
		return json({
			season_number: Number(season[2]),
			name: `Season ${season[2]}`,
			overview: "",
			episodes: seasons.get(`${season[1]}:${season[2]}`),
		});
	}
	if (path === "discover/tv" && url.searchParams.has("air_date.gte") && animeDown) {
		return new Response("{}", { status: 503 });
	}
	const language = url.searchParams.get("language") ?? "";
	const patch = series ? detailsPatch.get(Number(series[1])) : undefined;
	// A patched series nobody recorded answers with the recorded series' details, under its own id.
	const body =
		readFixture(fixtureName(path, url.searchParams, language)) ??
		(patch ? readFixture(fixtureName(`tv/${recordedSeries}`, url.searchParams, language)) : undefined);
	if (body === undefined) return new Response("{}", { status: 404 });
	return patch && series ? json({ ...JSON.parse(body), id: Number(series[1]), ...patch }) : new Response(body);
});
const tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fetcher,
);

let time = 0;
const controls = () => createPardaControls(env.db, () => time);
const catalog = (cap: string | null = null): PardaCatalog => ({
	services: { tmdb, cache: createTmdbCache(), controls: controls() },
	region: "US",
	cap,
});
const sessionOf = (id: string, guest = false): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
	...(guest ? { isAnonymous: true as const } : {}),
});
const ctxFor = async (id: string, guest = false): Promise<PardaServices> => ({
	db: env.db,
	viewer: await resolveViewer(env.db, sessionOf(id, guest), undefined, "en"),
	catalog: catalog(),
});

const NOW = new Date("2026-11-05T02:00:00Z");
const DAY = 86_400_000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);
const noSleep = async () => undefined;
const check = (now = NOW) => checkNewEpisodes(env.db, tmdb, controls(), { now, sleep: noSleep });
const ep = (season: number, episode: number, air_date = "2026-11-04"): Episode => ({
	season_number: season,
	episode_number: episode,
	name: `Episode ${episode}`,
	air_date,
});

const SERIES = 9001;
const OTHER = 9002;

const follow = async (ctx: PardaServices, id: number, kind: "watchlist" | "favourite" = "watchlist") =>
	env.db.insert(schema.pdListItem).values({ profileId: ctx.viewer.profile.id, kind, media: "tv", tmdbId: id });
const notifications = () => env.db.select().from(schema.pdNotification);

let recordedSeries = 0;

beforeAll(async () => {
	env = await createTestDb();
	recordedSeries = (await popularTitles(catalog().services, { locale: "en", region: "US", cap: null }, "tv")).results[0]
		?.id as number;
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	for (const id of ["asha", "bina", "chet"]) {
		await env.db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` });
	}
	await env.db.insert(schema.user).values({ id: "guest", name: "Guest", email: "g@x.invalid", isAnonymous: true });
	airing.clear();
	detailsPatch.clear();
	seasons.clear();
	animeDown = false;
	fetcher.mockClear();
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("the new-episode check", () => {
	it("records where a series is on its first check, then tells its followers about what aired since", async () => {
		const asha = await ctxFor("asha");
		const bina = await ctxFor("bina");
		const chet = await ctxFor("chet");
		await follow(asha, SERIES);
		await follow(bina, SERIES, "favourite");
		// Chet follows by watching: a played episode in the last six months.
		await env.db.insert(schema.pdProgress).values({
			profileId: chet.viewer.profile.id,
			media: "tv",
			tmdbId: SERIES,
			season: 2,
			episode: 4,
			watched: 3000,
			duration: 3000,
			finished: true,
			updatedAt: later(-3),
		});
		airing.set(SERIES, { last: ep(2, 4, "2026-10-28"), next: ep(2, 5, "2026-11-04") });

		expect(await check()).toMatchObject({ followed: 1, checked: 1, alerts: 0 });
		const [state] = await env.db.select().from(schema.pdFollowState);
		expect(state).toMatchObject({ tmdbId: SERIES, lastSeason: 2, lastEpisode: 4, nextAirDate: "2026-11-04" });

		// Checked today: not again until tomorrow.
		airing.set(SERIES, { last: ep(2, 5) });
		expect(await check(new Date(NOW.getTime() + 60_000))).toMatchObject({ checked: 0 });

		expect(await check(later(1))).toMatchObject({ checked: 1, alerts: 3 });
		const rows = await notifications();
		expect(rows.map((row) => row.profileId).sort()).toEqual(
			[asha, bina, chet].map((ctx) => ctx.viewer.profile.id).sort(),
		);
		expect(rows[0]).toMatchObject({ tmdbId: SERIES, season: 2, episode: 5, lastEpisode: 5 });
		expect(rows[0]?.data).toMatchObject({
			title: { en: `Series ${SERIES}` },
			poster: "/poster.jpg",
			name: "Episode 5",
		});

		// Nothing new the day after: no more alerts, and none twice.
		expect(await check(later(2))).toMatchObject({ checked: 1, alerts: 0 });
		expect(await notifications()).toHaveLength(3);
	});

	it("tells a whole season at once, and leaves out who already watched it and who doesn't follow", async () => {
		const asha = await ctxFor("asha");
		const bina = await ctxFor("bina");
		await ctxFor("chet");
		await follow(asha, SERIES);
		await follow(bina, SERIES);
		airing.set(SERIES, { last: ep(1, 10, "2026-03-01") });
		await check();
		airing.set(SERIES, { last: ep(2, 8) });
		// Bina got to the season's end before the check did.
		await env.db.insert(schema.pdProgress).values({
			profileId: bina.viewer.profile.id,
			media: "tv",
			tmdbId: SERIES,
			season: 2,
			episode: 8,
			watched: 3000,
			duration: 3000,
			finished: true,
		});
		await check(later(1));
		const rows = await notifications();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ profileId: asha.viewer.profile.id, season: 2, episode: 1, lastEpisode: 8 });
	});

	it("skips a blocked series, and a kids' profile when the series' certificate isn't known within its cap", async () => {
		const asha = await ctxFor("asha");
		await follow(asha, SERIES);
		await follow(asha, OTHER);
		const kidRow = await profiles.createProfile(asha, {
			name: "Kid",
			avatar: null,
			kids: true,
			cap: null,
			region: null,
			audioLanguage: null,
			autoplay: true,
		});
		await env.db
			.insert(schema.pdListItem)
			.values({ profileId: kidRow.id, kind: "watchlist", media: "tv", tmdbId: SERIES });
		await env.db.insert(schema.pdBlockedTitle).values({ media: "tv", tmdbId: OTHER, reason: "A notice" });
		airing.set(SERIES, { last: ep(1, 1) });
		airing.set(OTHER, { last: ep(1, 1) });
		await check();
		airing.set(SERIES, { last: ep(1, 2) });
		airing.set(OTHER, { last: ep(1, 2) });
		await check(later(1));
		// Only Asha's own profile: the kid's cap doesn't know the series, and OTHER is never asked.
		expect((await notifications()).map((row) => row.profileId)).toEqual([asha.viewer.profile.id]);
		expect(fetcher.mock.calls.some(([input]) => String(input).includes(`/tv/${OTHER}?`))).toBe(false);

		// With a certificate within the cap, the kid is told too.
		await env.db.insert(schema.pdTitle).values({
			media: "tv",
			tmdbId: SERIES,
			title: { en: "Series", ne: "शृङ्खला" },
			certification: "TV-Y",
		});
		time += 600_001;
		airing.set(SERIES, { last: ep(1, 3) });
		await check(later(2));
		const third = (await notifications()).filter((row) => row.episode === 3);
		expect(third.map((row) => row.profileId).sort()).toEqual([asha.viewer.profile.id, kidRow.id].sort());
		expect(third[0]?.data.title).toEqual({ en: `Series ${SERIES}`, ne: "शृङ्खला" });
	});

	it("checks a series TMDB no longer has weekly, and stops when TMDB is down", async () => {
		const asha = await ctxFor("asha");
		await follow(asha, SERIES);
		await check();
		const [gone] = await env.db.select().from(schema.pdFollowState);
		expect(gone?.ended).toBe(true);
		expect(await check(later(1))).toMatchObject({ checked: 0 });
		expect(await check(later(7))).toMatchObject({ checked: 1 });

		for (let id = 1; id <= 20; id++) {
			await follow(asha, 100 + id);
			airing.set(100 + id, "down");
		}
		const result = await check(later(8));
		expect(result.stopped).toBe(true);
		expect(result.failed).toBeLessThan(20);
	});

	it("runs in the daily job, with the digest after it", async () => {
		const result = await runPardaCron(env.db, tmdb, { now: NOW, controls: controls(), sleep: noSleep });
		expect(result.episodes).toMatchObject({ ok: true, followed: 0 });
		expect(result.digest).toEqual({ ok: true, sent: 0, failed: 0 });
		expect((await runPardaCron(env.db, null, { now: NOW })).episodes).toEqual({ ok: true, skipped: true });
	});
});

describe("the digest", () => {
	const outbox: EmailMessage[] = [];
	const provider: EmailProvider = {
		name: "console",
		send: async (message) => {
			outbox.push(message);
			return { id: String(outbox.length) };
		},
	};
	const alert = (profileId: string, overrides: Partial<typeof schema.pdNotification.$inferInsert> = {}) =>
		env.db.insert(schema.pdNotification).values({
			profileId,
			tmdbId: SERIES,
			season: 2,
			episode: 5,
			lastEpisode: 5,
			data: {
				title: { en: "The Long Monsoon", ne: "लामो मनसुन" },
				poster: null,
				backdrop: null,
				name: "",
				airDate: null,
			},
			createdAt: NOW,
			...overrides,
		});

	it("emails each account that chose it once, in its language, with what it hasn't read", async () => {
		outbox.length = 0;
		const asha = await ctxFor("asha");
		const bina = await ctxFor("bina");
		const guest = await ctxFor("guest", true);
		await profiles.setDigest({ ...asha, isGuest: false }, true, "ne");
		await alert(asha.viewer.profile.id);
		await alert(asha.viewer.profile.id, { tmdbId: OTHER, season: 1, episode: 1, lastEpisode: 8, readAt: NOW });
		// Bina didn't choose the digest; a guest has no email.
		await alert(bina.viewer.profile.id);
		await alert(guest.viewer.profile.id);

		expect(await sendDigests(env.db, new Set(), { provider, now: NOW })).toEqual({ sent: 1, failed: 0 });
		expect(outbox).toHaveLength(1);
		expect(outbox[0]?.to).toBe("asha@example.com");
		expect(outbox[0]?.html).toContain("लामो मनसुन");
		expect(outbox[0]?.html).toContain(`/ne/app/parda/watch/series/${SERIES}-the-long-monsoon?s=2&amp;e=5`);
		// The read alert was claimed without a line.
		expect(outbox[0]?.html).not.toContain("E1–8");
		expect(await sendDigests(env.db, new Set(), { provider, now: NOW })).toEqual({ sent: 0, failed: 0 });
	});

	it("hands the alerts back when the send fails, and leaves out old and blocked ones", async () => {
		const asha = await ctxFor("asha");
		await profiles.setDigest({ ...asha, isGuest: false }, true, "en");
		await alert(asha.viewer.profile.id);
		await alert(asha.viewer.profile.id, { tmdbId: OTHER, createdAt: later(-8) });
		const failing: EmailProvider = {
			name: "console",
			send: async () => {
				throw new Error("down");
			},
		};
		expect(await sendDigests(env.db, new Set(), { provider: failing, now: NOW })).toEqual({ sent: 0, failed: 1 });
		const rows = await notifications();
		expect(rows.every((row) => row.emailedAt === null)).toBe(true);

		outbox.length = 0;
		expect(await sendDigests(env.db, new Set([`tv:${SERIES}`]), { provider, now: NOW })).toEqual({
			sent: 0,
			failed: 0,
		});
		expect(outbox).toHaveLength(0);
	});
});

describe("the bell and the New episodes rail", () => {
	it("lists the profile's alerts, marks them read, and keeps a series on the rail until its episode is watched", async () => {
		const asha = await ctxFor("asha");
		await env.db.insert(schema.pdNotification).values([
			{
				profileId: asha.viewer.profile.id,
				tmdbId: SERIES,
				season: 2,
				episode: 4,
				lastEpisode: 4,
				data: { title: { en: "Old", ne: "" }, poster: null, backdrop: null, name: "", airDate: null },
				createdAt: new Date(Date.now() - 2 * DAY),
			},
			{
				profileId: asha.viewer.profile.id,
				tmdbId: SERIES,
				season: 2,
				episode: 5,
				lastEpisode: 6,
				data: {
					title: { en: "The Long Monsoon", ne: "लामो मनसुन" },
					poster: "/p.jpg",
					backdrop: "/b.jpg",
					name: "",
					airDate: null,
				},
			},
		]);
		const inbox = await alerts.inbox(asha, "ne");
		expect(inbox.unread).toBe(2);
		expect(inbox.items[0]).toMatchObject({ title: "लामो मनसुन", slug: "the-long-monsoon", episode: 5, lastEpisode: 6 });

		const rail = await alerts.newEpisodes(asha, "en");
		expect(rail).toEqual([
			{
				id: SERIES,
				slug: "the-long-monsoon",
				title: "The Long Monsoon",
				backdrop: "/b.jpg",
				season: 2,
				episode: 5,
				lastEpisode: 6,
			},
		]);
		expect((await saved.forYou(asha, "en")).episodes).toHaveLength(1);

		await alerts.markRead(asha, null);
		expect((await alerts.inbox(asha, "en")).unread).toBe(0);

		await library.saveProgress(asha, {
			media: "tv",
			id: SERIES,
			season: 2,
			episode: 6,
			watched: 3000,
			duration: 3000,
			sourceId: null,
		});
		expect(await alerts.newEpisodes(asha, "en")).toEqual([]);
	});
});

describe("the schedule", () => {
	it("lists a followed series' episodes in the next 14 days, from its next episode and that season", async () => {
		const asha = await ctxFor("asha");
		await follow(asha, recordedSeries);
		detailsPatch.set(recordedSeries, {
			next_episode_to_air: { season_number: 3, episode_number: 2, name: "Two", air_date: "2026-11-06" },
		});
		seasons.set(`${recordedSeries}:3`, [
			{ episode_number: 1, name: "One", air_date: "2026-10-30" },
			{ episode_number: 2, name: "Two", air_date: "2026-11-06" },
			{ episode_number: 3, name: "Three", air_date: "2026-11-13" },
			{ episode_number: 4, name: "Four", air_date: "2026-11-20" },
		]);
		const { entries } = await alerts.followingSchedule(asha, "en", "2026-11-05");
		expect(entries.map((entry) => [entry.episode, entry.airDate, entry.kind])).toEqual([
			[2, "2026-11-06", "following"],
			[3, "2026-11-13", "following"],
		]);

		// A next episode past the window, or none, puts nothing on it.
		expect((await alerts.followingSchedule(asha, "en", "2026-10-01")).entries).toEqual([]);
		// Nobody else's follows.
		expect((await alerts.followingSchedule(await ctxFor("bina"), "en", "2026-11-05")).entries).toEqual([]);
	});

	it("lists anime airing this week from each title's next or latest episode, and says when TMDB fails", async () => {
		const services = catalog();
		const week = await animeWeek(services, "en", "2026-11-05");
		expect(week.failed).toBe(false);
		expect(week.entries.every((entry) => entry.kind === "anime" && entry.airDate >= "2026-11-05")).toBe(true);

		// The week's list shares its recording with the anime hub's "Airing today" (fixture names drop dates).
		const list = await listTitles(
			services.services,
			{ locale: "en", region: "US", cap: null },
			animeAiringRequest("2026-11-05", "2026-11-11"),
		);
		const [first, second] = list.results.map((title) => title.id);
		expect(first).toBeDefined();
		expect(second).toBeDefined();
		// The first aired an episode before the week and has its next inside it; the second aired today.
		detailsPatch.set(first as number, {
			last_episode_to_air: { season_number: 1, episode_number: 6, name: "Six", air_date: "2026-11-01" },
			next_episode_to_air: { season_number: 1, episode_number: 7, name: "Seven", air_date: "2026-11-08" },
		});
		detailsPatch.set(second as number, {
			last_episode_to_air: { season_number: 2, episode_number: 3, name: "Three", air_date: "2026-11-05" },
			next_episode_to_air: null,
		});
		const patched = await animeWeek(catalog(), "en", "2026-11-05");
		expect(patched.entries.find((entry) => entry.id === first)).toMatchObject({
			season: 1,
			episode: 7,
			airDate: "2026-11-08",
		});
		expect(patched.entries.find((entry) => entry.id === second)).toMatchObject({
			season: 2,
			episode: 3,
			airDate: "2026-11-05",
		});

		animeDown = true;
		expect(await animeWeek(catalog(), "en", "2026-11-12")).toMatchObject({ entries: [], failed: true });
	});

	it("takes today from the visitor's zone when Vercel names a real one", () => {
		expect(viewerZone("America/New_York")).toBe("America/New_York");
		expect(viewerZone("Not/AZone")).toBe("Asia/Kathmandu");
		expect(viewerZone(undefined)).toBe("Asia/Kathmandu");
		expect(viewerZone("")).toBe("Asia/Kathmandu");
	});
});

describe("the digest's choice", () => {
	it("keeps the language it was chosen in", async () => {
		const asha = await ctxFor("asha");
		await profiles.setDigest({ ...asha, isGuest: false }, true, "ne");
		const [row] = await env.db.select().from(schema.pdAccount).where(eq(schema.pdAccount.userId, "asha"));
		expect(row).toMatchObject({ digest: true, locale: "ne" });
	});
});
