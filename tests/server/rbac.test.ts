import { eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, type Permission } from "@/features/rbac/permissions";
import type { Actor } from "@/features/rbac/types";
import { AppError, FORM_ERROR_KEY } from "@/lib/errors";
import type { AuditActor } from "@/server/audit/record";
import * as schema from "@/server/db/schema";
import { getRole, listRoles, listUsers, permissionsForUser } from "@/server/rbac/repository";
import * as rbac from "@/server/rbac/service";
import { createTestDb } from "../utils/test-db";

/**
 * Roles and permissions against real Postgres (PGlite) with the committed
 * migrations, including the seeded system roles. The escalation and lockout
 * rules are the point: they're what stops a user from raising their own
 * privileges or locking every admin out.
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
	roleCounter = 0;
	await db().delete(schema.userRole);
	await db().delete(schema.role).where(eq(schema.role.system, false));
	await db().delete(schema.rolePermission);
	await db().delete(schema.user).where(ne(schema.user.id, "admin-1"));
	await db().update(schema.user).set({ role: "admin", banned: false });
});

const addUser = async (id: string, role: "user" | "admin" = "user") => {
	await db()
		.insert(schema.user)
		.values({ id, name: id, email: `${id}@example.com`, role });
	return id;
};
const roleId = async (key: string) => {
	const [row] = await db().select({ id: schema.role.id }).from(schema.role).where(eq(schema.role.key, key));
	if (!row) throw new Error(`no role ${key}`);
	return row.id;
};
const actorFor = async (id: string): Promise<Actor> => {
	const [row] = await db().select().from(schema.user).where(eq(schema.user.id, id));
	const permissions = await permissionsForUser(db(), { id, role: row?.role ?? null, banned: row?.banned ?? null });
	return { id, isAdmin: row?.role === "admin", permissions };
};
const ADMIN: () => Promise<Actor> = () => actorFor("admin-1");

/** An "Editor" role with Test CRUD read/create/update, as in the acceptance criteria. */
let roleCounter = 0;
const createEditor = async (
	permissions: Permission[] = ["test-crud:read", "test-crud:create", "test-crud:update"],
	name = roleCounter++ === 0 ? "Editor" : `Role ${roleCounter}`,
) => {
	const { id } = await rbac.createRole(svc(await ADMIN()), { name, description: "Writes items" });
	await rbac.updateRolePermissions(svc(await ADMIN()), { roleId: id, grant: permissions, revoke: [] });
	return id;
};

const rejection = async (run: () => Promise<unknown>) => {
	const error = await run().catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(AppError);
	return error as AppError;
};
const userMessage = (error: AppError) => error.fieldErrors?.[FORM_ERROR_KEY]?.[0];
/** A role's version as the roles list sends it (what the rename dialog sends back). */
const versionOf = async (id: string) => {
	const role = (await listRoles(db())).find((each) => each.id === id);
	if (!role) throw new Error(`no role ${id}`);
	return role.updatedAt;
};

describe("system roles (migration seed)", () => {
	it("exist: admin and user, marked as system", async () => {
		const roles = await listRoles(db());
		expect(roles.filter((role) => role.system).map((role) => role.key)).toEqual(["admin", "user"]);
		expect(roles.find((role) => role.key === "admin")?.permissions).toEqual(ALL_PERMISSIONS);
	});
});

