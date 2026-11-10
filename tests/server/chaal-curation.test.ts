import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChaalFeaturedInput, chaalFeaturedInput, chaalHomeSectionsInput } from "@/features/chaal/admin/schema";
import { CHAAL_HOME_SECTIONS, mergedSections, parseFeaturedRef } from "@/features/chaal/home/curation";
import { AppError } from "@/lib/errors";
import type { ChaalAdminServices } from "@/server/chaal/admin/context";
import * as curation from "@/server/chaal/admin/curation";
import { getOverview } from "@/server/chaal/admin/overview";
import { createChaalControls } from "@/server/chaal/controls";
import { runChaalCron } from "@/server/chaal/cron";
import { rollupDaily, storedDays } from "@/server/chaal/daily";
import { chaalHome, FEATURED_SHOWN } from "@/server/chaal/home";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Task 84 on PGlite (decision 0274): featured items (ids read out of Lichess addresses,
 * refused twice, versioned, ordered per section, audited), the home's sections and its
 * announcement, what the home shows on a given day, the daily rollup (a missed run fills
 * in, a second run replaces the day) and the overview's figures.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const invalidate = vi.fn();

const admin = (): ChaalAdminServices => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: [] },
	imageStore: null,
	controls: { invalidate },
	connect: async () => {
		throw new Error("not used");
	},
	connectConfigured: true,
});

const auditOf = (action: string) => env.db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, action));

const item = (input: Partial<ChaalFeaturedInput> = {}): ChaalFeaturedInput => ({
	kind: "arena",
	ref: "Ar3naW1n",
	title: { en: "Saturday arena", ne: "" },
	startsOn: "",
	endsOn: "",
	...input,
});

/** Noon in Kathmandu on 2026-11-10. */
const NOW = new Date("2026-11-10T06:15:00Z");

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(["p1", "p2", "p3"].map((id) => ({ id, name: id, email: `${id}@example.com` })));
	});
}, 120_000);
beforeEach(async () => {
	await env.reset();
	invalidate.mockClear();
});
afterAll(async () => {
	await env.close();
});

describe("parseFeaturedRef", () => {
	it("reads ids and Lichess addresses for each kind", () => {
		expect(parseFeaturedRef("arena", " Ar3naW1n ")).toBe("Ar3naW1n");
		expect(parseFeaturedRef("arena", "https://lichess.org/tournament/Ar3naW1n")).toBe("Ar3naW1n");
		expect(parseFeaturedRef("swiss", "https://lichess.org/swiss/Sw1ssKtm")).toBe("Sw1ssKtm");
		expect(parseFeaturedRef("study", "https://lichess.org/study/St0dyAbc/Ch4pterX")).toBe("St0dyAbc");
		expect(parseFeaturedRef("broadcast", "https://lichess.org/broadcast/world-champs/wEuVhT9c")).toBe("wEuVhT9c");
		expect(parseFeaturedRef("theme", "fork")).toBe("fork");
	});

	it("refuses a round's address, another site, the wrong kind and junk", () => {
		expect(parseFeaturedRef("broadcast", "https://lichess.org/broadcast/world-champs/round-1/R0und1Ab")).toBeNull();
		expect(parseFeaturedRef("arena", "https://example.org/tournament/Ar3naW1n")).toBeNull();
		expect(parseFeaturedRef("swiss", "https://lichess.org/tournament/Ar3naW1n")).toBeNull();
		expect(parseFeaturedRef("study", "not an id")).toBeNull();
	});

	it("the input refuses an unknown theme, `mix` and dates out of order", () => {
		expect(chaalFeaturedInput.safeParse(item({ kind: "theme", ref: "fork" })).success).toBe(true);
		expect(chaalFeaturedInput.safeParse(item({ kind: "theme", ref: "mix" })).success).toBe(false);
		expect(chaalFeaturedInput.safeParse(item({ kind: "theme", ref: "nosuchtheme" })).success).toBe(false);
		expect(chaalFeaturedInput.safeParse(item({ startsOn: "2026-11-10", endsOn: "2026-11-01" })).success).toBe(false);
	});
});

