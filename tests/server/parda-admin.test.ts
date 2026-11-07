import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pardaReportList, pardaTakedownList } from "@/features/parda/admin/search";
import { AppError } from "@/lib/errors";
import * as schema from "@/server/db/schema";
import type { PardaAdminServices } from "@/server/parda/admin/context";
import * as reports from "@/server/parda/admin/reports";
import * as settings from "@/server/parda/admin/settings";
import * as sources from "@/server/parda/admin/sources";
import * as takedowns from "@/server/parda/admin/takedowns";
import { createPardaControls, titleKey } from "@/server/parda/controls";
import { embedOrigins, playerLanguage } from "@/server/parda/player/sources";
import { createTestDb } from "../utils/test-db";

/**
 * Task 65 on PGlite (PLAN 12.5, decision 0237): the sources (templates checked on their
 * fields, versions, state, order, deleting keeps plays), takedowns, the reports queue and
 * the settings, each write audited and clearing the controls' cache.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

const invalidate = vi.fn();
const admin = (): PardaAdminServices => ({
	db: env.db,
	actor: { id: "admin", isAdmin: true, permissions: [] },
	imageStore: null,
	controls: { invalidate },
});

const auditOf = (action: string) => env.db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, action));

const SOURCE = {
	name: { en: "Server X", ne: "" },
	movieTemplate: "/1/movie/{id}?start={start}",
	tvTemplate: "/1/tv/{id}/{season}/{episode}?start={start}",
	origins: [],
	adapter: "parda" as const,
	sandbox: "none" as const,
	adaptive: "probe" as const,
	quality: "probe" as const,
	needsClick: false,
	cdnGroup: "",
	autoFallback: true,
	enabled: true,
	pinned: false,
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
	env = await createTestDb("admin");
}, 120_000);
beforeEach(async () => {
	await env.reset();
	invalidate.mockClear();
	await env.db.insert(schema.pdSettings).values({ id: 1 });
	await env.db.insert(schema.pdSource).values(
		[1, 2].map((n) => ({
			name: { en: `Server ${n}`, ne: "" },
			movieTemplate: `/${n}/movie/{id}`,
			tvTemplate: `/${n}/tv/{id}/{season}/{episode}`,
			adapter: "parda" as const,
			position: n - 1,
		})),
	);
});
afterAll(async () => {
	await env?.close();
});

describe("sources", () => {
	it("adds a source last, audits it and clears the cache", async () => {
		const created = await sources.createSource(admin(), SOURCE);
		expect(created.position).toBe(2);
		expect(created.updatedAt).toBe("1");
		expect((await sources.listSources(admin())).map((row) => row.name.en)).toEqual([
			"Server 1",
			"Server 2",
			"Server X",
		]);
		expect(await auditOf("parda.source.create")).toHaveLength(1);
		expect(invalidate).toHaveBeenCalledTimes(1);
	});

	it("refuses templates and origins on their own fields", async () => {
		const errors = await fieldErrorsOf(
			sources.createSource(admin(), {
				...SOURCE,
				movieTemplate: "http://player.example.com/movie/{id}",
				tvTemplate: "https://player.example.com/tv/{id}/{nope}",
				origins: ["https://player.example.com/path"],
			}),
		);
		expect(Object.keys(errors).sort()).toEqual(["movieTemplate", "origins", "tvTemplate"]);
		const unlisted = await fieldErrorsOf(
			sources.createSource(admin(), { ...SOURCE, movieTemplate: "https://player.example.com/movie/{id}" }),
		);
		expect(Object.keys(unlisted)).toEqual(["movieTemplate"]);
		expect(await env.db.select().from(schema.pdSource)).toHaveLength(2);
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("saves an absolute template whose origin is listed", async () => {
		const created = await sources.createSource(admin(), {
			...SOURCE,
			movieTemplate: "https://player.example.com/movie/{id}",
			tvTemplate: "https://player.example.com/tv/{id}/{season}/{episode}",
			origins: ["https://player.example.com", "https://player.example.com"],
			cdnGroup: "c",
		});
		expect(created.origins).toEqual(["https://player.example.com"]);
		expect(created.cdnGroup).toBe("c");
	});

	it("edits from the version it started at, and a stale edit changes nothing", async () => {
		const [first] = await sources.listSources(admin());
		if (!first) throw new Error("no source");
		const saved = await sources.updateSource(admin(), {
			...SOURCE,
			name: { en: "Renamed", ne: "" },
			id: first.id,
			updatedAt: first.updatedAt,
		});
		expect(saved.updatedAt).toBe("2");
		const [audit] = await auditOf("parda.source.update");
		expect(audit?.before).toMatchObject({ name: "Server 1" });
		expect(audit?.after).toMatchObject({ name: "Renamed" });
		await expect(
			sources.updateSource(admin(), { ...SOURCE, id: first.id, updatedAt: first.updatedAt }),
		).rejects.toMatchObject({ code: "CONFLICT", reason: "stale" });
	});

	it("enables, disables and pins without moving the version, and the CSP follows", async () => {
		const controls = createPardaControls(env.db);
		const created = await sources.createSource(admin(), {
			...SOURCE,
			movieTemplate: "https://player.example.com/movie/{id}",
			tvTemplate: "https://player.example.com/tv/{id}/{season}/{episode}",
			origins: ["https://player.example.com"],
		});
		const framed = () => controls.sources().then((rows) => embedOrigins(rows, { includeDisabled: false }));
		expect(await framed()).toContain("https://player.example.com");
		const disabled = await sources.setSourceState({ ...admin(), controls }, { id: created.id, enabled: false });
		expect(disabled).toMatchObject({ enabled: false, updatedAt: created.updatedAt });
		expect(await framed()).not.toContain("https://player.example.com");
		await sources.setSourceState(admin(), { id: created.id, pinned: true });
		expect(await auditOf("parda.source.state")).toHaveLength(2);
		// Setting what it already is records nothing.
		await sources.setSourceState(admin(), { id: created.id, pinned: true });
		expect(await auditOf("parda.source.state")).toHaveLength(2);
	});

	it("reorders only when the order lists every source once", async () => {
		const rows = await sources.listSources(admin());
		const ids = rows.map((row) => row.id).reverse();
		await expect(sources.reorderSources(admin(), ids.slice(0, 1))).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(sources.reorderSources(admin(), [ids[0] ?? "", ids[0] ?? ""])).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(await sources.reorderSources(admin(), ids)).toEqual({ moved: 2 });
		expect((await sources.listSources(admin())).map((row) => row.name.en)).toEqual(["Server 2", "Server 1"]);
		expect(await auditOf("parda.source.reorder")).toHaveLength(1);
	});

	it("deleting a source keeps its plays and reports, with no source", async () => {
		const [first] = await sources.listSources(admin());
		if (!first) throw new Error("no source");
		const playId = crypto.randomUUID();
		await env.db
			.insert(schema.pdPlay)
			.values({ id: playId, viewerKind: "anonymous", sourceId: first.id, media: "movie", tmdbId: 550 });
		await env.db.insert(schema.pdReport).values({ kind: "ads", media: "movie", tmdbId: 550, sourceId: first.id });
		expect((await sources.listSources(admin()))[0]).toMatchObject({ openReports: 1, adsReports: 1 });
		expect(await sources.deleteSources(admin(), [first.id])).toEqual({ deleted: 1 });
		const [play] = await env.db.select().from(schema.pdPlay).where(eq(schema.pdPlay.id, playId));
		expect(play?.sourceId).toBeNull();
		const [report] = await env.db.select().from(schema.pdReport);
		expect(report?.sourceId).toBeNull();
		expect(await auditOf("parda.source.delete")).toHaveLength(1);
	});
});

describe("takedowns", () => {
	const input = (q = "") => pardaTakedownList.input.parse({ ...pardaTakedownList.defaults, q, pageSize: 20 });

	it("blocks a title once, named from the snapshot, and the controls see it", async () => {
		await env.db
			.insert(schema.pdTitle)
			.values({ media: "movie", tmdbId: 550, title: { en: "Fight Club", ne: "फाइट क्लब" } });
		const blocked = await takedowns.blockTitle(admin(), { media: "movie", tmdbId: 550, reason: "A request" });
		expect(blocked).toMatchObject({ title: { en: "Fight Club" }, blockedBy: "Admin" });
		expect((await createPardaControls(env.db).blocked()).has(titleKey("movie", 550))).toBe(true);
		const errors = await fieldErrorsOf(takedowns.blockTitle(admin(), { media: "movie", tmdbId: 550, reason: "Again" }));
		expect(Object.keys(errors)).toEqual(["tmdbId"]);
		// The same id as a series is another title.
		await takedowns.blockTitle(admin(), { media: "tv", tmdbId: 550, reason: "Another" });
		expect(await auditOf("parda.title.block")).toHaveLength(2);
	});

	it("finds takedowns by title, reason or id, and unblocking brings the title back", async () => {
		await env.db.insert(schema.pdTitle).values({ media: "tv", tmdbId: 1399, title: { en: "Game of Thrones", ne: "" } });
		const one = await takedowns.blockTitle(admin(), { media: "tv", tmdbId: 1399, reason: "Rights holder" });
		await takedowns.blockTitle(admin(), { media: "movie", tmdbId: 27205, reason: "Mistake" });
		expect((await takedowns.listTakedowns(admin(), input("thrones"))).items.map((row) => row.id)).toEqual([one.id]);
		expect((await takedowns.listTakedowns(admin(), input("rights"))).items).toHaveLength(1);
		expect((await takedowns.listTakedowns(admin(), input("27205"))).items).toHaveLength(1);
		expect((await takedowns.listTakedowns(admin(), input())).total).toBe(2);
		expect(await takedowns.unblockTitles(admin(), [one.id])).toEqual({ deleted: 1 });
		expect((await createPardaControls(env.db).blocked()).has(titleKey("tv", 1399))).toBe(false);
		expect(await auditOf("parda.title.unblock")).toHaveLength(1);
	});
});

describe("reports", () => {
	const input = (filters: Record<string, string> = {}) =>
		pardaReportList.input.parse({ ...pardaReportList.defaults, ...filters, pageSize: 20 });

	it("filters by status, kind and source, and resolves in bulk once", async () => {
		const [first] = await env.db.select().from(schema.pdSource).limit(1);
		const rows = await env.db
			.insert(schema.pdReport)
			.values([
				{ kind: "ads" as const, media: "movie" as const, tmdbId: 550, sourceId: first?.id ?? null, note: "pop-ups" },
				{ kind: "not-playing" as const, media: "tv" as const, tmdbId: 1399, season: 1, episode: 2 },
				{ kind: "quality" as const, media: "movie" as const, tmdbId: 550, status: "dismissed" as const },
			])
			.returning();
		expect((await reports.listReports(admin(), input())).total).toBe(2);
		expect((await reports.listReports(admin(), input({ status: "all" }))).total).toBe(3);
		expect((await reports.listReports(admin(), input({ kind: "ads" }))).items[0]?.source?.name.en).toBe("Server 1");
		expect((await reports.listReports(admin(), input({ source: first?.id ?? "" }))).total).toBe(1);
		expect((await reports.listReports(admin(), input({ q: "pop" }))).total).toBe(1);

		const ids = rows.map((row) => row.id);
		expect(await reports.setReportStatus(admin(), { ids, status: "resolved" })).toEqual({ changed: 3 });
		expect(await reports.setReportStatus(admin(), { ids, status: "resolved" })).toEqual({ changed: 0 });
		const resolved = await reports.listReports(admin(), input({ status: "resolved" }));
		expect(resolved.items.every((row) => row.resolvedBy === "Admin" && row.resolvedAt)).toBe(true);
		expect(await auditOf("parda.report.status")).toHaveLength(3);

		await reports.setReportStatus(admin(), { ids: [ids[0] ?? ""], status: "open" });
		const [reopened] = await env.db
			.select()
			.from(schema.pdReport)
			.where(eq(schema.pdReport.id, ids[0] ?? ""));
		expect(reopened).toMatchObject({ status: "open", resolvedBy: null, resolvedAt: null });
	});
});

describe("settings", () => {
	it("saves from its version, keeps the languages in order and an empty banner as none", async () => {
		const before = await settings.getSettings(admin());
		const saved = await settings.updateSettings(admin(), {
			region: "IN",
			languages: ["ne", "en"],
			kidsCap: "G",
			banner: { en: "", ne: "" },
			updatedAt: before.updatedAt,
		});
		expect(saved).toMatchObject({ region: "IN", languages: ["en", "ne"], kidsCap: "G", updatedAt: "2" });
		const [row] = await env.db.select().from(schema.pdSettings);
		expect(row?.banner).toBeNull();
		expect(await auditOf("parda.settings.update")).toHaveLength(1);
		await expect(
			settings.updateSettings(admin(), {
				region: "IN",
				languages: ["en"],
				kidsCap: "G",
				banner: { en: "Hi", ne: "" },
				updatedAt: before.updatedAt,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("the kill switch and the purge don't make an open form stale", async () => {
		const before = await settings.getSettings(admin());
		const off = await settings.setPlayback(admin(), { enabled: false });
		expect(off).toMatchObject({ playbackEnabled: false, updatedAt: before.updatedAt });
		await settings.setPlayback(admin(), { enabled: false });
		expect(await auditOf("parda.playback")).toHaveLength(1);
		const purged = await settings.purgeCache(admin());
		expect(purged.cacheEpoch).toBe(before.cacheEpoch + 1);
		expect(await auditOf("parda.cache.purge")).toHaveLength(1);
		await settings.updateSettings(admin(), {
			region: "US",
			languages: ["en"],
			kidsCap: "PG",
			banner: { en: "Maintenance tonight", ne: "" },
			updatedAt: before.updatedAt,
		});
		expect(invalidate).toHaveBeenCalledTimes(4);
	});

	it("asks players for the page's language when it's listed, else the first", () => {
		expect(playerLanguage("ne", ["en", "ne"])).toBe("ne");
		expect(playerLanguage("ne", ["en"])).toBe("en");
		expect(playerLanguage("en", undefined)).toBe("en");
		expect(playerLanguage("en", [])).toBe("en");
	});
});
