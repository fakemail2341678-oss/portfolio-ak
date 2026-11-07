import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { revokeOwnSession, type SessionApi } from "@/server/auth/sessions";

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