describe("featured items", () => {
	it("creates from an address, last in its section, audited, and clears the controls", async () => {
		const first = await curation.createFeatured(admin(), item({ ref: "https://lichess.org/tournament/Ar3naW1n" }), NOW);
		const second = await curation.createFeatured(admin(), item({ kind: "swiss", ref: "Sw1ssKtm" }), NOW);
		const study = await curation.createFeatured(admin(), item({ kind: "study", ref: "St0dyAbc" }), NOW);
		expect(first.ref).toBe("Ar3naW1n");
		const rows = await env.db.select().from(schema.chFeatured);
		const position = (id: string) => rows.find((row) => row.id === id)?.position;
		expect([position(first.id), position(second.id), position(study.id)]).toEqual([0, 1, 0]);
		expect(await auditOf("chaal.featured.create")).toHaveLength(3);
		expect(invalidate).toHaveBeenCalledTimes(3);
	});

	it("refuses the same item twice, on the field", async () => {
		await curation.createFeatured(admin(), item(), NOW);
		const twice = await curation.createFeatured(admin(), item(), NOW).catch((error: unknown) => error);
		expect(twice).toBeInstanceOf(AppError);
		expect((twice as AppError).code).toBe("CONFLICT");
	});

	it("updates from the version it opened at, refuses a stale one, and a move to another section goes last there", async () => {
		const study = await curation.createFeatured(admin(), item({ kind: "study", ref: "St0dyAbc" }), NOW);
		const arena = await curation.createFeatured(admin(), item(), NOW);
		const moved = await curation.updateFeatured(
			admin(),
			{ ...item({ kind: "study", ref: "St0dyXyz", startsOn: "2026-12-01" }), id: arena.id, updatedAt: arena.updatedAt },
			NOW,
		);
		expect(moved).toMatchObject({ kind: "study", ref: "St0dyXyz", state: "scheduled", updatedAt: "2" });
		const [row] = await env.db.select().from(schema.chFeatured).where(eq(schema.chFeatured.id, arena.id));
		expect(row?.position).toBe(1);
		const stale = await curation
			.updateFeatured(admin(), { ...item(), id: arena.id, updatedAt: arena.updatedAt }, NOW)
			.catch((error: unknown) => error);
		expect((stale as AppError).code).toBe("CONFLICT");
		expect(study.state).toBe("live");
	});

	it("reorders a whole section only, and deletes", async () => {
		const a = await curation.createFeatured(admin(), item({ ref: "Ar3naAAA" }), NOW);
		const b = await curation.createFeatured(admin(), item({ kind: "swiss", ref: "Sw1ssBBB" }), NOW);
		await expect(curation.reorderFeatured(admin(), { section: "tournaments", ids: [b.id] })).rejects.toThrow(
			/every item/,
		);
		expect(await curation.reorderFeatured(admin(), { section: "tournaments", ids: [b.id, a.id] })).toEqual({
			moved: 2,
		});
		const page = await curation.getCuration(admin(), NOW);
		expect(page.featured.map((each) => each.id)).toEqual([b.id, a.id]);
		expect(await curation.deleteFeatured(admin(), [a.id])).toEqual({ deleted: 1 });
		expect(await auditOf("chaal.featured.delete")).toHaveLength(1);
	});
});

describe("the home", () => {
	const home = () =>
		chaalHome(
			createChaalControls(env.db, () => 0),
			NOW,
		);

	it("defaults: the ways in only, no announcement, no empty featured section", async () => {
		expect(await home()).toMatchObject({ sections: ["start"], announcement: null });
	});

	it("shows today's items in order, capped, in the admin's section order, and the announcement", async () => {
		await curation.createFeatured(admin(), item({ ref: "Ar3naOld", endsOn: "2026-11-09" }), NOW);
		await curation.createFeatured(admin(), item({ ref: "Ar3naNew", startsOn: "2026-11-11" }), NOW);
		await curation.createFeatured(
			admin(),
			item({ ref: "Ar3naNow", startsOn: "2026-11-10", endsOn: "2026-11-10" }),
			NOW,
		);
		for (let index = 0; index < FEATURED_SHOWN + 1; index += 1) {
			await curation.createFeatured(
				admin(),
				item({
					kind: "theme",
					ref: ["fork", "pin", "skewer", "mateIn1", "mateIn2", "endgame", "opening"][index] ?? "fork",
				}),
				NOW,
			);
		}
		await curation.saveAnnouncement(admin(), { announcement: { en: "Club night is Friday.", ne: "" } });
		const order = ["themes", "tournaments", "start", "announcement", "broadcasts", "studies"] as const;
		await curation.saveHomeSections(admin(), {
			sections: order.map((key) => ({ key, visible: key !== "start" })),
		});
		const shown = await home();
		expect(shown.sections).toEqual(["themes", "tournaments", "announcement"]);
		expect(shown.featured.tournaments.map((each) => each.ref)).toEqual(["Ar3naNow"]);
		expect(shown.featured.themes).toHaveLength(FEATURED_SHOWN);
		expect(shown.announcement?.en).toBe("Club night is Friday.");
		expect(await auditOf("chaal.home.update")).toHaveLength(1);
		expect(await auditOf("chaal.announcement")).toHaveLength(1);
	});

	it("an empty announcement hides it; a section added in code joins at the end", async () => {
		await curation.saveAnnouncement(admin(), { announcement: { en: "", ne: "केही" } });
		expect((await home()).announcement).toBeNull();
		expect(mergedSections([{ key: "themes", position: 0, visible: false }]).map((each) => each.key)).toEqual([
			"themes",
			...CHAAL_HOME_SECTIONS.filter((key) => key !== "themes"),
		]);
		expect(
			chaalHomeSectionsInput.safeParse({
				sections: CHAAL_HOME_SECTIONS.map(() => ({ key: "start", visible: true })),
			}).success,
		).toBe(false);
	});
});