describe("permission resolution (every request)", () => {
	it("admins get the whole catalog", async () => {
		expect(await permissionsForUser(db(), { id: "admin-1", role: "admin", banned: false })).toEqual(ALL_PERMISSIONS);
	});

	it("users get the baseline plus their custom roles, in catalog order", async () => {
		const id = await addUser("sita");
		expect(await permissionsForUser(db(), { id, role: "user", banned: false })).toEqual([]);
		await rbac.updateRolePermissions(svc(await ADMIN()), {
			roleId: await roleId("user"),
			grant: ["users:read"],
			revoke: [],
		});
		const editor = await createEditor();
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [editor] }));
		expect(await permissionsForUser(db(), { id, role: "user", banned: false })).toEqual([
			"test-crud:read",
			"test-crud:create",
			"test-crud:update",
			"users:read",
		]);
	});

	it("a removed permission is gone on the next resolution (the next request)", async () => {
		const id = await addUser("sita");
		const editor = await createEditor();
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [editor] }));
		await rbac.updateRolePermissions(svc(await ADMIN()), { roleId: editor, grant: [], revoke: ["test-crud:create"] });
		expect(await permissionsForUser(db(), { id, role: "user", banned: false })).toEqual([
			"test-crud:read",
			"test-crud:update",
		]);
	});

	it("banned users get nothing, even admins", async () => {
		expect(await permissionsForUser(db(), { id: "admin-1", role: "admin", banned: true })).toEqual([]);
	});
});

describe("role management", () => {
	it("creates roles with a key from the name, unique names, and renames", async () => {
		const first = await rbac.createRole(svc(await ADMIN()), { name: "Content editor", description: "" });
		expect(first.key).toBe("content-editor");
		const error = await rejection(async () =>
			rbac.createRole(svc(await ADMIN()), { name: "content EDITOR", description: "" }),
		);
		expect(error).toMatchObject({ code: "CONFLICT", fieldErrors: { name: ["Another role already has this name."] } });
		const second = await rbac.createRole(svc(await ADMIN()), { name: "संपादक", description: "" });
		expect(second.key).toBe("role");
		await rbac.updateRole(svc(await ADMIN()), {
			name: "Writer",
			description: "Writes",
			id: first.id,
			updatedAt: await versionOf(first.id),
		});
		expect(await getRole(db(), first.id)).toMatchObject({ key: "content-editor", name: "Writer" });
	});

	it("system roles can't be renamed or deleted; admin's permissions are fixed", async () => {
		const admin = await roleId("admin");
		expect(
			userMessage(
				await rejection(async () =>
					rbac.updateRole(svc(await ADMIN()), {
						name: "Boss",
						description: "",
						id: admin,
						updatedAt: await versionOf(admin),
					}),
				),
			),
		).toBe("System roles can't be renamed or deleted.");
		await rejection(async () => rbac.deleteRole(svc({} as Actor), admin));
		const fixed = await rejection(async () =>
			rbac.updateRolePermissions(svc({ id: "x", isAdmin: true, permissions: ALL_PERMISSIONS }), {
				roleId: admin,
				grant: [],
				revoke: ["users:read"],
			}),
		);
		expect(userMessage(fixed)).toBe("The Admin role always has every permission.");
	});

	it("deleting a role removes it from its users", async () => {
		const id = await addUser("sita");
		const editor = await createEditor();
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [editor] }));
		await rbac.deleteRole(svc(await ADMIN()), editor);
		expect(await permissionsForUser(db(), { id, role: "user", banned: false })).toEqual([]);
	});
});

