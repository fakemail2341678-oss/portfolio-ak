import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChaalSettingsInput } from "@/features/chaal/admin/schema";
import { chaalBlockList, chaalConnectionList } from "@/features/chaal/admin/search";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import * as blocks from "@/server/chaal/admin/blocks";
import * as connections from "@/server/chaal/admin/connections";
import type { ChaalAdminServices } from "@/server/chaal/admin/context";
import * as health from "@/server/chaal/admin/health";
import * as settings from "@/server/chaal/admin/settings";
import * as connect from "@/server/chaal/connect/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import { type ChaalPublic, chaalUserOf } from "@/server/chaal/context";
import { createChaalControls } from "@/server/chaal/controls";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import { createCounters } from "@/server/chaal/lichess/counters";
import { createCallsFlush, pruneCallStats, writeCalls } from "@/server/chaal/stats";
import { chaalStatus } from "@/server/chaal/status";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Task 79 on PGlite (decision 0268): the settings (versioned, audited, only the switches that
 * are off stored), maintenance (no token is used, nobody connects), the purge; connections
 * (filters, revoking at Lichess and here); blocks (by username or email, revoking the
 * connection they name, refused twice); the call counters' flush, the health page's figures
 * and "Test Lichess".
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
const invalidate = vi.fn();

const lichess = () =>
	createLichess(
		{
			apiBase: "https://lichess.test",
			explorerBase: "https://e.test",
			tablebaseBase: "https://t.test",
			userAgent: "t",
		},
		fetcher,
	);

const deps = (): connect.ConnectDeps => ({
	db: env.db,
	lichess: lichess(),
	vault,
	controls: createChaalControls(env.db, () => 0),
});

const admin = (): ChaalAdminServices => ({
	db: env.db,
	actor: { id: "admin-1", isAdmin: true, permissions: [] },
	imageStore: null,
	controls: { invalidate },
	connect: async () => deps(),
	connectConfigured: true,
});

const auditOf = (action: string) => env.db.select().from(schema.auditEvent).where(eq(schema.auditEvent.action, action));

const PLAY = ["board:play", "challenge:read", "challenge:write"];

async function connected(
	userId: string,
	lichessId: string,
	extra: Partial<typeof schema.chConnection.$inferInsert> = {},
) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId,
		username: lichessId,
		token: await vault.seal(`lio_${lichessId}`, "token"),
		scopes: PLAY,
		...extra,
	});
}

const session = (id: string): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
});

async function formOf(): Promise<ChaalSettingsInput> {
	const current = await settings.getSettings(admin());
	return {
		features: current.features,
		guestsMayConnect: current.guestsMayConnect,
		extraScopes: [],
		play: current.play,
		defaults: current.defaults,
		engine: current.engine,
		banner: current.banner,
		maintenanceMessage: current.maintenanceMessage,
		updatedAt: current.updatedAt,
	};
}

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(
			["member", "other", "guest"].map((id) => ({
				id,
				name: `Name ${id}`,
				email: `${id}@example.com`,
				isAnonymous: id === "guest",
			})),
		);
	});
	vault = await createVault(Buffer.alloc(32, 7).toString("base64"));
}, 120_000);
beforeEach(async () => {
	await env.reset();
	fetcher.mockClear();
	invalidate.mockClear();
});
afterAll(async () => {
	await env?.close();
});

