import { asc, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AuditListInput, auditList } from "@/features/audit/search";
import type { Actor } from "@/features/rbac/types";
import { AppError } from "@/lib/errors";
import type { AuditActor } from "@/server/audit/record";
import { recordAudit } from "@/server/audit/record";
import { listAuditEvents } from "@/server/audit/repository";
import * as schema from "@/server/db/schema";
import { permissionsForUser } from "@/server/rbac/repository";
import * as rbac from "@/server/rbac/service";
import { createTestDb } from "../utils/test-db";

/**
 * The audit log (decisions.md 0132) against PGlite: every admin action leaves a
 * row with its request id, in the same transaction (a refused or failed action
 * leaves none), and the list filters work. Also the user-management actions that
 * came with it: invitations, signing a user out everywhere and impersonation.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
const db = () => env.db;

/** A call's services, acting as `actor` (any actor-like object: the rules read only what they need). */
const svc = (actor: AuditActor & Partial<Actor>) => ({
	db: db(),
	actor: { isAdmin: false, permissions: [], ...actor },
	imageStore: null,
});
/** setUserRoles' input with the user's current version, as the roles dialog sends it. */
const versioned = async <T extends { userId: string }>(input: T) => {
	const [row] = await db()
		.select({ updatedAt: schema.user.updatedAt })
		.from(schema.user)
		.where(eq(schema.user.id, input.userId));
	return { ...input, updatedAt: (row?.updatedAt ?? new Date()).toISOString() };
};

beforeAll(async () => {
	env = await createTestDb("admin-1");
}, 60_000);
afterAll(() => env.close());

beforeEach(async () => {
	await db().delete(schema.auditEvent);
	await db().delete(schema.session);
	await db().delete(schema.userRole);
	await db().delete(schema.role).where(eq(schema.role.system, false));
	await db().delete(schema.user).where(ne(schema.user.id, "admin-1"));
});

const addUser = async (id: string, role: "user" | "admin" = "user") => {
	await db()
		.insert(schema.user)
		.values({ id, name: `Name ${id}`, email: `${id}@example.com`, role });
	return id;
};
const addSession = (userId: string, n: number) =>
	db()
		.insert(schema.session)
		.values({
			id: `${userId}-session-${n}`,
			token: `${userId}-token-${n}`,
			userId,
			expiresAt: new Date(Date.now() + 60_000),
			updatedAt: new Date(),
		});

const actorFor = async (id: string, extra: Partial<Actor> = {}): Promise<Actor> => {
	const [row] = await db().select().from(schema.user).where(eq(schema.user.id, id));
	const permissions = await permissionsForUser(db(), { id, role: row?.role ?? null, banned: row?.banned ?? null });
	return { id, isAdmin: row?.role === "admin", permissions, requestId: `req-${id}`, ip: "198.51.100.1", ...extra };
};
const ADMIN = () => actorFor("admin-1");

const rows = () => db().select().from(schema.auditEvent).orderBy(asc(schema.auditEvent.createdAt));
const list = (input: Partial<AuditListInput> = {}) =>
	listAuditEvents(db(), { ...auditList.defaults, pageSize: 50, ...input });

const rejection = async (run: () => Promise<unknown>) => {
	const error = await run().catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(AppError);
	return error as AppError;
};

