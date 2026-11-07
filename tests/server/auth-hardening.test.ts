import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import { admin, emailOTP, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refuseEmailCodeWithTwoFactor, refuseOwnerOnlyWhileImpersonating } from "@/server/auth/hooks";
import { BREACHED_PASSWORD_PATHS, isOwnerOnlyPath, mustSetUpTwoFactor } from "@/server/auth/policy";

/**
 * The parts of src/server/auth/auth.ts that change what Better Auth allows, run
 * against a real Better Auth instance (in-memory database): the breached-password
 * paths, the email-code guard for accounts with two-factor on, and the account
 * endpoints an impersonated session can't use.
 */
const sha1Hex = async (value: string) => {
	const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
	return Buffer.from(digest).toString("hex").toUpperCase();
};

function createAuth() {
	const tables: Record<string, Array<Record<string, unknown>>> = {
		user: [],
		session: [],
		rateLimit: [],
		account: [],
		verification: [],
		twoFactor: [],
	};
	const codes = new Map<string, string>();
	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "test-secret-that-is-at-least-32-characters-long",
		database: memoryAdapter(tables),
		emailAndPassword: { enabled: true },
		rateLimit: { enabled: false },
		hooks: {
			before: createAuthMiddleware(refuseOwnerOnlyWhileImpersonating),
			after: createAuthMiddleware(refuseEmailCodeWithTwoFactor),
		},
		plugins: [
			admin({ defaultRole: "user", adminRoles: ["admin"] }),
			emailOTP({
				disableSignUp: true,
				sendVerificationOTP: async ({ email, otp }) => {
					codes.set(email, otp);
				},
			}),
			twoFactor(),
			haveIBeenPwned({ paths: [...BREACHED_PASSWORD_PATHS] }),
		],
	});
	return { auth, tables, codes };
}

/** Pretends to be the Have I Been Pwned range API, listing `breached` as found. */
const stubPwnedPasswords = async (breached: string) => {
	const hash = await sha1Hex(breached);
	return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const url = String(input instanceof Request ? input.url : input);
		const body = url.endsWith(hash.slice(0, 5)) ? `${hash.slice(5)}:42\r\n0000000000000000000000000000000000A:1` : "";
		return new Response(body, { status: 200 });
	});
};

const codeOf = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "resolved";
	} catch (error) {
		return (error as { body?: { code?: string } }).body?.code ?? "unknown";
	}
};

afterEach(() => vi.restoreAllMocks());

describe("breached passwords", () => {
	it("refuses a password from the breach corpus on sign-up, and allows others", async () => {
		const fetchSpy = await stubPwnedPasswords("password123");
		const { auth } = createAuth();
		expect(
			await codeOf(auth.api.signUpEmail({ body: { name: "A", email: "a@example.com", password: "password123" } })),
		).toBe("PASSWORD_COMPROMISED");
		expect(
			await codeOf(
				auth.api.signUpEmail({ body: { name: "A", email: "a@example.com", password: "a-long-unique-phrase-9" } }),
			),
		).toBe("resolved");
		// Only the first five characters of the hash leave the server.
		const urls = fetchSpy.mock.calls.map(([input]) => String(input));
		expect(urls.every((url) => /\/range\/[0-9A-F]{5}$/.test(url))).toBe(true);
	});
});

describe("email-code sign-in with two-factor on", () => {
	it("is refused and leaves no session; without two-factor it signs in", async () => {
		await stubPwnedPasswords("never-used");
		const { auth, tables, codes } = createAuth();
		for (const email of ["plain@example.com", "secure@example.com"]) {
			await auth.api.signUpEmail({ body: { name: "U", email, password: "a-long-unique-phrase-9" } });
		}
		for (const row of tables.user ?? []) {
			row.emailVerified = true;
			row.twoFactorEnabled = row.email === "secure@example.com";
		}

		const signInWithCode = async (email: string) => {
			await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
			return auth.api.signInEmailOTP({ body: { email, otp: codes.get(email) ?? "" } });
		};

		expect(await codeOf(signInWithCode("plain@example.com"))).toBe("resolved");
		const sessionsBefore = tables.session?.length ?? 0;
		expect(await codeOf(signInWithCode("secure@example.com"))).toBe("TWO_FACTOR_USE_PASSWORD");
		expect(tables.session?.length).toBe(sessionsBefore);
	});
});

describe("mustSetUpTwoFactor (AUTH_REQUIRE_ADMIN_2FA)", () => {
	it("applies only when required, to users with an admin permission and no second factor", () => {
		const admin = ["users:read"];
		expect(mustSetUpTwoFactor({ required: true, permissions: admin, twoFactorEnabled: false })).toBe(true);
		expect(mustSetUpTwoFactor({ required: true, permissions: admin, twoFactorEnabled: true })).toBe(false);
		expect(mustSetUpTwoFactor({ required: true, permissions: [], twoFactorEnabled: false })).toBe(false);
		expect(mustSetUpTwoFactor({ required: false, permissions: admin, twoFactorEnabled: false })).toBe(false);
	});
});

/** The `cookie` request header that sends back what a response set (the last value per name; cleared ones dropped). */
const cookiesFrom = (headers: Headers) => {
	const jar = new Map(
		headers.getSetCookie().map((cookie) => (cookie.split(";")[0] ?? "").split(/=(.*)/s) as [string, string]),
	);
	const sent = [...jar].filter(([, value]) => value !== "").map(([name, value]) => `${name}=${value}`);
	return new Headers({ cookie: sent.join("; ") });
};

describe("account changes from an impersonated session (decisions.md 0134)", () => {
	it("are refused; the owner's own session still makes them", async () => {
		await stubPwnedPasswords("never-used");
		const { auth, tables } = createAuth();
		const password = "a-long-unique-phrase-9";
		for (const email of ["admin@example.com", "user@example.com"]) {
			await auth.api.signUpEmail({ body: { name: "U", email, password } });
		}
		for (const row of tables.user ?? []) row.role = row.email === "admin@example.com" ? "admin" : "user";
		const signIn = async (email: string) =>
			cookiesFrom((await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })).headers);
		const target = tables.user?.find((row) => row.email === "user@example.com")?.id as string;

		const impersonated = cookiesFrom(
			(
				await auth.api.impersonateUser({
					body: { userId: target },
					headers: await signIn("admin@example.com"),
					returnHeaders: true,
				})
			).headers,
		);
		const changePassword = (headers: Headers) =>
			auth.api.changePassword({ body: { currentPassword: password, newPassword: "another-long-phrase-7" }, headers });
		expect(await codeOf(changePassword(impersonated))).toBe("IMPERSONATING");
		expect(await codeOf(auth.api.revokeOtherSessions({ headers: impersonated }))).toBe("IMPERSONATING");
		// Reading is fine.
		expect(await codeOf(auth.api.getSession({ headers: impersonated }))).toBe("resolved");
		expect(await codeOf(changePassword(await signIn("user@example.com")))).toBe("resolved");
	});

	it("covers the account endpoints, by exact path or prefix", () => {
		for (const path of ["/change-password", "/delete-user", "/delete-user/callback", "/two-factor/disable"]) {
			expect(isOwnerOnlyPath(path), path).toBe(true);
		}
		for (const path of ["/get-session", "/sign-out", "/change-passwords", "/list-sessions"]) {
			expect(isOwnerOnlyPath(path), path).toBe(false);
		}
	});
});