describe("the rollup and the overview", () => {
	const at = (iso: string) => new Date(iso);

	async function activity() {
		await env.db.insert(schema.chActivity).values([
			{ userId: "p1", kind: "game", mode: "ai", ref: "g1", at: at("2026-11-08T10:00:00Z") },
			{ userId: "p1", kind: "game", mode: "local-board", ref: "g2", at: at("2026-11-08T11:00:00Z") },
			{ userId: "p2", kind: "puzzle", ref: "z1", at: at("2026-11-08T12:00:00Z") },
			{ userId: "p2", kind: "analysis", ref: "a1", at: at("2026-11-09T09:00:00Z") },
			{ userId: "p3", kind: "connect", at: at("2026-11-09T09:30:00Z") },
			{ userId: "p3", kind: "game", mode: "seek", ref: "g3", at: at("2026-11-10T05:00:00Z") },
			{ userId: null, kind: "game", mode: "local-engine", ref: "g4", at: at("2026-10-01T05:00:00Z") },
		]);
		await env.db.insert(schema.chPuzzleAttempt).values([
			{
				id: "00000000-0000-4000-8000-0000000000a1",
				ownerId: "p2",
				puzzleId: "z1",
				won: true,
				ms: 9_000,
				rating: 1500,
				mode: "train",
				at: at("2026-11-08T12:00:00Z"),
			},
			{
				id: "00000000-0000-4000-8000-0000000000a2",
				ownerId: "p2",
				puzzleId: "z2",
				won: false,
				ms: 9_000,
				rating: 1500,
				mode: "train",
				at: at("2026-11-08T12:05:00Z"),
			},
		]);
		await env.db.insert(schema.chConnection).values(
			["p1", "p2"].map((userId, index) => ({
				userId,
				lichessId: userId,
				username: userId,
				token: "sealed",
				scopes: [],
				revokedAt: index === 1 ? at("2026-11-09T00:00:00Z") : null,
			})),
		);
	}

	it("rolls each UTC day up, fills a missed run in, and a second run replaces the day", async () => {
		await activity();
		expect(await rollupDaily(env.db, at("2026-11-09T23:00:00Z").getTime())).toBe(3);
		const days = await storedDays(env.db, "2026-10-01", "2026-11-11");
		expect(days.map((day) => day.day)).toEqual(["2026-10-01", "2026-11-08", "2026-11-09"]);
		expect(days[1]).toMatchObject({ players: 2, puzzles: 1, puzzlesSolved: 1, games: { ai: 1, "local-board": 1 } });
		expect(days[2]).toMatchObject({ players: 2, connects: 1, analyses: 1 });
		// The next run starts again from the last stored day.
		expect(await rollupDaily(env.db, at("2026-11-10T23:00:00Z").getTime())).toBe(2);
		const again = await storedDays(env.db, "2026-11-09", "2026-11-11");
		expect(again.map((day) => day.day)).toEqual(["2026-11-09", "2026-11-10"]);
	});

	it("the daily job rolls up before it prunes", async () => {
		await activity();
		const result = await runChaalCron(env.db, at("2027-01-05T02:45:00Z").getTime());
		expect(result.daysRolledUp).toBeGreaterThan(0);
		expect(result.activityPruned).toBeGreaterThan(0);
		expect((await storedDays(env.db, "2026-11-08", "2026-11-09"))[0]?.games.ai).toBe(1);
	});

	it("the overview: stored days, today live, distinct players, connections in use, the range's figures", async () => {
		await activity();
		await rollupDaily(env.db, at("2026-11-09T23:00:00Z").getTime());
		const week = await getOverview(env.db, "7d", at("2026-11-10T06:00:00Z").getTime());
		expect(week.today).toBe("2026-11-10");
		expect(week.connected).toBe(1);
		expect(week.players).toEqual({ week: 3, month: 3 });
		expect(week.totals).toEqual({ games: 3, puzzles: 1, puzzlesSolved: 1, analyses: 1, connects: 1 });
		expect(week.modes).toMatchObject({ ai: 1, seek: 1, "local-board": 1, "local-engine": 0 });
		expect(week.days).toHaveLength(30);
		expect(week.days.at(-1)).toMatchObject({ day: "2026-11-10", online: 1, local: 0 });
		const today = await getOverview(env.db, "today", at("2026-11-10T06:00:00Z").getTime());
		expect(today.totals.games).toBe(1);
	});
});