describe("settings", () => {
	it("starts from the defaults, saves the form from its version, stores only the switches that are off, and audits", async () => {
		const first = await settings.getSettings(admin());
		expect(first.features.play).toBe(true);
		expect(first.play).toEqual({ aiMaxLevel: 8, rated: true, quickPair: "all" });
		expect(first.defaults).toEqual({ board: "diagram", pieces: "cburnett", sounds: true });

		const form = await formOf();
		const saved = await settings.updateSettings(admin(), {
			...form,
			features: { ...form.features, play: false, studies: false },
			play: { aiMaxLevel: 4, rated: false, quickPair: "days" },
			defaults: { board: "stone", pieces: "cburnett", sounds: false },
			engine: { maxDepth: 16, multiPv: 2, hashMb: 8 },
			banner: { en: "Hello", ne: "" },
		});
		expect(saved.features.play).toBe(false);
		expect(saved.updatedAt).toBe(String(Number(form.updatedAt) + 1));
		const [row] = await env.db.select().from(schema.chSettings);
		expect(row?.features).toEqual({ play: false, studies: false });
		expect(row?.banner).toEqual({ en: "Hello", ne: "" });
		expect(row?.maintenanceMessage).toBeNull();
		const [audit] = await auditOf("chaal.settings.update");
		expect(audit?.after).toMatchObject({ featuresOff: ["play", "studies"], aiMaxLevel: 4, quickPair: "days" });
		expect(invalidate).toHaveBeenCalledTimes(1);

		// The status every page reads follows.
		const status = chaalStatus(
			{ settings: row, connectConfigured: true, appToken: null } as unknown as ChaalPublic,
			null,
		);
		expect(status.features.play).toBe(false);
		expect(status.defaults.board).toBe("stone");
		expect(status.play.quickPair).toBe("days");
	});

	it("refuses a form opened at an older version", async () => {
		const form = await formOf();
		await settings.updateSettings(admin(), form);
		await expect(settings.updateSettings(admin(), form)).rejects.toMatchObject({
			code: "CONFLICT",
			reason: "stale",
		});
	});

	it("maintenance: nothing uses a token, nobody connects, play and chat read as off, and it is audited once", async () => {
		await connected("member", "member_li");
		const on = await settings.setMaintenance(admin(), { on: true });
		expect(on.maintenance).toBe(true);
		await settings.setMaintenance(admin(), { on: true });
		expect(await auditOf("chaal.maintenance")).toHaveLength(1);

		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(await connect.connectRefusal(deps(), { id: "member", isGuest: false })).toBe("off");
		const [row] = await env.db.select().from(schema.chSettings);
		const status = chaalStatus(
			{
				settings: row,
				connectConfigured: true,
				appToken: null,
				lichess: lichess(),
				cache: createChaalCache(),
			} as unknown as ChaalPublic,
			session("member"),
		);
		expect(status.connect).toBe("off");
		expect(status.features.play).toBe(false);
		expect(status.features.chat).toBe(false);
		expect(status.features.analysis).toBe(true);
		expect(status.maintenance).toEqual({ message: null });

		await settings.setMaintenance(admin(), { on: false });
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).resolves.toBe("used");
	});

	it("purging bumps the cache epoch", async () => {
		const before = await settings.getSettings(admin());
		const after = await settings.purgeCache(admin());
		expect(after.cacheEpoch).toBe(before.cacheEpoch + 1);
		expect(await auditOf("chaal.cache.purge")).toHaveLength(1);
	});
});

describe("connections", () => {
	const list = (overrides: Partial<typeof chaalConnectionList.defaults> = {}) =>
		connections.listConnections(admin(), { ...chaalConnectionList.defaults, ...overrides, pageSize: 25 }, Date.now());

	it("lists every connection with its user and state, never a token, and filters them", async () => {
		await connected("member", "member_li");
		await connected("guest", "guest_li", { revokedAt: new Date() });
		await connected("other", "other_li", { expiresAt: new Date(Date.now() - 1000) });

		const all = await list();
		expect(all.total).toBe(3);
		expect(JSON.stringify(all)).not.toContain("lio_");
		expect(JSON.stringify(all)).not.toMatch(/v1\./);
		const guest = all.items.find((row) => row.id === "guest");
		expect(guest).toMatchObject({ guest: true, userEmail: null, state: "revoked" });

		expect((await list({ state: "active" })).items.map((row) => row.id)).toEqual(["member"]);
		expect((await list({ state: "expired" })).items.map((row) => row.id)).toEqual(["other"]);
		expect((await list({ who: "guests" })).items.map((row) => row.id)).toEqual(["guest"]);
		expect((await list({ q: "Name memb" })).items.map((row) => row.id)).toEqual(["member"]);
	});

	it("revoking ends the token at Lichess, marks the connection revoked (the player sees Reconnect), and audits", async () => {
		await connected("member", "member_li");
		const result = await connections.revokeConnections(admin(), ["member", "other"]);
		expect(result).toEqual({ revoked: 1 });
		const [call] = fetcher.mock.calls;
		expect(String(call?.[0])).toBe("https://lichess.test/api/token");
		expect(call?.[1]?.method).toBe("DELETE");
		expect((await connect.connectionView(deps(), "member"))?.revoked).toBe(true);
		expect(await auditOf("chaal.connection.revoke")).toHaveLength(1);
		// Revoked already: nothing more.
		expect(await connections.revokeConnections(admin(), ["member"])).toEqual({ revoked: 0 });
	});
});