describe("every admin action leaves a row", () => {
	it("roles: create, rename, permissions, delete", async () => {
		const admin = await ADMIN();
		const { id } = await rbac.createRole(svc(admin), { name: "Editor", description: "Writes" });
		const [created] = await db().select().from(schema.role).where(eq(schema.role.id, id));
		await rbac.updateRole(svc(admin), {
			name: "Writer",
			description: "Writes",
			id: id,
			updatedAt: created?.updatedAt.toISOString() ?? "",
		});
		await rbac.updateRolePermissions(svc(admin), { roleId: id, grant: ["test-crud:read"], revoke: [] });
		// Granting what the role already has changes nothing: no row.
		await rbac.updateRolePermissions(svc(admin), { roleId: id, grant: ["test-crud:read"], revoke: [] });
		await rbac.deleteRole(svc(admin), id);

		expect(await rows()).toMatchObject([
			{ action: "role.create", targetType: "role", targetId: id, after: { name: "Editor", description: "Writes" } },
			{ action: "role.update", before: { name: "Editor" }, after: { name: "Writer" }, targetLabel: "Writer" },
			{ action: "role.permissions", before: { permissions: [] }, after: { permissions: ["test-crud:read"] } },
			{ action: "role.delete", before: { name: "Writer", permissions: ["test-crud:read"] } },
		]);
		for (const row of await rows()) {
			expect(row).toMatchObject({
				actorId: "admin-1",
				actorLabel: "admin@example.com",
				requestId: "req-admin-1",
				ip: "198.51.100.1",
				impersonatorId: null,
			});
		}
	});

	it("users: roles, ban, unban, sign out everywhere", async () => {
		const admin = await ADMIN();
		await addUser("u1");
		const { id: editor } = await rbac.createRole(svc(admin), { name: "Editor", description: "" });
		await db().delete(schema.auditEvent);

		await rbac.setUserRoles(svc(admin), await versioned({ userId: "u1", admin: false, roleIds: [editor] }));
		await rbac.setUserBanned(svc(admin), { userId: "u1", banned: true });
		await rbac.setUserBanned(svc(admin), { userId: "u1", banned: false });
		await addSession("u1", 1);
		await addSession("u1", 2);
		expect(await rbac.revokeUserSessions(svc(admin), "u1")).toEqual({ revoked: 2 });

		expect(await rows()).toMatchObject([
			{
				action: "user.roles",
				targetType: "user",
				targetId: "u1",
				targetLabel: "u1@example.com",
				// Only what changed: the admin flag stayed.
				before: { roles: [] },
				after: { roles: ["Editor"] },
			},
			{ action: "user.ban", before: { banned: false }, after: { banned: true } },
			{ action: "user.unban", before: { banned: true }, after: { banned: false } },
			{ action: "user.sessions-revoke", after: { sessions: 2 } },
		]);
		expect(await db().select().from(schema.session).where(eq(schema.session.userId, "u1"))).toEqual([]);
	});

	it("a refused action leaves no row (same transaction)", async () => {
		// The last admin can't be demoted: the change and its row roll back together.
		await rejection(() => rbac.setUserBanned(svc({ ...ADMIN_STUB, id: "other" }), { userId: "admin-1", banned: true }));
		const demote = await versioned({ userId: "admin-1", admin: false, roleIds: [] });
		await rejection(() => rbac.setUserRoles(svc({ ...ADMIN_STUB, id: "other" }), demote));
		expect(await rows()).toEqual([]);
	});

	it("keeps the actor's email after their account is deleted", async () => {
		await addUser("a2", "admin");
		await recordAudit(
			db(),
			{ id: "a2" },
			{ action: "user.ban", target: { type: "user", id: "x", label: "x@example.com" } },
		);
		await db().delete(schema.user).where(eq(schema.user.id, "a2"));
		const [event] = (await list()).items;
		expect(event?.actor).toEqual({ id: null, name: "", email: "a2@example.com" });
	});
});

/** An admin actor that isn't in the database (rule checks only need the flag). */
const ADMIN_STUB: Actor = { id: "stub", isAdmin: true, permissions: [] };

describe("sign out everywhere", () => {
	it("refuses your own sessions and a non-admin acting on an admin", async () => {
		await addUser("manager");
		await addUser("a2", "admin");
		await rejection(() => rbac.revokeUserSessions(svc(ADMIN_STUB), "stub"));
		const manager = await actorFor("manager", { permissions: ["users:read", "users:ban"] });
		expect((await rejection(() => rbac.revokeUserSessions(svc(manager), "a2"))).code).toBe("FORBIDDEN");
		expect(await rows()).toEqual([]);
	});
});

describe("invitations", () => {
	it("creates an unverified baseline account, records it, then sends the invitation", async () => {
		const send = vi.fn(async () => {});
		const { id } = await rbac.inviteUser(
			svc(await ADMIN()),
			{ name: "Sita", email: "Sita@Example.com", locale: "ne" },
			send,
		);
		const [created] = await db().select().from(schema.user).where(eq(schema.user.id, id));
		expect(created).toMatchObject({ name: "Sita", email: "sita@example.com", role: "user", emailVerified: false });
		expect(send).toHaveBeenCalledWith({ id, name: "Sita", email: "sita@example.com" });
		expect(await rows()).toMatchObject([
			{ action: "user.invite", targetId: id, after: { name: "Sita", email: "sita@example.com", language: "ne" } },
		]);
	});

	it("refuses an address that already has an account, on the email field", async () => {
		await addUser("u1");
		const send = vi.fn(async () => {});
		const error = await rejection(() =>
			rbac.inviteUser(svc(ADMIN_STUB), { name: "Again", email: "U1@example.com", locale: "en" }, send),
		);
		expect(error.code).toBe("CONFLICT");
		expect(error.fieldErrors?.email).toHaveLength(1);
		expect(send).not.toHaveBeenCalled();
	});
});