describe("role rename conflicts", () => {
	it("refuses a rename started from an older version and keeps the first one", async () => {
		const { id } = await rbac.createRole(svc(await ADMIN()), { name: "Editor", description: "" });
		const opened = await versionOf(id);
		await rbac.updateRole(svc(await ADMIN()), { name: "Writer", description: "", id: id, updatedAt: opened });
		const error = await rejection(async () =>
			rbac.updateRole(svc(await ADMIN()), { name: "Author", description: "", id: id, updatedAt: opened }),
		);
		expect(error).toMatchObject({ code: "CONFLICT", reason: "stale" });
		expect(await getRole(db(), id)).toMatchObject({ name: "Writer" });
		await rbac.updateRole(svc(await ADMIN()), {
			name: "Author",
			description: "",
			id: id,
			updatedAt: await versionOf(id),
		});
		expect(await getRole(db(), id)).toMatchObject({ name: "Author" });
	});

	it("doesn't count permission edits as a change (the matrix sends deltas)", async () => {
		const id = await createEditor();
		const opened = await versionOf(id);
		await rbac.updateRolePermissions(svc(await ADMIN()), { roleId: id, grant: ["users:read"], revoke: [] });
		await rbac.updateRole(svc(await ADMIN()), { name: "Writer", description: "", id: id, updatedAt: opened });
		expect(await getRole(db(), id)).toMatchObject({ name: "Writer" });
	});

	it("reports NOT_FOUND when the role was deleted in between", async () => {
		const { id } = await rbac.createRole(svc(await ADMIN()), { name: "Editor", description: "" });
		const opened = await versionOf(id);
		await rbac.deleteRole(svc(await ADMIN()), id);
		const error = await rejection(async () =>
			rbac.updateRole(svc(await ADMIN()), { name: "Writer", description: "", id: id, updatedAt: opened }),
		);
		expect(error.code).toBe("NOT_FOUND");
	});
});

describe("escalation and lockout guards", () => {
	it("a roles:manage holder can't grant themselves (or anyone) a permission they lack", async () => {
		const id = await addUser("manager");
		const managers = await createEditor(["roles:read", "roles:manage"]);
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [managers] }));
		const manager = await actorFor(id);
		const error = await rejection(async () =>
			rbac.updateRolePermissions(svc(manager), { roleId: managers, grant: ["users:ban"], revoke: [] }),
		);
		expect(error.code).toBe("FORBIDDEN");
		expect(userMessage(error)).toBe("You can only grant or remove permissions you have yourself.");
		// Within their own permissions it works.
		const other = await createEditor([]);
		await rbac.updateRolePermissions(svc(manager), { roleId: other, grant: ["roles:read"], revoke: [] });
	});

	it("nobody changes their own roles (no self-escalation, no self-lockout)", async () => {
		const id = await addUser("updater");
		const updaters = await createEditor(["users:read", "users:update"]);
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [updaters] }));
		const powerful = await createEditor(["roles:manage"]);
		const self = await rejection(async () =>
			rbac.setUserRoles(
				svc(await actorFor(id)),
				await versioned({ userId: id, admin: false, roleIds: [updaters, powerful] }),
			),
		);
		expect(userMessage(self)).toBe("You can't change your own roles.");
		const adminSelf = await rejection(async () =>
			rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: "admin-1", admin: false, roleIds: [] })),
		);
		expect(adminSelf.code).toBe("FORBIDDEN");
	});

	it("a users:update holder can't hand out roles stronger than their own", async () => {
		const id = await addUser("updater");
		const target = await addUser("target");
		const updaters = await createEditor(["users:read", "users:update"]);
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [updaters] }));
		const managers = await createEditor(["roles:manage"]);
		const error = await rejection(async () =>
			rbac.setUserRoles(
				svc(await actorFor(id)),
				await versioned({ userId: target, admin: false, roleIds: [managers] }),
			),
		);
		expect(userMessage(error)).toBe("You can only grant or remove permissions you have yourself.");
	});

	it("only admins make or unmake admins, or touch an admin's roles", async () => {
		const id = await addUser("updater");
		const target = await addUser("target");
		const updaters = await createEditor(["users:read", "users:update", "users:ban"]);
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: id, admin: false, roleIds: [updaters] }));
		const updater = await actorFor(id);
		expect(
			userMessage(
				await rejection(async () =>
					rbac.setUserRoles(svc(updater), await versioned({ userId: target, admin: true, roleIds: [] })),
				),
			),
		).toBe("Only an admin can change who is an admin.");
		expect(
			userMessage(
				await rejection(async () =>
					rbac.setUserRoles(svc(updater), await versioned({ userId: "admin-1", admin: true, roleIds: [] })),
				),
			),
		).toBe("Only an admin can change, ban or sign out an admin.");
		expect(
			(await rejection(async () => rbac.setUserBanned(svc(updater), { userId: "admin-1", banned: true }))).code,
		).toBe("FORBIDDEN");
	});

	it("there is always at least one active admin", async () => {
		const other = await addUser("admin-2", "admin");
		// Two admins: one may demote the other.
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: other, admin: false, roleIds: [] }));
		await db().update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, other));
		// Banning admin-1 leaves admin-2; then admin-2 can't demote or ban... the last one is admin-2 itself.
		await rbac.setUserBanned(svc(await actorFor(other)), { userId: "admin-1", banned: true });
		const last = await rejection(async () =>
			rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: other, admin: false, roleIds: [] })),
		);
		expect(userMessage(last)).toBe("There must always be at least one admin.");
		const banLast = await rejection(async () =>
			rbac.setUserBanned(svc({ id: "x", isAdmin: true, permissions: ALL_PERMISSIONS }), {
				userId: other,
				banned: true,
			}),
		);
		expect(banLast.code).toBe("CONFLICT");
	});

	it("nobody bans themselves; banning signs the user out everywhere", async () => {
		const id = await addUser("sita");
		await db()
			.insert(schema.session)
			.values({
				id: "s1",
				token: "t1",
				userId: id,
				expiresAt: new Date(Date.now() + 86_400_000),
				updatedAt: new Date(),
			});
		expect(
			userMessage(
				await rejection(async () =>
					rbac.setUserBanned(svc({ ...(await ADMIN()), id: "admin-1" }), { userId: "admin-1", banned: true }),
				),
			),
		).toBe("You can't ban yourself.");
		await rbac.setUserBanned(svc(await ADMIN()), { userId: id, banned: true });
		expect(await db().select().from(schema.session).where(eq(schema.session.userId, id))).toEqual([]);
		expect(await permissionsForUser(db(), { id, role: "user", banned: true })).toEqual([]);
		await rbac.setUserBanned(svc(await ADMIN()), { userId: id, banned: false });
		const [row] = await db().select({ banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, id));
		expect(row?.banned).toBe(false);
	});

	it("unknown or system role ids can't be assigned", async () => {
		const id = await addUser("sita");
		const error = await rejection(async () =>
			rbac.setUserRoles(
				svc(await ADMIN()),
				await versioned({ userId: id, admin: false, roleIds: [await roleId("admin")] }),
			),
		);
		expect(error.code).toBe("BAD_REQUEST");
	});
});

