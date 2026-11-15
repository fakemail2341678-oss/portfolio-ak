import { describe, expect, it, vi } from "vitest";
import { ALL_PERMISSIONS, type Permission } from "@/features/rbac/lib/permissions";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import {
	requireAccountOwner,
	requireAdminAccess,
	requirePermission,
	requireUser,
	withSession,
} from "@/middleware/auth";

// The real lookup asks Better Auth (database + request cookies); tests control its result.
const getServerSession = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
vi.mock("@/server/auth/session", () => ({ getServerSession }));

// Calls a middleware's own server step with a given upstream context, capturing what it passes to next().
type ServerStep = (args: {
	next: (options?: { context?: Record<string, unknown> }) => unknown;
	context: Record<string, unknown>;
}) => unknown;

const runServer = async (middleware: { options: { server?: unknown } }, context: Record<string, unknown>) => {
	const next = vi.fn((options?: { context?: Record<string, unknown> }) => ({ passed: options?.context }));
	const server = middleware.options.server as ServerStep;
	const result = await server({ next, context });
	return { next, result };
};

const session = (
	role: "user" | "admin",
	permissions: Permission[] = role === "admin" ? [...ALL_PERMISSIONS] : [],
): Session => ({
	user: { id: "u1", email: "a@example.com", name: "A", role, twoFactorEnabled: false },
	permissions,
});

describe("auth middleware", () => {
	it("withSession passes null for anonymous requests", async () => {
		getServerSession.mockResolvedValue(null);
		const { next } = await runServer(withSession, {});
		expect(next).toHaveBeenCalledWith({ context: { session: null } });
	});

	it("withSession passes the Better Auth session on", async () => {
		getServerSession.mockResolvedValue(session("admin"));
		const { next } = await runServer(withSession, {});
		expect(next).toHaveBeenCalledWith({ context: { session: session("admin") } });
	});

	it("requireUser rejects anonymous calls with UNAUTHORIZED", async () => {
		await expect(runServer(requireUser, { session: null })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			status: 401,
		});
	});

	it("requireUser passes the user and their permissions on", async () => {
		const editor = session("user", ["test-crud:read"]);
		const { next } = await runServer(requireUser, { session: editor });
		expect(next).toHaveBeenCalledWith({
			context: { user: editor.user, permissions: ["test-crud:read"], twoFactorRequired: false, impersonatedBy: null },
		});
		const pending: Session = { ...session("admin", []), twoFactorRequired: true };
		const { next: nextPending } = await runServer(requireUser, { session: pending });
		expect(nextPending).toHaveBeenCalledWith({
			context: { user: pending.user, permissions: [], twoFactorRequired: true, impersonatedBy: null },
		});
		const viewed: Session = { ...session("user", []), impersonatedBy: "admin-1" };
		const { next: nextViewed } = await runServer(requireUser, { session: viewed });
		expect(nextViewed).toHaveBeenCalledWith({
			context: { user: viewed.user, permissions: [], twoFactorRequired: false, impersonatedBy: "admin-1" },
		});
	});

	it("requireAccountOwner refuses an impersonated session and lets the owner through", async () => {
		// Its own step reads what requireUser passed on.
		const { next } = await runServer(requireAccountOwner, { impersonatedBy: null });
		expect(next).toHaveBeenCalledOnce();
		await expect(runServer(requireAccountOwner, { impersonatedBy: "admin-1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("requirePermission rejects users missing any required permission with FORBIDDEN", async () => {
		const middleware = requirePermission("test-crud:read", "test-crud:delete");
		const run = runServer(middleware, { permissions: ["test-crud:read"] });
		await expect(run).rejects.toBeInstanceOf(AppError);
		await expect(runServer(middleware, { permissions: ["test-crud:read"] })).rejects.toMatchObject({
			code: "FORBIDDEN",
			status: 403,
		});
	});

	it("requirePermission lets users with every required permission through", async () => {
		const middleware = requirePermission("test-crud:read", "test-crud:delete");
		const { next } = await runServer(middleware, { permissions: ["test-crud:delete", "test-crud:read", "users:read"] });
		expect(next).toHaveBeenCalledOnce();
	});

	it("the admin gate needs at least one permission", async () => {
		await expect(runServer(requireAdminAccess, { permissions: [] })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const { next } = await runServer(requireAdminAccess, { permissions: ["users:read"] });
		expect(next).toHaveBeenCalledOnce();
	});

	it("the admin gate asks for two-factor first when the setting holds the user's permissions back", async () => {
		await expect(runServer(requireAdminAccess, { permissions: [], twoFactorRequired: true })).rejects.toMatchObject({
			code: "FORBIDDEN",
			reason: "two-factor-required",
		});
	});

	it("builds the chain: permission requires user requires session", () => {
		expect(requirePermission("roles:read").options).toMatchObject({ middleware: [requireUser] });
		expect(requireAdminAccess.options).toMatchObject({ middleware: [requireUser] });
		expect(requireUser.options).toMatchObject({ middleware: [withSession] });
	});
});