describe("impersonation", () => {
	it("an admin starts and stops it; both are recorded with the admin as actor", async () => {
		await addUser("u1");
		const start = vi.fn(async () => {});
		await rbac.impersonateUser(svc(await ADMIN()), "u1", start);
		expect(start).toHaveBeenCalledOnce();
		// The impersonated session acts as u1, with the admin behind it.
		const stop = vi.fn(async () => {});
		await rbac.stopImpersonating(
			{ db: db(), actor: { id: "u1", impersonatorId: "admin-1", requestId: "req-stop" } },
			stop,
		);
		expect(stop).toHaveBeenCalledOnce();
		expect(await rows()).toMatchObject([
			{ action: "user.impersonate", actorId: "admin-1", targetId: "u1" },
			{ action: "user.impersonate-stop", actorId: "admin-1", targetId: "u1", requestId: "req-stop" },
		]);
	});

	it("rows written during an impersonated session name the admin behind it", async () => {
		await addUser("u1");
		await recordAudit(
			db(),
			{ id: "u1", impersonatorId: "admin-1" },
			{ action: "test-crud.delete", target: { type: "test-crud", id: "item" } },
		);
		const [event] = (await list()).items;
		expect(event).toMatchObject({ actor: { id: "u1", email: "u1@example.com" }, impersonator: "admin@example.com" });
	});

	it("refuses non-admins, admin targets, banned users, yourself and nesting; a failed start leaves no row", async () => {
		await addUser("u1");
		await addUser("a2", "admin");
		await addUser("banned");
		await db().update(schema.user).set({ banned: true }).where(eq(schema.user.id, "banned"));
		const start = vi.fn(async () => {});
		const manager = await actorFor("u1", { permissions: ["users:read", "users:update"] });

		expect((await rejection(() => rbac.impersonateUser(svc(manager), "banned", start))).code).toBe("FORBIDDEN");
		expect((await rejection(() => rbac.impersonateUser(svc(ADMIN_STUB), "a2", start))).code).toBe("FORBIDDEN");
		expect((await rejection(() => rbac.impersonateUser(svc(ADMIN_STUB), "banned", start))).code).toBe("CONFLICT");
		expect((await rejection(() => rbac.impersonateUser(svc(ADMIN_STUB), "stub", start))).code).toBe("FORBIDDEN");
		const nested = { ...ADMIN_STUB, impersonatorId: "someone" };
		expect((await rejection(() => rbac.impersonateUser(svc(nested), "u1", start))).code).toBe("FORBIDDEN");
		expect(start).not.toHaveBeenCalled();

		const failing = vi.fn(async () => {
			throw new AppError("INTERNAL", "Better Auth refused");
		});
		await rejection(() => rbac.impersonateUser(svc(ADMIN_STUB), "u1", failing));
		expect(await rows()).toEqual([]);
		// Stopping needs an impersonated session.
		expect((await rejection(() => rbac.stopImpersonating({ db: db(), actor: { id: "u1" } }, start))).code).toBe(
			"BAD_REQUEST",
		);
	});
});

describe("the list", () => {
	it("filters by actor, action, target type, target text, request id and day", async () => {
		await addUser("u1");
		await recordAudit(db(), { id: "admin-1", requestId: "req-a" }, [
			{ action: "role.create", target: { type: "role", id: "r1", label: "Editor" } },
			{ action: "user.ban", target: { type: "user", id: "u9", label: "nine@example.com" } },
		]);
		await recordAudit(
			db(),
			{ id: "u1", requestId: "req-b" },
			{
				action: "test-crud.delete",
				target: { type: "test-crud", id: "t1", label: "Momo" },
			},
		);
		const actions = async (input: Partial<AuditListInput>) =>
			(await list(input)).items.map((item) => item.action).sort();

		expect((await list()).total).toBe(3);
		expect(await actions({ actor: "Name u1" })).toEqual(["test-crud.delete"]);
		expect(await actions({ actor: "admin@" })).toEqual(["role.create", "user.ban"]);
		expect(await actions({ action: "user.ban" })).toEqual(["user.ban"]);
		expect(await actions({ target: "role" })).toEqual(["role.create"]);
		expect(await actions({ q: "momo" })).toEqual(["test-crud.delete"]);
		expect(await actions({ q: "req-a" })).toEqual(["role.create", "user.ban"]);
		expect(await actions({ from: "2000-01-01", to: "2000-01-02" })).toEqual([]);
	});

	it("is newest first by default", async () => {
		await recordAudit(db(), { id: "admin-1" }, { action: "role.create", target: { type: "role", id: "first" } });
		await recordAudit(db(), { id: "admin-1" }, { action: "role.create", target: { type: "role", id: "second" } });
		await db()
			.update(schema.auditEvent)
			.set({ createdAt: new Date(Date.now() - 60_000) })
			.where(eq(schema.auditEvent.targetId, "first"));
		expect((await list()).items.map((item) => item.target.id)).toEqual(["second", "first"]);
		expect((await list({ sort: "time" })).items.map((item) => item.target.id)).toEqual(["first", "second"]);
	});
});
