// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authKeys } from "@/features/auth/keys";
import { AppError } from "@/lib/errors";

/** A stand-in for the browser's router (the middleware only uses these parts). */
const router = {
	options: { context: { queryClient: new QueryClient() } },
	state: { matches: [{ routeId: "/_admin/admin/test-crud/" }] },
	latestLocation: { href: "/admin/test-crud?page=2" },
	navigate: vi.fn(async () => {}),
};

vi.mock("@tanstack/react-start", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-start")>()),
	getRouterInstance: () => router,
}));

const { sessionExpiryMiddleware } = await import("@/middleware/session-expiry");

/** Runs the middleware's client step around a server function call that fails with `error`. */
const callFailing = async (error: unknown) => {
	const step = (sessionExpiryMiddleware as unknown as { options: { client: (ctx: unknown) => Promise<unknown> } })
		.options.client;
	await expect(
		step({
			next: async () => {
				throw error;
			},
		}),
	).rejects.toBe(error);
	// The redirect runs in the background (a few awaits); a macrotask lets it finish.
	await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("session expiry middleware (the server-function interceptor)", () => {
	beforeEach(() => {
		router.navigate.mockClear();
		router.state.matches = [{ routeId: "/_admin/admin/test-crud/" }];
		router.options.context.queryClient.setQueryData(authKeys.session, { user: { id: "u1" }, permissions: [] });
	});

	it("on UNAUTHORIZED: clears the session and goes to /login with a return URL, still rethrowing", async () => {
		await callFailing(new AppError("UNAUTHORIZED"));
		expect(router.options.context.queryClient.getQueryData(authKeys.session)).toBeNull();
		expect(router.navigate).toHaveBeenCalledWith({ to: "/login", search: { redirect: "/admin/test-crud?page=2" } });
	});

	it("leaves FORBIDDEN and other errors to the caller", async () => {
		await callFailing(new AppError("FORBIDDEN"));
		await callFailing(new Error("network"));
		expect(router.navigate).not.toHaveBeenCalled();
		expect(router.options.context.queryClient.getQueryData(authKeys.session)).not.toBeNull();
	});

	it("doesn't redirect when already on a sign-in page", async () => {
		router.state.matches = [{ routeId: "/_auth/login" }];
		await callFailing(new AppError("UNAUTHORIZED"));
		expect(router.navigate).not.toHaveBeenCalled();
	});
});
