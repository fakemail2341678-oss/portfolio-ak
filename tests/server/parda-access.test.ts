import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withinCap } from "@/features/parda/kids";
import { PARTY_MAX_MEMBERS } from "@/features/parda/party/source";
import type { Session } from "@/lib/session";
import * as schema from "@/server/db/schema";
import type { PardaCatalog } from "@/server/parda/catalog/context";
import { popularTitles, titleDetails, usCertificate } from "@/server/parda/catalog/service";
import { createPardaControls } from "@/server/parda/controls";
import * as saved from "@/server/parda/library/saved";
import * as library from "@/server/parda/library/service";
import * as alerts from "@/server/parda/notify/service";
import * as party from "@/server/parda/party/service";
import * as profiles from "@/server/parda/profiles/service";
import { resolveViewer } from "@/server/parda/profiles/service";
import { createTmdbCache } from "@/server/parda/tmdb/cache";
import { createTmdb } from "@/server/parda/tmdb/client";
import { fixtureName, readFixture } from "../../e2e/harness/tmdb";
import { createTestDb } from "../utils/test-db";

/**
 * Parda's access matrix (PLAN 12.5, "Guard test"; decisions 0236 and 0240): every library
 * operation acts on the caller's own profile, works for a guest, and refuses a blocked
 * title (or one over a kids' cap). Saving progress is refused with playback off. Every
 * profile operation acts on the caller's own profiles, and a kids' profile can only switch.
 * Every alerts operation (decision 0241) reads and marks the caller's own profile's alerts. The
 * functions' middleware (requirePardaViewer, then withPardaServices) is checked by
 * tests/server/guarded-functions.test.ts. Every party function (decision 0243) acts only
 * on a party the caller is in, or is joining with its code.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const fetcher = vi.fn<typeof fetch>(async (input) => {
	const url = new URL(String(input));
	const body = readFixture(
		fixtureName(url.pathname.replace("/3/", ""), url.searchParams, url.searchParams.get("language") ?? ""),
	);
	return body === undefined ? new Response("{}", { status: 404 }) : new Response(body);
});
const tmdb = createTmdb(
	{ token: "t".repeat(24), apiBase: "https://tmdb.test/3", imageBase: "https://img.test" },
	fetcher,
);
let time = 0;
const catalog = (cap: string | null = null): PardaCatalog => ({
	services: { tmdb, cache: createTmdbCache(), controls: createPardaControls(env.db, () => time) },
	region: "US",
	cap,
});
const session = (id: string, guest = false): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
	...(guest ? { isAnonymous: true as const } : {}),
});
const ctx = async (id: string, guest = false): Promise<library.PardaServices> => ({
	db: env.db,
	viewer: await resolveViewer(env.db, session(id, guest), undefined, "en"),
	catalog: catalog(),
});

let movie = 0;
let person = 0;
type Operation = (context: library.PardaServices, id: number) => Promise<unknown>;

/** Every library function's service call (src/functions/parda/library.ts), on a movie. */
const OPERATIONS: Record<string, Operation> = {
	getPardaContinue: (context) => library.continueWatching(context, "en"),
	getPardaTitleProgress: (context, id) => library.titleProgress(context, { media: "movie", id }, "en"),
	savePardaProgress: (context, id) =>
		library.saveProgress(context, { media: "movie", id, watched: 1200, duration: 7200, sourceId: null }),
	markPardaWatched: (context, id) => library.mark(context, { media: "movie", id, scope: "title", watched: true }, "en"),
	removePardaContinue: (context, id) => library.removeFromContinue(context, { media: "movie", id }),
	rewatchPardaTitle: (context, id) => library.rewatch(context, { media: "movie", id }),
	importPardaProgress: (context, id) =>
		library.importLocal(context, [
			{ media: "movie", id, watched: 600, duration: 7200, sourceId: null, updatedAt: Date.now() },
		]),
	getPardaSaved: (context) => saved.savedState(context),
	setPardaListed: (context, id) => saved.setListed(context, { media: "movie", id, kind: "watchlist", on: true }),
	setPardaPersonFavourite: (context) => saved.setPersonFavourite(context, { id: person, on: true }),
	ratePardaTitle: (context, id) => saved.rate(context, { media: "movie", id, value: "like" }),
	getPardaLibrary: (context) => saved.listPage(context, { type: "all", sort: "added", page: 1 }, "en"),
	getPardaHistory: (context) => saved.history(context, 1, "en"),
	removePardaHistory: (context, id) =>
		saved.removeHistory(context, { media: "movie", id, day: new Date().toISOString().slice(0, 10) }),
	clearPardaHistory: (context) => saved.clearHistory(context),
	getPardaForYou: (context) => saved.forYou(context, "en"),
};

