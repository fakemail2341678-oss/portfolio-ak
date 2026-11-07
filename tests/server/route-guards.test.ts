import { isRedirect } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { overwriteGetLocale } from "@/paraglide/runtime";

/**
 * The layout routes' beforeLoad guards. The admin role check itself is a server
 * function (ensureAdminAccess -> requireAdminAccessMiddleware, tested in auth-middleware.test.ts);
 * here it's mocked to return or throw what the server would.
 */
const ensureAdminAccess = vi.hoisted(() => vi.fn<() => Promise<Session>>());
vi.mock("@/functions/auth", () => ({ ensureAdminAccess }));
const setErrorStatus = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/start/http-status", () => ({ setErrorStatus }));

const { Route: authedRoute } = await import("@/routes/_authed");
const { Route: authRoute } = await import("@/routes/_auth");
const { Route: adminRoute } = await import("@/routes/_admin");

type BeforeLoad = (ctx: Record<string, unknown>) => unknown;
const beforeLoad = (route: { options: unknown }) => (route.options as { beforeLoad: BeforeLoad }).beforeLoad;

const session = (role: "user" | "admin"): Session => ({
	user: { id: "u1", email: "a@example.com", name: "A", role, twoFactorEnabled: false },
	permissions: role === "admin" ? ["test-crud:read", "users:read", "roles:read"] : [],
});
const location = { href: "/account?tab=sessions" };

/** Runs a guard and returns what it threw (or undefined). */
const thrown = async (run: () => unknown) => {
	try {
		await run();
		return undefined;
	} catch (error) {
		return error;
	}
};

afterEach(() => {
	overwriteGetLocale(() => "en");
	ensureAdminAccess.mockReset();
	setErrorStatus.mockClear();
});

describe("_authed (signed-in pages)", () => {
	it("sends anonymous visitors to /login with a return URL", async () => {
		const error = await thrown(() => beforeLoad(authedRoute)({ context: { session: null }, location }));
		expect(isRedirect(error)).toBe(true);
		expect((error as { options: unknown }).options).toMatchObject({
			to: "/login",
			search: { redirect: "/account?tab=sessions" },
		});
	});

	it("lets signed-in users through and narrows the session for child routes", async () => {
		const user = session("user");
		expect(await beforeLoad(authedRoute)({ context: { session: user }, location })).toEqual({ session: user });
	});
});

describe("_auth (login, register, ...)", () => {
	it("sends signed-in users on to their validated redirect target, localized", async () => {
		overwriteGetLocale(() => "ne");
		const error = await thrown(() =>
			beforeLoad(authRoute)({ context: { session: session("user") }, search: { redirect: "/admin/test-crud" } }),
		);
		expect(isRedirect(error)).toBe(true);
		expect((error as { options: { href: string } }).options.href).toBe("/ne/admin/test-crud");
	});

	it("defaults to the account page and leaves anonymous visitors alone", async () => {
		const error = await thrown(() => beforeLoad(authRoute)({ context: { session: session("user") }, search: {} }));
		expect((error as { options: { href: string } }).options.href).toBe("/account");
		expect(await thrown(() => beforeLoad(authRoute)({ context: { session: null }, search: {} }))).toBeUndefined();
	});
});

describe("_admin (admin area)", () => {
	it("navigations inside the area reuse the loaded session when it has admin permissions (no round trip)", async () => {
		const admin = session("admin");
		expect(await beforeLoad(adminRoute)({ location, cause: "stay", context: { session: admin } })).toEqual({
			session: admin,
		});
		expect(ensureAdminAccess).not.toHaveBeenCalled();
	});

	it("still asks the server inside the area when the loaded session has no admin permission", async () => {
		ensureAdminAccess.mockRejectedValue(new AppError("FORBIDDEN"));
		const error = await thrown(() =>
			beforeLoad(adminRoute)({ location, cause: "stay", context: { session: session("user") } }),
		);
		expect(error).toMatchObject({ code: "FORBIDDEN" });
		expect(ensureAdminAccess).toHaveBeenCalledOnce();
	});

	it("asks the server when entering the area (and on every SSR request) and passes the session on", async () => {
		ensureAdminAccess.mockResolvedValue(session("admin"));
		expect(await beforeLoad(adminRoute)({ location, cause: "enter", context: { session: null } })).toEqual({
			session: session("admin"),
		});
		expect(ensureAdminAccess).toHaveBeenCalledOnce();
	});

	it("redirects anonymous visitors (UNAUTHORIZED) to /login with a return URL", async () => {
		ensureAdminAccess.mockRejectedValue(new AppError("UNAUTHORIZED"));
		const error = await thrown(() => beforeLoad(adminRoute)({ location, cause: "enter", context: { session: null } }));
		expect(isRedirect(error)).toBe(true);
		expect((error as { options: unknown }).options).toMatchObject({
			to: "/login",
			search: { redirect: location.href },
		});
	});

	it("rethrows FORBIDDEN for signed-in non-admins, with the 403 status recorded for SSR", async () => {
		const forbidden = new AppError("FORBIDDEN");
		ensureAdminAccess.mockRejectedValue(forbidden);
		expect(await thrown(() => beforeLoad(adminRoute)({ location, cause: "enter", context: { session: null } }))).toBe(
			forbidden,
		);
		expect(setErrorStatus).toHaveBeenCalledWith(forbidden);
	});
});
