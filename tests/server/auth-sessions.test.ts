import { afterAll, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { liveSessions, revokeOwnSession, type SessionApi } from "@/server/auth/sessions";
import { session } from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

const fakeApi = () => {
	const revokeSession = vi.fn(async () => ({ status: true }));
	const api: SessionApi = {
		listSessions: async () => [
			{ id: "current", token: "tok-current" },
			{ id: "phone", token: "tok-phone" },
		],
		getSession: async () => ({ session: { id: "current" } }),
		revokeSession,
	};
	return { api, revokeSession };
};

const codeOf = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "resolved";
	} catch (error) {
		return error instanceof AppError ? error.code : "other";
	}
};

describe("revokeOwnSession", () => {
	const headers = new Headers();

	it("revokes another of the caller's sessions, looking the token up on the server", async () => {
		const { api, revokeSession } = fakeApi();
		await revokeOwnSession(api, headers, "phone");
		expect(revokeSession).toHaveBeenCalledWith({ body: { token: "tok-phone" }, headers });
	});

	it("refuses ids that aren't the caller's (NOT_FOUND) and the current session (BAD_REQUEST)", async () => {
		const { api, revokeSession } = fakeApi();
		expect(await codeOf(revokeOwnSession(api, headers, "someone-else"))).toBe("NOT_FOUND");
		expect(await codeOf(revokeOwnSession(api, headers, "current"))).toBe("BAD_REQUEST");
		expect(revokeSession).not.toHaveBeenCalled();
	});
});

describe("liveSessions", () => {
	const env = createTestDb();
	afterAll(async () => (await env).close());

	it("lists a user's sessions however long ago they signed in, and none that has ended or is another's", async () => {
		const { db, adminId } = await env;
		const now = new Date("2026-11-17T12:00:00Z");
		const day = 24 * 60 * 60 * 1000;
		const row = (id: string, userId: string, createdDaysAgo: number, endsInDays: number) => ({
			id,
			token: `tok-${id}`,
			userId,
			createdAt: new Date(now.getTime() - createdDaysAgo * day),
			updatedAt: now,
			expiresAt: new Date(now.getTime() + endsInDays * day),
			userAgent: "Firefox",
		});
		await db.insert(session).values([
			// Signed in five days ago: Better Auth's /list-sessions refuses it (freshAge is a day).
			row("old", adminId, 5, 2),
			row("new", adminId, 0, 7),
			row("ended", adminId, 9, -1),
		]);
		const listed = await liveSessions(db, adminId, now);
		expect(listed.map((entry) => entry.id).sort()).toEqual(["new", "old"]);
		expect(await liveSessions(db, "someone-else", now)).toEqual([]);
	});
});