/** Every row a library operation can write: none of another profile's may change. */
const libraryRows = async () => ({
	progress: await env.db.select().from(schema.pdProgress),
	list: await env.db.select().from(schema.pdListItem),
	people: await env.db.select().from(schema.pdFavouritePerson),
	ratings: await env.db.select().from(schema.pdRating),
});

/** The operations a takedown refuses; the rest leave a blocked title out instead. */
const REFUSED_WHEN_BLOCKED = new Set([
	"getPardaTitleProgress",
	"savePardaProgress",
	"markPardaWatched",
	"rewatchPardaTitle",
	"setPardaListed",
	"ratePardaTitle",
]);

beforeAll(async () => {
	env = await createTestDb();
	const first = (await popularTitles(catalog().services, { locale: "en", region: "US", cap: null }, "movie"))
		.results[0];
	movie = first?.id ?? 550;
	const details = await titleDetails(catalog().services, { locale: "en", region: "US", cap: null }, "movie", movie);
	person = details.cast[0]?.id ?? 287;
}, 120_000);
beforeEach(async () => {
	await env.reset();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	for (const id of ["asha", "bina"]) {
		await env.db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` });
	}
	await env.db
		.insert(schema.user)
		.values({ id: "guest", name: "Guest", email: "guest@example.com", isAnonymous: true });
	time += 60_000;
});
afterAll(async () => {
	await env.close();
});

describe("Parda's library access matrix", () => {
	it("has a row for every library function (getPardaViewer reads only the viewer itself)", () => {
		const source = readFileSync("src/functions/parda/library.ts", "utf8");
		const functions = [...source.matchAll(/export const (\w+) = createServerFn/g)].map((match) => match[1]);
		expect(functions).toEqual(["getPardaViewer", ...Object.keys(OPERATIONS)]);
	});

	for (const [name, operation] of Object.entries(OPERATIONS)) {
		it(`${name}: own profile only, guests allowed, takedowns respected`, async () => {
			const asha = await ctx("asha");
			await operation(asha, movie);
			// Another viewer never sees or changes Asha's rows.
			const before = await libraryRows();
			await operation(await ctx("bina"), movie);
			const bina = await ctx("bina");
			const after = await libraryRows();
			for (const table of Object.keys(before) as Array<keyof typeof before>) {
				const owned = (rows: ReadonlyArray<{ profileId: string }>) =>
					rows.filter((row) => row.profileId === asha.viewer.profile.id);
				expect(owned(after[table])).toEqual(owned(before[table]));
				expect(
					after[table].every((row) => [asha.viewer.profile.id, bina.viewer.profile.id].includes(row.profileId)),
				).toBe(true);
			}
			// A guest has a session, so the library is theirs too.
			await expect(operation(await ctx("guest", true), movie)).resolves.not.toThrow();

			await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie, reason: "A notice" });
			time += 30_001;
			const blocked = operation(await ctx("asha"), movie);
			if (REFUSED_WHEN_BLOCKED.has(name)) await expect(blocked).rejects.toMatchObject({ code: "NOT_FOUND" });
			else await expect(blocked).resolves.not.toThrow();
		});
	}

	it("refuses what a kids' cap refuses: a title over it can't be saved or rated", async () => {
		const details = await titleDetails(catalog().services, { locale: "en", region: "US", cap: null }, "movie", movie);
		const kids: library.PardaServices = { ...(await ctx("asha")), catalog: catalog("G") };
		const within = withinCap("G", "movie", usCertificate(details));
		for (const name of ["setPardaListed", "ratePardaTitle"]) {
			const run = OPERATIONS[name]?.(kids, movie);
			if (within) await expect(run).resolves.not.toThrow();
			else await expect(run).rejects.toMatchObject({ code: "NOT_FOUND" });
		}
	});

	it("refuses saving progress while playback is off", async () => {
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		await expect(OPERATIONS.savePardaProgress?.(await ctx("asha"), movie)).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("leaves a blocked title out of the rail and the import", async () => {
		const asha = await ctx("asha");
		await library.saveProgress(asha, { media: "movie", id: movie, watched: 1200, duration: 7200, sourceId: null });
		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie, reason: "A notice" });
		time += 30_001;
		const later = await ctx("asha");
		expect((await library.continueWatching(later, "en")).items).toEqual([]);
		expect(
			await library.importLocal(later, [
				{ media: "movie", id: movie, watched: 1, duration: 7200, sourceId: null, updatedAt: Date.now() },
			]),
		).toEqual({ imported: 0 });
	});
});

type Viewer = Awaited<ReturnType<typeof ctx>>;
const fields = (name: string, kids = false) => ({
	name,
	avatar: null,
	kids,
	cap: null,
	region: null,
	audioLanguage: null,
	autoplay: true,
});

/** Every profile function's service call (src/functions/parda/profiles.ts). */
const PROFILE_OPERATIONS: Record<string, (context: Viewer, target: string) => Promise<unknown>> = {
	getPardaProfiles: (context) => profiles.profilesOf(context.db, context.viewer.userId),
	createPardaProfile: (context) => profiles.createProfile(context, fields("Another")),
	updatePardaProfile: (context, target) => profiles.updateProfile(context, target, fields("Renamed")),
	deletePardaProfile: (context, target) => profiles.deleteProfile(context, target),
	setPardaProfilePin: (context, target) => profiles.setPin(context, target, "1234"),
	switchPardaProfile: (context, target) => profiles.switchProfile(context, target, undefined),
	setPardaDigest: (context) => profiles.setDigest({ ...context, isGuest: context.viewer.isGuest }, true),
};
/** What only the profile's owner may do to a profile, by id. */
const TARGETED = new Set(["updatePardaProfile", "deletePardaProfile", "setPardaProfilePin", "switchPardaProfile"]);
/** What a kids' profile can still do: read its profiles and switch. */
const KIDS_ALLOWED = new Set(["getPardaProfiles", "switchPardaProfile", "setPardaDigest"]);

describe("Parda's profiles access matrix", () => {
	it("has a row for every profile function", () => {
		const source = readFileSync("src/functions/parda/profiles.ts", "utf8");
		const functions = [...source.matchAll(/export const (\w+) = createServerFn/g)].map((match) => match[1]);
		expect(functions).toEqual(Object.keys(PROFILE_OPERATIONS));
	});

	for (const [name, operation] of Object.entries(PROFILE_OPERATIONS)) {
		it(`${name}: own profiles only, guests allowed, kids' profiles ${KIDS_ALLOWED.has(name) ? "allowed" : "refused"}`, async () => {
			const asha = await ctx("asha");
			const ashaSecond = await profiles.createProfile(asha, fields("Second"));
			const bina = await ctx("bina");
			if (TARGETED.has(name)) {
				// Bina can't reach Asha's profile by its id: as if it didn't exist.
				await expect(operation(bina, ashaSecond.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
			}
			await expect(operation(asha, ashaSecond.id)).resolves.not.toThrow();

			const guest = await ctx("guest", true);
			const guestSecond = await profiles.createProfile(guest, fields("Guest two"));
			const asGuest = operation(guest, guestSecond.id);
			// A guest has no email, so no digest.
			if (name === "setPardaDigest") await expect(asGuest).rejects.toMatchObject({ code: "FORBIDDEN" });
			else await expect(asGuest).resolves.not.toThrow();

			const kidsRow = await profiles.createProfile(await ctx("bina"), fields("Kid", true));
			const other = await profiles.createProfile(await ctx("bina"), fields("Third"));
			const kid: Viewer = {
				...bina,
				viewer: await resolveViewer(env.db, session("bina"), profiles.profileCookieValue(kidsRow), "en"),
			};
			expect(kid.viewer.profile.kids).toBe(true);
			const asKid = operation(kid, other.id);
			if (KIDS_ALLOWED.has(name)) await expect(asKid).resolves.not.toThrow();
			else await expect(asKid).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	}
});

/** Every alerts function's service call (src/functions/parda/alerts.ts, decision 0241). */
const ALERT_OPERATIONS: Record<string, (context: Viewer) => Promise<unknown>> = {
	getPardaInbox: (context) => alerts.inbox(context, "en"),
	markPardaInboxRead: (context) => alerts.markRead(context, null),
	getPardaFollowing: (context) => alerts.followingSchedule(context, "en", "2026-11-05"),
};

const alertFor = async (profileId: string) => {
	const [row] = await env.db
		.insert(schema.pdNotification)
		.values({
			profileId,
			tmdbId: 1396,
			season: 2,
			episode: 5,
			lastEpisode: 5,
			data: { title: { en: "A series", ne: "" }, poster: null, backdrop: null, name: "", airDate: "2026-11-04" },
		})
		.returning();
	return row;
};

/** Every party function's service call (src/functions/parda/party.ts, decision 0243). */
const realtime = { key: "app.key:top-secret", relayUrl: null };
const PARTY_OPERATIONS: Record<string, (context: Viewer, code: string) => Promise<unknown>> = {
	createPardaParty: (context) => party.createParty(context, realtime, { media: "movie", id: movie }, "en"),
	joinPardaParty: (context, code) => party.joinParty(context, realtime, code, "en"),
	getPardaPartyToken: (context, code) => party.partyToken(context, realtime, code),
	pulsePardaParty: (context, code) => party.pulseParty(context, code, null),
	leavePardaParty: (context, code) => party.leaveParty(context, code),
	setPardaPartySource: async (context, code) => {
		const [source] = await env.db.select().from(schema.pdSource);
		return party.setPartySource(context, code, source?.id ?? "");
	},
	takeOverPardaParty: (context, code) => party.takeOverParty(context, code),
	endPardaParty: (context, code) => party.endPartyAsHost(context, code),
};
/** What someone holding only a party's code can do: joining is what the code is for, and leaving a party you're not in does nothing. */
const OPEN_WITH_THE_CODE = new Set(["createPardaParty", "joinPardaParty", "leavePardaParty"]);
/** What a seat alone doesn't allow: the host's. */
const HOST_ONLY = new Set(["setPardaPartySource", "endPardaParty"]);

describe("Parda's party access matrix", () => {
	const seedSource = () =>
		env.db.insert(schema.pdSource).values({
			name: { en: "Server 1", ne: "Server 1" },
			movieTemplate: "/1/movie/{id}?start={start}",
			tvTemplate: "/1/tv/{id}/{season}/{episode}?start={start}",
			adapter: "parda",
		});
	const hosted = async () => {
		await seedSource();
		time += 30_001;
		return (await party.createParty(await ctx("asha"), realtime, { media: "movie", id: movie }, "en")).code;
	};

	it("has a row for every party function", () => {
		const source = readFileSync("src/functions/parda/party.ts", "utf8");
		const functions = [...source.matchAll(/export const (\w+) = createServerFn/g)].map((match) => match[1]);
		expect(functions).toEqual(Object.keys(PARTY_OPERATIONS));
	});

	for (const [name, operation] of Object.entries(PARTY_OPERATIONS)) {
		it(`${name}: members only, guests allowed, the wrong code refused`, async () => {
			const code = await hosted();
			const stranger = await ctx("bina");
			if (!OPEN_WITH_THE_CODE.has(name))
				await expect(operation(stranger, code)).rejects.toMatchObject({ code: "NOT_FOUND" });

			const guest = await ctx("guest", true);
			await party.joinParty(guest, realtime, code, "en");
			if (HOST_ONLY.has(name)) {
				await expect(operation(guest, code)).rejects.toMatchObject({ code: "FORBIDDEN" });
			} else if (name === "takeOverPardaParty") {
				// The host is still here.
				await expect(operation(guest, code)).rejects.toMatchObject({ code: "CONFLICT" });
			} else {
				await expect(operation(guest, code)).resolves.not.toThrow();
			}

			if (name !== "createPardaParty" && name !== "leavePardaParty") {
				await expect(operation(await ctx("asha"), "no-such-party-00")).rejects.toMatchObject({ code: "NOT_FOUND" });
			}
		});
	}

	it("a full party, a blocked title and playback off refuse a seat", async () => {
		const code = await hosted();
		for (let seat = 0; seat < PARTY_MAX_MEMBERS - 1; seat += 1) {
			await env.db.insert(schema.user).values({ id: `seat${seat}`, name: "Seat", email: `seat${seat}@example.com` });
			await party.joinParty(await ctx(`seat${seat}`), realtime, code, "en");
		}
		await expect(party.joinParty(await ctx("bina"), realtime, code, "en")).rejects.toMatchObject({ code: "CONFLICT" });

		await env.db.insert(schema.pdBlockedTitle).values({ media: "movie", tmdbId: movie, reason: "A notice" });
		time += 30_001;
		await expect(party.joinParty(await ctx("bina"), realtime, code, "en")).rejects.toMatchObject({ code: "NOT_FOUND" });
		await env.db.delete(schema.pdBlockedTitle);
		time += 30_001;
		await env.db.update(schema.pdSettings).set({ playbackEnabled: false });
		time += 30_001;
		await expect(
			party.createParty(await ctx("bina"), realtime, { media: "movie", id: movie }, "en"),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("a token reaches its own party's channel and no other", async () => {
		const one = await hosted();
		const two = (await party.createParty(await ctx("asha"), realtime, { media: "movie", id: movie }, "en")).code;
		const joined = await party.joinParty(await ctx("bina"), realtime, one, "en");
		const claims = JSON.parse(Buffer.from(joined.connection.token.split(".")[1] ?? "", "base64url").toString());
		const channels = Object.keys(JSON.parse(claims["x-ably-capability"]));
		expect(channels).toEqual([`parda-party:${one}`]);
		// A member of one party gets no token for another.
		await expect(party.partyToken(await ctx("bina"), realtime, two)).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("Parda's alerts access matrix", () => {
	it("has a row for every alerts function", () => {
		const source = readFileSync("src/functions/parda/alerts.ts", "utf8");
		const functions = [...source.matchAll(/export const (\w+) = createServerFn/g)].map((match) => match[1]);
		expect(functions).toEqual(Object.keys(ALERT_OPERATIONS));
	});

	for (const [name, operation] of Object.entries(ALERT_OPERATIONS)) {
		it(`${name}: the own profile's alerts only, guests and kids' profiles allowed`, async () => {
			const bina = await ctx("bina");
			const binas = await alertFor(bina.viewer.profile.id);
			const asha = await ctx("asha");
			const result = await operation(asha);
			if (name === "getPardaInbox") expect(result).toMatchObject({ items: [], unread: 0 });
			// Nothing Asha does reads or marks Bina's alert.
			const [after] = await env.db.select().from(schema.pdNotification);
			expect(after?.id).toBe(binas?.id);
			expect(after?.readAt).toBeNull();
			expect(await alerts.inbox(bina, "en")).toMatchObject({ unread: 1 });

			await expect(operation(await ctx("guest", true))).resolves.not.toThrow();
			const kidsRow = await profiles.createProfile(bina, fields("Kid", true));
			const kid: Viewer = {
				...bina,
				viewer: await resolveViewer(env.db, session("bina"), profiles.profileCookieValue(kidsRow), "en"),
			};
			await expect(operation(kid)).resolves.not.toThrow();
		});
	}

	it("hides a blocked series' alerts", async () => {
		const asha = await ctx("asha");
		await alertFor(asha.viewer.profile.id);
		expect((await alerts.inbox(asha, "en")).items).toHaveLength(1);
		await env.db.insert(schema.pdBlockedTitle).values({ media: "tv", tmdbId: 1396, reason: "A notice" });
		time += 30_001;
		expect((await alerts.inbox(await ctx("asha"), "en")).items).toEqual([]);
	});
});
