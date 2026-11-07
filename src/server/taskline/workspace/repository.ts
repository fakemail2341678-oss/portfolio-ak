import "@tanstack/react-start/server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { SANDBOX_SEGMENT, type TasklineMember, type TeamRole, type WorkspaceSummary } from "@/features/taskline/types";
import { type TlMemberRow, type TlWorkspaceRow, tlMember, tlWorkspace, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";

/** Taskline's workspaces and members: plain reads and writes, no rules (the services hold those). */

export const workspaceSummary = (row: TlWorkspaceRow): WorkspaceSummary => ({
	id: row.id,
	kind: row.kind,
	slug: row.slug,
	name: row.name,
	segment: row.kind === "sandbox" ? SANDBOX_SEGMENT : row.slug,
});

export const memberDto = (row: TlMemberRow): TasklineMember => ({
	id: row.id,
	userId: row.userId,
	name: row.displayName,
	role: row.role,
	title: row.title,
	placeholder: row.userId === null,
	deactivated: row.deactivatedAt !== null,
});

export async function teamWorkspace(db: Db): Promise<TlWorkspaceRow | null> {
	const [row] = await db.select().from(tlWorkspace).where(eq(tlWorkspace.kind, "team"));
	return row ?? null;
}

/** The team workspace; the migration creates it, so this only inserts on an emptied database (tests). */
export async function ensureTeamWorkspace(db: Db): Promise<TlWorkspaceRow> {
	const existing = await teamWorkspace(db);
	if (existing) return existing;
	await db.insert(tlWorkspace).values({ kind: "team", slug: "team", name: "Team" }).onConflictDoNothing();
	const row = await teamWorkspace(db);
	if (!row) throw new Error("No team workspace");
	return row;
}

export async function sandboxOf(db: Db, userId: string): Promise<TlWorkspaceRow | null> {
	const [row] = await db
		.select()
		.from(tlWorkspace)
		.where(and(eq(tlWorkspace.kind, "sandbox"), eq(tlWorkspace.ownerId, userId)));
	return row ?? null;
}

export async function insertSandbox(tx: Tx, ownerId: string, name: string): Promise<TlWorkspaceRow> {
	const [row] = await tx
		.insert(tlWorkspace)
		.values({ kind: "sandbox", slug: SANDBOX_SEGMENT, name, ownerId })
		.returning();
	if (!row) throw new Error("Sandbox insert returned no row");
	return row;
}

export type NewMember = {
	workspaceId: string;
	userId: string | null;
	displayName: string;
	role?: TeamRole;
	title?: string;
};

export async function insertMembers(tx: Tx, rows: ReadonlyArray<NewMember>): Promise<TlMemberRow[]> {
	if (rows.length === 0) return [];
	return tx
		.insert(tlMember)
		.values([...rows])
		.returning();
}

/** The account's member row in a workspace (deactivated or not), or null. */
export async function memberOf(db: Db, workspaceId: string, userId: string): Promise<TlMemberRow | null> {
	const [row] = await db
		.select()
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspaceId), eq(tlMember.userId, userId)));
	return row ?? null;
}

/** A workspace's member by id (deactivated or not), or null. */
export async function memberById(db: Db, workspaceId: string, memberId: string): Promise<TlMemberRow | null> {
	const [row] = await db
		.select()
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspaceId), eq(tlMember.id, memberId)));
	return row ?? null;
}

/** A workspace's members by name; deactivated ones only when asked (history shows them, pickers don't). */
export async function listMembers(
	db: Db,
	workspaceId: string,
	{ deactivated = false }: { deactivated?: boolean } = {},
): Promise<TlMemberRow[]> {
	return db
		.select()
		.from(tlMember)
		.where(and(eq(tlMember.workspaceId, workspaceId), deactivated ? undefined : isNull(tlMember.deactivatedAt)))
		.orderBy(asc(tlMember.displayName), asc(tlMember.id));
}

/** Deactivates (or reactivates, with null) a member: they keep their history and lose all access. */
export async function setMemberDeactivated(tx: Tx, memberId: string, at: Date | null): Promise<void> {
	await tx.update(tlMember).set({ deactivatedAt: at }).where(eq(tlMember.id, memberId));
}

/** An account's name (what a new member row snapshots). */
export async function userName(db: Db, userId: string): Promise<string | null> {
	const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
	return row?.name ?? null;
}

/** An account's name, and whether it's a guest's (a sandbox's seed names a guest in their language). */
export async function userIdentity(db: Db, userId: string): Promise<{ name: string; isAnonymous: boolean } | null> {
	const [row] = await db
		.select({ name: user.name, isAnonymous: user.isAnonymous })
		.from(user)
		.where(eq(user.id, userId));
	return row ? { name: row.name, isAnonymous: row.isAnonymous === true } : null;
}
