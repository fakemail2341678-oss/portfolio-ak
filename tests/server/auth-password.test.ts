import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { AppError, FORM_ERROR_KEY } from "@/lib/errors";
import { setOwnPassword } from "@/server/auth/password";

const headers = new Headers();
const rejection = (run: () => Promise<unknown>) => run().catch((caught: unknown) => caught);

describe("setOwnPassword", () => {
	it("adds the password through Better Auth when it isn't breached", async () => {
		const setPassword = vi.fn(async () => ({ status: true }));
		await setOwnPassword({ setPassword }, headers, "a-long-unique-phrase-9", async () => false);
		expect(setPassword).toHaveBeenCalledWith({ body: { newPassword: "a-long-unique-phrase-9" }, headers });
	});

	it("refuses a breached password before calling Better Auth (its plugin can't see set-password)", async () => {
		const setPassword = vi.fn(async () => ({ status: true }));
		const error = await rejection(() => setOwnPassword({ setPassword }, headers, "password123", async () => true));
		expect(error).toBeInstanceOf(AppError);
		expect((error as AppError).fieldErrors?.[FORM_ERROR_KEY]?.[0]).toBe(
			"This password has appeared in a data breach. Choose a different one.",
		);
		expect(setPassword).not.toHaveBeenCalled();
	});

	it("skips the check when it's turned off, and explains an account that already has a password", async () => {
		const setPassword = vi.fn(async () => {
			throw APIError.from("BAD_REQUEST", { code: "PASSWORD_ALREADY_SET", message: "already set" });
		});
		const error = await rejection(() => setOwnPassword({ setPassword }, headers, "password123", null));
		expect(error).toMatchObject({ code: "CONFLICT" });
	});
});