describe("listUsers", () => {
	it("filters by role, status and text; returns roles per user", async () => {
		const sita = await addUser("sita");
		await addUser("ram");
		const editor = await createEditor();
		await rbac.setUserRoles(svc(await ADMIN()), await versioned({ userId: sita, admin: false, roleIds: [editor] }));
		await rbac.setUserBanned(svc(await ADMIN()), { userId: "ram", banned: true });
		const list = (overrides: Partial<Parameters<typeof listUsers>[1]>) =>
			listUsers(db(), { q: "", role: "all", status: "all", sort: "name", page: 1, pageSize: 20, ...overrides });
		const names = async (overrides: Partial<Parameters<typeof listUsers>[1]>) =>
			(await list(overrides)).items.map((u) => u.id);
		expect(await names({})).toEqual(["admin-1", "ram", "sita"]);
		expect(await names({ role: "admin" })).toEqual(["admin-1"]);
		expect(await names({ role: "editor" })).toEqual(["sita"]);
		expect(await names({ role: "user" })).toEqual(["ram"]);
		expect(await names({ status: "banned" })).toEqual(["ram"]);
		expect(await names({ status: "active" })).toEqual(["admin-1", "sita"]);
		expect(await names({ q: "SIT" })).toEqual(["sita"]);
		const [item] = (await list({ q: "sita" })).items;
		expect(item).toMatchObject({ isAdmin: false, banned: false, roles: [{ key: "editor", name: "Editor" }] });
	});
});