describe("blocks", () => {
	const list = () => blocks.listBlocks(admin(), { ...chaalBlockList.defaults, pageSize: 25 });

	it("blocking a Lichess account revokes its connection, and connecting it is refused", async () => {
		await connected("member", "member_li");
		const block = await blocks.createBlock(admin(), { kind: "lichess", target: "Member_Li", reason: "abuse" });
		expect(block).toMatchObject({ kind: "lichess", target: "member_li", blockedBy: "Admin" });
		expect((await connect.connectionView(deps(), "member"))?.revoked).toBe(true);
		expect(invalidate).toHaveBeenCalled();
		const controls = createChaalControls(env.db, () => 0);
		expect((await controls.blocks()).lichess.has("member_li")).toBe(true);
		expect(await auditOf("chaal.block.create")).toHaveLength(1);

		const again = await blocks
			.createBlock(admin(), { kind: "lichess", target: "member_li", reason: "again" })
			.catch((error: unknown) => error);
		expect(again).toBeInstanceOf(AppError);
		expect((again as AppError).fieldErrors?.target).toHaveLength(1);
	});

	it("blocking a site user by email refuses their calls; an unknown email is a field error; unblocking lets them back", async () => {
		const block = await blocks.createBlock(admin(), { kind: "user", target: "Other@Example.com", reason: "spam" });
		expect(block).toMatchObject({ kind: "user", target: "Name other", email: "other@example.com" });
		const controls = createChaalControls(env.db, () => 0);
		const blocked = await controls.blocks();
		expect(() => chaalUserOf(session("other"), blocked)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
		expect(await connect.connectRefusal({ ...deps(), controls }, { id: "other", isGuest: false })).toBe("blocked");

		const unknown = await blocks
			.createBlock(admin(), { kind: "user", target: "nobody@example.com", reason: "x" })
			.catch((error: unknown) => error);
		expect((unknown as AppError).fieldErrors?.target).toHaveLength(1);

		expect((await list()).total).toBe(1);
		expect(await blocks.deleteBlocks(admin(), [block.id])).toEqual({ deleted: 1 });
		expect((await list()).total).toBe(0);
		expect(await auditOf("chaal.block.delete")).toHaveLength(1);
	});
});

describe("call stats and health", () => {
	const HOUR = 3_600_000;
	const now = Date.UTC(2026, 10, 9, 12, 30);

	it("counts calls by hour and endpoint, keeps the failures, and the health page adds them up", async () => {
		const counters = createCounters({ now: () => now });
		counters.record("puzzle-daily", { status: 200, ms: 100, lane: "public", at: now - HOUR });
		counters.record("puzzle-daily", { status: 200, ms: 300, lane: "public", at: now });
		counters.record("account", { status: 429, ms: 50, lane: "user", at: now });
		counters.record("account", { status: 0, ms: 8000, lane: "user", at: now });
		await writeCalls(env.db, counters.drain());
		// A second batch adds to the same hour.
		counters.record("puzzle-daily", { status: 500, ms: 200, lane: "public", at: now });
		await writeCalls(env.db, counters.drain());
		expect(counters.drain().hours.size).toBe(0);

		await env.db.insert(schema.chSettings).values({ id: 1, publicCooldownUntil: new Date(now + 60_000) });
		await connected("member", "member_li", { cooldownUntil: new Date(now + 120_000) });

		const state = await health.healthState(env.db, "24h", now);
		expect(state.hours).toHaveLength(24);
		expect(state.hours.at(-1)).toMatchObject({ calls: 4, errors: 3, rateLimited: 1 });
		expect(state.hours.at(-2)).toMatchObject({ calls: 1, errors: 0 });
		expect(state.totals).toMatchObject({ calls: 5, errors: 3, rateLimited: 1 });
		expect(state.endpoints.map((row) => row.endpoint)).toEqual(["puzzle-daily", "account"]);
		expect(state.endpoints[0]?.avgMs).toBe(200);
		expect(state.errors.map((row) => row.status)).toEqual(expect.arrayContaining([429, 0, 500]));
		expect(state.errors.every((row) => !("token" in row))).toBe(true);
		expect(state.cooldowns.public).not.toBeNull();
		expect(state.cooldowns.connections).toEqual([{ username: "member_li", until: expect.any(String) }]);

		// The daily job forgets hours older than 30 days.
		expect(await pruneCallStats(env.db, now + 31 * 24 * HOUR)).toBe(3);
	});

	it("keeps only the last 500 failures", async () => {
		const counters = createCounters();
		for (let index = 0; index < 505; index += 1) {
			counters.record("account", { status: 502, ms: 1, at: Date.UTC(2026, 10, 9) + index });
		}
		await writeCalls(env.db, counters.drain());
		expect(await env.db.$count(schema.chApiError)).toBe(500);
	});

	it("one flush runs at a time; calls made meanwhile go in the next", async () => {
		let counters = createCounters();
		const kept: Promise<unknown>[] = [];
		const flush = createCallsFlush(
			env.db,
			() => counters,
			(promise) => kept.push(promise),
		);
		counters = createCounters({ onRecord: flush.schedule });
		counters.record("account", { status: 200, ms: 10 });
		counters.record("account", { status: 200, ms: 10 });
		counters.record("account", { status: 200, ms: 10 });
		expect(kept).toHaveLength(1);
		await flush.settled();
		const [row] = await env.db.select().from(schema.chApiStat);
		expect(row?.calls).toBe(3);
	});

	it("Test Lichess answers with the time, or says Lichess asked to wait", async () => {
		const daily = readFileSync("tests/fixtures/lichess/api_puzzle_daily.json", "utf8");
		const ok = createLichess(
			{ apiBase: "https://l.test", explorerBase: "", tablebaseBase: "", userAgent: "t" },
			async () => new Response(daily, { headers: { "content-type": "application/json" } }),
		);
		expect(await health.pingLichess(ok)).toMatchObject({ ok: true, status: 200 });

		const limited = createLichess(
			{ apiBase: "https://l.test", explorerBase: "", tablebaseBase: "", userAgent: "t" },
			async () => new Response(null, { status: 429 }),
		);
		expect(await health.pingLichess(limited)).toMatchObject({ ok: false, reason: "wait" });
		expect(await health.pingLichess(limited)).toMatchObject({ ok: false, reason: "wait" });
	});
});
