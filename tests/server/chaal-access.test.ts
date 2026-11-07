import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import * as connect from "@/server/chaal/connect/service";
import { createVault, type Vault } from "@/server/chaal/connect/vault";
import { type ChaalPublic, chaalUserOf } from "@/server/chaal/context";
import { createChaalControls } from "@/server/chaal/controls";
import { createChaalCache } from "@/server/chaal/lichess/cache";
import { createLichess } from "@/server/chaal/lichess/client";
import { chaalStatus } from "@/server/chaal/status";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/**
 * Chaal's access matrix (PLAN 13.5, "Guard test"; decision 0254): who may call each
 * function, and on whose data. The functions' middleware (withChaalPublic;
 * requireChaalUser then withChaalServices) is checked by
 * tests/server/guarded-functions.test.ts; here are the rules behind it: no session, a
 * guest, a member, a blocked user, a feature that's off, a missing scope, a revoked token,
 * and another user's connection. Games and analyses join with their tasks.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let vault: Vault;
const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

const deps = (): connect.ConnectDeps => ({
	db: env.db,
	lichess: createLichess(
		{
			apiBase: "https://lichess.test",
			explorerBase: "https://e.test",
			tablebaseBase: "https://t.test",
			userAgent: "t",
		},
		fetcher,
	),
	vault,
	controls: createChaalControls(env.db, () => 0),
});

const session = (id: string, guest = false): Session => ({
	user: { id, email: `${id}@example.com`, name: id, role: "user", twoFactorEnabled: false },
	permissions: [],
	...(guest ? { isAnonymous: true as const } : {}),
});

/** A saved connection, as the callback leaves it (the flow itself: tests/server/chaal-connect.test.ts). */
async function connected(userId: string, lichessId: string, scopes: string[], revokedAt: Date | null = null) {
	await env.db.insert(schema.chConnection).values({
		userId,
		lichessId,
		username: lichessId,
		token: await vault.seal(`lio_${lichessId}`, "token"),
		scopes,
		revokedAt,
	});
}

const PLAY = ["board:play", "challenge:read", "challenge:write"];

/** Every personal function's service call (src/functions/chaal/connection.ts). */
const OPERATIONS: Record<string, (userId: string) => Promise<unknown>> = {
	getChaalConnection: (userId) => connect.connectionView(deps(), userId),
	disconnectChaal: (userId) => connect.disconnect(deps(), userId),
};

beforeAll(async () => {
	env = await createTestDb("admin-1", async (db) => {
		await db.insert(schema.user).values(
			["member", "other", "guest", "blocked"].map((id) => ({
				id,
				name: id,
				email: `${id}@example.com`,
				isAnonymous: id === "guest",
			})),
		);
	});
	vault = await createVault(Buffer.alloc(32, 5).toString("base64"));
});
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	fetcher.mockClear();
});

describe("Chaal's access matrix", () => {
	it("personal functions need a session (guests included) and refuse a blocked user", async () => {
		const controls = createChaalControls(env.db, () => 0);
		await env.db.insert(schema.chBlock).values({ userId: "blocked", reason: "test" });
		const blocks = await controls.blocks();
		expect(() => chaalUserOf(null, blocks)).toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
		expect(chaalUserOf(session("guest", true), blocks)).toEqual({ id: "guest", isGuest: true });
		expect(chaalUserOf(session("member"), blocks)).toEqual({ id: "member", isGuest: false });
		expect(() => chaalUserOf(session("blocked"), blocks)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it.each(Object.keys(OPERATIONS))("%s acts on the caller's own connection only", async (name) => {
		const operation = OPERATIONS[name];
		if (!operation) throw new Error(name);
		await connected("member", "member_lichess", PLAY);
		await operation("other");
		// The member's connection is untouched, and "other" saw none.
		expect((await connect.connectionView(deps(), "member"))?.lichessId).toBe("member_lichess");
		expect(await connect.connectionView(deps(), "other")).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("a guest's connection works like a member's", async () => {
		await connected("guest", "guest_lichess", PLAY);
		expect((await connect.connectionView(deps(), "guest"))?.username).toBe("guest_lichess");
		await expect(connect.withToken(deps(), "guest", "play", async (token) => token)).resolves.toBe("lio_guest_lichess");
		await connect.disconnect(deps(), "guest");
		expect(await connect.connectionView(deps(), "guest")).toBeNull();
	});

	it("a feature that is off refuses its calls, and its status says so", async () => {
		await connected("member", "member_lichess", PLAY);
		await env.db.insert(schema.chSettings).values({ id: 1, features: { play: false } });
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			code: "FORBIDDEN",
			reason: undefined,
		});
		const settings = await createChaalControls(env.db, () => 0).settings();
		const chaal = {
			lichess: deps().lichess,
			cache: createChaalCache(),
			controls: createChaalControls(env.db),
			settings,
			appToken: null,
			connectConfigured: true,
		} satisfies ChaalPublic;
		expect(chaalStatus(chaal, null).features.play).toBe(false);
		expect(chaalStatus(chaal, null).features.puzzles).toBe(true);
	});

	it("a connection without a feature's scopes is refused with reconnect, and its view names the feature", async () => {
		await connected("member", "member_lichess", ["puzzle:read", "puzzle:write"]);
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await expect(connect.withToken(deps(), "member", "puzzles", async () => "used")).resolves.toBe("used");
		expect((await connect.connectionView(deps(), "member"))?.needsScopesFor).toContain("play");
	});

	it("a revoked token, or one past its end, is refused with reconnect before Lichess is called", async () => {
		await connected("member", "member_lichess", PLAY, new Date(0));
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await env.db.update(schema.chConnection).set({ revokedAt: null, expiresAt: new Date(0) });
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("without a connection, a personal call says connect; the public status says whether a guest may", async () => {
		await expect(connect.withToken(deps(), "member", "play", async () => "used")).rejects.toMatchObject({
			reason: "lichess-reconnect",
		});
		await env.db.insert(schema.chSettings).values({ id: 1, guestsMayConnect: false });
		const chaal: ChaalPublic = {
			lichess: deps().lichess,
			cache: createChaalCache(),
			controls: createChaalControls(env.db),
			settings: await createChaalControls(env.db).settings(),
			appToken: null,
			connectConfigured: true,
		};
		expect(chaalStatus(chaal, session("guest", true)).connect).toBe("off");
		expect(chaalStatus(chaal, session("member")).connect).toBe("on");
		expect(chaalStatus({ ...chaal, connectConfigured: false }, session("member")).connect).toBe("off");
	});
});
